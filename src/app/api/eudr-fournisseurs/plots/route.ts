import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { trierGeojson } from '@/lib/eudr/screening'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Référentiel des parcelles.
 *
 * Socle de la traçabilité : sans identité stable de parcelle, impossible de
 * relier un lot livré aux terres déclarées. La géométrie complète n'est pas
 * recopiée — le fichier reste sur SharePoint et fait foi — seules les valeurs
 * dérivées nécessaires aux contrôles sont conservées.
 */

/** GET ?org_id[&supplier_id] → parcelles courantes, doublons inter-fournisseurs, totaux. */
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const supplierId = req.nextUrl.searchParams.get('supplier_id')

  const admin = createAdminClient()
  let q = admin.from('eudr_plots').select('*').eq('org_id', orgId!).eq('is_current', true)
  if (supplierId) q = q.eq('supplier_id', supplierId)
  const { data: parcelles, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  const { data: doublons } = await admin.from('eudr_plots_doublons').select('*').eq('org_id', orgId!)

  // Surface par fournisseur : c'est cette base qui plafonnera les volumes
  // achetables lors de la réconciliation volumétrique.
  const parFournisseur = new Map<string, { parcelles: number; surfaceHa: number }>()
  for (const p of parcelles ?? []) {
    const cle = p.supplier_id ?? 'sans-fournisseur'
    const acc = parFournisseur.get(cle) ?? { parcelles: 0, surfaceHa: 0 }
    acc.parcelles += 1
    acc.surfaceHa += Number(p.computed_area_ha ?? 0)
    parFournisseur.set(cle, acc)
  }

  return NextResponse.json({
    parcelles: parcelles ?? [],
    doublons: doublons ?? [],
    parFournisseur: Object.fromEntries(
      [...parFournisseur].map(([k, v]) => [k, { ...v, surfaceHa: +v.surfaceHa.toFixed(4) }]),
    ),
  })
}

/** POST { org_id, attachmentId } → verse les parcelles du fichier au référentiel. */
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
      .select('sharepoint_item_id, entity_id').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    let pays: string | null = null
    if (row.entity_id) {
      const { data: f } = await admin.from('eudr_suppliers')
        .select('country_origin').eq('id', row.entity_id).maybeSingle()
      pays = f?.country_origin ?? null
    }

    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL de téléchargement indisponible' }, { status: 404 })

    const texte = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
    let brut: unknown = null
    try { brut = JSON.parse(texte) } catch { /* signalé plus bas */ }

    const rapport = trierGeojson(brut, { paysDeclare: pays ?? undefined })
    if (!rapport.lisible || !rapport.fiches.length) {
      return NextResponse.json({ error: 'Fichier illisible ou sans parcelle exploitable.' }, { status: 400 })
    }
    // Un fichier rejeté par le tri n'a pas à entrer au référentiel : il y
    // figurerait comme une parcelle valide alors qu'il doit repartir en révision.
    if (!rapport.exploitable) {
      return NextResponse.json(
        { error: 'Le tri a relevé des anomalies rédhibitoires. Corrigez le fichier avant de le verser au référentiel.' },
        { status: 409 },
      )
    }

    const { data: profil } = await admin.from('profiles')
      .select('email').eq('id', auth.userId!).maybeSingle()

    // Un nouveau versement du même fichier remplace le précédent : les lignes
    // antérieures sont conservées mais sortent du périmètre courant.
    await admin.from('eudr_plots')
      .update({ is_current: false }).eq('attachment_id', attachmentId).eq('is_current', true)

    const lignes = rapport.fiches.map(f => ({
      org_id: orgId,
      supplier_id: row.entity_id ?? null,
      attachment_id: attachmentId,
      feature_index: f.featureIndex,
      plot_ref: f.plotRef,
      producer_name: f.producerName,
      commodity: f.commodity,
      country: f.country,
      geometry_type: f.geometryType,
      declared_area_ha: f.declaredAreaHa,
      computed_area_ha: f.computedAreaHa,
      centroid_lon: f.centroidLon,
      centroid_lat: f.centroidLat,
      bbox: f.bbox,
      geom_hash: f.geomHash,
      survey_date: f.surveyDate,
      survey_source: f.surveySource,
      is_current: true,
      created_by: profil?.email ?? auth.userId ?? null,
    }))

    const { error } = await admin.from('eudr_plots')
      .upsert(lignes, { onConflict: 'attachment_id,feature_index' })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })

    // Le contrôle qui justifie l'existence du référentiel : un même contour
    // déclaré par deux fournisseurs différents ne se voit qu'ici.
    const { data: doublons } = await admin.from('eudr_plots_doublons')
      .select('*').eq('org_id', orgId)
    const inter = (doublons ?? []).filter(d => (d.fournisseurs ?? 0) > 1)

    return NextResponse.json({
      versees: lignes.length,
      surfaceHa: +lignes.reduce((s, l) => s + Number(l.computed_area_ha ?? 0), 0).toFixed(4),
      doublonsInterFournisseurs: inter,
    })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}
