import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { trierGeojson } from '@/lib/eudr/screening'
import { chargerReferentiel, chargerAppariements } from './_referentiel'
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
  try {
    return NextResponse.json(await chargerReferentiel(orgId!, supplierId))
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

/**
 * PATCH { org_id, plotIds[], supplier_id | null } → rattache un lot de parcelles
 * à un fournisseur. Le versement hérite du fournisseur du fichier d'origine ; ce
 * rattachement manuel rattrape les fichiers déposés sans rattachement d'entité.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const orgId = String(body?.org_id ?? '')
  const auth = await guard(orgId, { requireEdit: true })
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const plotIds = Array.isArray(body?.plotIds) ? (body!.plotIds as unknown[]).map(String).filter(Boolean) : []
  if (!plotIds.length) return NextResponse.json({ error: 'plotIds requis' }, { status: 400 })
  const supplierId = body?.supplier_id ? String(body.supplier_id) : null

  const admin = createAdminClient()
  if (supplierId) {
    const { data: f } = await admin.from('eudr_suppliers')
      .select('id').eq('id', supplierId).eq('org_id', orgId).maybeSingle()
    if (!f) return NextResponse.json({ error: 'Fournisseur introuvable dans cette organisation.' }, { status: 404 })
  }

  const { data: profil } = await admin.from('profiles')
    .select('email').eq('id', auth.userId!).maybeSingle()
  const auteur = profil?.email ?? auth.userId ?? null

  // Qui a rattaché, et quand : un rattachement manuel n'a pas la même valeur
  // probante qu'un rattachement hérité du fichier, il doit se distinguer.
  const trace = {
    supplier_id: supplierId,
    supplier_assigned_at: new Date().toISOString(),
    supplier_assigned_by: auteur,
  }
  let res = await admin.from('eudr_plots').update(trace)
    .in('id', plotIds).eq('org_id', orgId).select('id')
  // Colonnes de traçabilité absentes (migration 20260831 non appliquée, cf. §12) :
  // le rattachement reste possible, seule sa provenance n'est pas consignée.
  if (res.error && (res.error.code === '42703' || /column .* does not exist/i.test(res.error.message))) {
    res = await admin.from('eudr_plots').update({ supplier_id: supplierId })
      .in('id', plotIds).eq('org_id', orgId).select('id')
  }
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 502 })

  return NextResponse.json({ modifiees: (res.data ?? []).length })
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

    // … et l'autre version du même fichier avec elles. Original et version
    // corrigée sont deux attachements distincts décrivant les mêmes terres :
    // les laisser tous deux dans le périmètre courant compterait deux fois les
    // mêmes surfaces et fausserait totaux comme contrôle du seuil de polygone.
    // Le versement le plus récent fait foi.
    const appariements = await chargerAppariements(orgId, admin)
    const appariement = appariements.get(attachmentId) ?? null
    const version = appariement?.version ?? 'en_etat'
    const autreId = appariement?.autreVersionId ?? null

    let autreVersion: {
      id: string
      name: string | null
      role: 'fichier_initial' | 'version_corrigee'
      parcellesRetirees: number
    } | null = null

    if (autreId) {
      const { data: retirees } = await admin.from('eudr_plots')
        .update({ is_current: false })
        .eq('org_id', orgId).eq('attachment_id', autreId).eq('is_current', true)
        .select('id')
      autreVersion = {
        id: autreId,
        name: appariements.get(autreId)?.name ?? null,
        role: version === 'corrigee' ? 'fichier_initial' : 'version_corrigee',
        parcellesRetirees: (retirees ?? []).length,
      }
    }

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

    // Dire d'où viennent les parcelles versées : « en l'état » et « version
    // corrigée » n'engagent pas la même chose vis-à-vis du fournisseur ni de la
    // déclaration déjà déposée.
    const surfaceHa = +lignes.reduce((s, l) => s + Number(l.computed_area_ha ?? 0), 0).toFixed(4)
    const retirees = autreVersion?.parcellesRetirees ?? 0

    let message: string
    if (version === 'corrigee') {
      message = `${lignes.length} parcelle(s) versée(s) depuis la version corrigée — ${surfaceHa} ha.`
        + (retirees
          ? ` Les ${retirees} parcelle(s) issues du fichier initial ont été retirées du périmètre courant.`
          : ' Aucune parcelle du fichier initial n’était au périmètre courant.')
    } else {
      message = `${lignes.length} parcelle(s) versée(s) en l’état — ${surfaceHa} ha.`
        + (retirees
          ? ` Les ${retirees} parcelle(s) issues de la version corrigée ont été retirées du périmètre courant :`
            + ' le référentiel porte désormais les géométries du fichier initial.'
          : '')
    }

    // Rappel réglementaire : le référentiel n'est pas la déclaration. Si la
    // géométrie retenue change, ce qui a déjà été transmis ne correspond plus.
    const rappel = version === 'corrigee'
      ? 'Le fichier initial doit être remplacé partout où il a été transmis — notamment dans la '
        + 'déclaration de diligence raisonnée déposée à TRACES et auprès du fournisseur. À défaut, '
        + 'la déclaration porterait sur des géométries différentes de celles du référentiel.'
      : (retirees
        ? 'Une version corrigée de ce fichier avait été versée : c’est désormais le fichier initial '
          + 'qui fait référence. Vérifiez que c’est bien la version voulue avant toute déclaration.'
        : null)

    return NextResponse.json({
      versees: lignes.length,
      surfaceHa,
      version,
      autreVersion,
      message,
      rappel,
      doublonsInterFournisseurs: inter,
    })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}
