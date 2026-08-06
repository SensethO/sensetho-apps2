import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { trierGeojson } from '@/lib/eudr/screening'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const MOTEUR_VERSION = 'v1'

/**
 * Tri automatique d'un fichier de géolocalisation.
 *
 * Le fichier est lu depuis SharePoint et n'est jamais recopié ailleurs : seuls
 * les constats sont conservés en base. Chaque exécution est historisée — un
 * fournisseur qui corrige son fichier doit laisser la trace des deux passages,
 * faute de quoi la diligence n'est pas démontrable.
 */

/** GET ?org_id → derniers tris par document. */
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const [tris, docs] = await Promise.all([
    admin.from('eudr_geo_screening').select('*').eq('org_id', orgId!).order('analyzed_at', { ascending: false }),
    admin.from('eudr_attachments').select('id, name, entity_type, entity_id, created_at')
      .eq('org_id', orgId!).eq('doc_type', 'geojson').order('created_at', { ascending: false }),
  ])
  if (tris.error) return NextResponse.json({ error: tris.error.message }, { status: 502 })

  // Seul le tri le plus récent de chaque document est renvoyé : l'historique
  // complet reste en base pour le dossier de conformité.
  const dernier = new Map<string, unknown>()
  for (const t of tris.data ?? []) if (!dernier.has(t.attachment_id)) dernier.set(t.attachment_id, t)

  return NextResponse.json({
    documents: docs.data ?? [],
    tris: [...dernier.values()],
  })
}

/** POST { org_id, attachmentId, paysDeclare?, surfaceMaxPlausibleHa? } → exécute et consigne. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const orgId = String(body?.org_id ?? '')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const attachmentId = String(body?.attachmentId ?? '')
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments')
      .select('sharepoint_item_id, name, entity_id').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    // Le pays vient du fournisseur rattaché, sauf indication explicite : le test
    // d'emprise n'a de sens que confronté à une déclaration.
    let paysDeclare = typeof body?.paysDeclare === 'string' ? body.paysDeclare : null
    if (!paysDeclare && row.entity_id) {
      const { data: f } = await admin.from('eudr_suppliers')
        .select('country_origin').eq('id', row.entity_id).maybeSingle()
      paysDeclare = f?.country_origin ?? null
    }

    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL de téléchargement indisponible' }, { status: 404 })

    const texte = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
    let brut: unknown = null
    try { brut = JSON.parse(texte) } catch { /* le moteur signalera l'illisibilité */ }

    const rapport = trierGeojson(brut, {
      paysDeclare: paysDeclare ?? undefined,
      surfaceMaxPlausibleHa: typeof body?.surfaceMaxPlausibleHa === 'number' ? body.surfaceMaxPlausibleHa : undefined,
    })

    // Une adresse se relit des années plus tard, un identifiant technique non.
    const { data: profil } = await admin.from('profiles')
      .select('email').eq('id', auth.userId!).maybeSingle()

    const { data: enregistre, error } = await admin.from('eudr_geo_screening').insert({
      org_id: orgId,
      attachment_id: attachmentId,
      pays_declare: paysDeclare,
      nb_parcelles: rapport.nbParcelles,
      surface_ha: rapport.surfaceTotaleHa,
      nb_bloquants: rapport.constats.filter(c => c.gravite === 'bloquant').length,
      nb_alertes: rapport.constats.filter(c => c.gravite === 'alerte').length,
      exploitable: rapport.exploitable,
      constats: rapport.constats,
      moteur_version: MOTEUR_VERSION,
      analyzed_by: profil?.email ?? auth.userId ?? null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })

    return NextResponse.json({ tri: enregistre, rapport })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}
