import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { analyzeDeforestation } from '@/lib/eudr/whisp'
import { guard } from '../traces/_auth'
import { chargerEtatVersions, type EtatVersion } from '../plots/_referentiel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lit un GeoJSON stocké dans SharePoint (par id d'attachement). */
async function readGeojson(orgId: string, attachmentId: string): Promise<{ text: string; name: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id, name').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
  if (!row) throw new Error('Document GeoJSON introuvable.')
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) throw new Error('Fichier GeoJSON SharePoint introuvable.')
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) throw new Error('URL de téléchargement GeoJSON indisponible.')
  const text = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
  return { text, name: (row.name as string) ?? 'geojson' }
}

/**
 * Conclusions d'instruction possibles pour un signal de perturbation du couvert.
 * Whisp signale un changement de couvert, pas une déforestation : la qualification
 * est un acte humain, consigné à part (cf. 20260831_eudr_signal_qualification.sql).
 */
const STATUTS = [
  'a_instruire',
  'deforestation_confirmee',
  'ecartee_deja_en_production',
  'ecartee_repousse_ou_naturel',
  'ecartee_expertise_externe',
] as const

/** La table de qualification peut ne pas être encore appliquée (cf. MAINTENANCE §12). */
function missingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || /does not exist|relation .* n'existe pas/i.test(err.message ?? ''))
}

/** GET ?org_id=xxx — analyses de couvert de l'org + qualifications des signaux. */
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const admin = createAdminClient()
  const [analyses, atts, quals, versions, plots, fournisseurs] = await Promise.all([
    admin.from('eudr_deforestation').select('*').eq('org_id', orgId!).order('analyzed_at', { ascending: false }),
    admin.from('eudr_attachments').select('id, name, entity_type, entity_id, created_at').eq('org_id', orgId!).eq('doc_type', 'geojson').order('created_at', { ascending: false }),
    admin.from('eudr_signal_qualifications').select('*').eq('org_id', orgId!),
    // Versions d'un même fichier : l'analyse est clé par attachement seul, elle ne
    // suit donc pas la correction. Le panneau a besoin de savoir quel attachement
    // est l'autre version, et laquelle porte le périmètre courant, pour le SIGNALER.
    chargerEtatVersions(orgId!, admin).catch(() => new Map<string, EtatVersion>()),
    // Référentiel des parcelles du même fichier : c'est lui qui porte l'identité
    // (référence, producteur, fournisseur) que l'analyse de couvert n'a pas.
    admin.from('eudr_plots')
      .select('attachment_id, feature_index, plot_ref, producer_name, computed_area_ha, supplier_id')
      .eq('org_id', orgId!).eq('is_current', true).order('feature_index'),
    admin.from('eudr_suppliers').select('id, name').eq('org_id', orgId!),
  ])
  if (analyses.error) return NextResponse.json({ error: analyses.error.message }, { status: 500 })
  // Migration non appliquée : le panneau reste utilisable, la qualification est simplement
  // indisponible — mieux vaut ça qu'une page en erreur.
  const qualError = quals.error && !missingTable(quals.error) ? quals.error.message : null
  /* ── Lien entre l'analyse de couvert et le référentiel des parcelles ──────
   * L'analyse Whisp ne connaît que des index (« parcelle 1 »), le référentiel
   * connaît les références (« 03DA1574 P1 »). Les deux décrivent les mêmes
   * géométries du même fichier, dans le même ordre : `feature_index` est la
   * clé commune. L'appariement n'est publié QUE si les cardinaux concordent —
   * un fichier réanalysé après modification donnerait sinon des références
   * décalées d'un rang, c'est-à-dire un faux plus dangereux qu'une absence.
   */
  const nomFournisseur = new Map((fournisseurs.data ?? []).map(f => [String(f.id), (f.name as string) ?? null]))
  const parRattachement = new Map<string, Array<Record<string, unknown>>>()
  for (const p of (plots.data ?? [])) {
    const cle = String(p.attachment_id)
    const liste = parRattachement.get(cle) ?? []
    liste.push({
      index: p.feature_index as number,
      ref: (p.plot_ref as string | null) ?? null,
      producteur: (p.producer_name as string | null) ?? null,
      fournisseur: p.supplier_id ? (nomFournisseur.get(String(p.supplier_id)) ?? null) : null,
      surfaceReferentielHa: p.computed_area_ha != null ? Number(p.computed_area_ha) : null,
    })
    parRattachement.set(cle, liste)
  }
  const referentiel: Record<string, Array<Record<string, unknown>>> = {}
  for (const a of (analyses.data ?? [])) {
    const liste = parRattachement.get(String(a.attachment_id))
    if (!liste) continue
    const attendu = (a.plot_count as number | null) ?? (Array.isArray(a.plots) ? a.plots.length : null)
    if (attendu != null && liste.length !== attendu) continue // cardinaux discordants : on se tait
    referentiel[String(a.attachment_id)] = liste
  }

  return NextResponse.json({
    data: analyses.data ?? [],
    referentiel,
    attachments: atts.data ?? [],
    qualifications: quals.data ?? [],
    qualificationsDisponibles: !quals.error,
    qualificationsError: qualError,
    versions: Object.fromEntries(versions),
  })
}

/**
 * PATCH { org_id, attachmentId, plotId, statut, commentaire?, source? }
 * Consigne la conclusion d'instruction d'un signal de perturbation.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      org_id?: string; attachmentId?: string; plotId?: string
      statut?: string; commentaire?: string | null; source?: string | null
    }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.attachmentId || !body.plotId) {
      return NextResponse.json({ error: 'attachmentId et plotId requis' }, { status: 400 })
    }
    const statut = body.statut ?? 'a_instruire'
    if (!(STATUTS as readonly string[]).includes(statut)) {
      return NextResponse.json({ error: 'Conclusion inconnue.' }, { status: 400 })
    }

    const { data: { user } } = await createUserClient().auth.getUser()
    const admin = createAdminClient()
    const { data, error } = await admin.from('eudr_signal_qualifications').upsert({
      org_id: body.org_id!, attachment_id: body.attachmentId, plot_id: body.plotId,
      statut,
      commentaire: body.commentaire?.trim() ? body.commentaire.trim() : null,
      source: body.source?.trim() ? body.source.trim() : null,
      qualified_at: new Date().toISOString(), qualified_by: user?.email ?? null,
    }, { onConflict: 'org_id,attachment_id,plot_id' }).select().single()
    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({ error: 'Qualification indisponible : migration 20260831_eudr_signal_qualification non appliquée.' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 })
  }
}

/**
 * POST { org_id, attachmentId, entity_type?, entity_id? }
 * Analyse le GeoJSON via Whisp et stocke les signaux de perturbation du couvert.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; attachmentId?: string; entity_type?: string; entity_id?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })

    const apiKey = process.env.WHISP_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé Whisp non configurée (WHISP_API_KEY).' }, { status: 400 })

    const { text, name } = await readGeojson(body.org_id!, body.attachmentId)
    let geojson: unknown
    try { geojson = JSON.parse(text) } catch { return NextResponse.json({ error: 'GeoJSON invalide.' }, { status: 400 }) }

    const result = await analyzeDeforestation(geojson, apiKey)

    const { data: { user } } = await createUserClient().auth.getUser()
    const admin = createAdminClient()
    const row = {
      org_id: body.org_id!, attachment_id: body.attachmentId,
      entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null,
      source_name: name, analyzed_at: new Date().toISOString(), analyzed_by: user?.email ?? null,
      overall_risk: result.overallRisk, plot_count: result.plotCount,
      summary: result.summary, plots: result.plots,
    }
    const { data, error } = await admin.from('eudr_deforestation')
      .upsert(row, { onConflict: 'org_id,attachment_id' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}
