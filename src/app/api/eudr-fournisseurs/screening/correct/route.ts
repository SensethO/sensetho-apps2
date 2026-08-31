import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { trierGeojson } from '@/lib/eudr/screening'
import { sanitizeGeojson, construireNoteCorrection, noteCorrectionEnTexte, CODES_REPARABLES } from '@/lib/eudr/geoSanitize'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const MOTEUR_VERSION = 'v1'

/** La colonne visée manque-t-elle en base (migration non appliquée) ? */
const colonneAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || /column .* does not exist/i.test(e.message ?? ''))

/**
 * POST { org_id, attachmentId } → corrige automatiquement les erreurs réparables
 * d'un fichier GeoJSON (trous, contours non refermés, auto-intersections, sommets
 * dupliqués, arrondi 6 décimales), dépose le fichier corrigé sur SharePoint avec
 * une NOTE de traçabilité intégrée (pourquoi / comment), et enregistre l'attachement
 * corrigé (lié à l'original). Le fichier d'origine est conservé intact.
 *
 * Les anomalies non réparables (précision insuffisante, hors-pays, point > 4 ha,
 * recouvrement, doublon exact) ne sont pas corrigées : elles restent à la charge
 * du fournisseur via la demande de révision.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const orgId = String(body?.org_id ?? '')
    const auth = await guard(orgId, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const attachmentId = String(body?.attachmentId ?? '')
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments')
      .select('sharepoint_item_id, name, entity_type, entity_id')
      .eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    let paysDeclare: string | null = null
    if (row.entity_id) {
      const { data: f } = await admin.from('eudr_suppliers')
        .select('country_origin').eq('id', row.entity_id).maybeSingle()
      paysDeclare = f?.country_origin ?? null
    }

    // — Télécharger le fichier d'origine depuis SharePoint
    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const parentId = (item.parentReference as { id?: string } | undefined)?.id
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url || !parentId) return NextResponse.json({ error: 'Emplacement du fichier indisponible' }, { status: 404 })

    const texte = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
    let brut: unknown = null
    try { brut = JSON.parse(texte) } catch { return NextResponse.json({ error: 'Fichier illisible : correction impossible.' }, { status: 400 }) }

    // — Tri avant : quelles anomalies réparables sont présentes ?
    const avant = trierGeojson(brut, { paysDeclare: paysDeclare ?? undefined })
    const reparables = avant.constats.map(c => c.code).filter(c => (CODES_REPARABLES as readonly string[]).includes(c))
    if (!reparables.length) {
      return NextResponse.json({ error: 'Aucune erreur corrigeable automatiquement sur ce fichier. Les anomalies restantes doivent être corrigées par le fournisseur.' }, { status: 409 })
    }

    // — Correction (nettoyage) + tri après
    const { geojson: corrige, report } = sanitizeGeojson(brut, { simplify: true })
    const apres = trierGeojson(corrige, { paysDeclare: paysDeclare ?? undefined })
    const codesApres = new Set(apres.constats.map(c => c.code))
    const codesResolus = Array.from(new Set(reparables)).filter(c => !codesApres.has(c))

    // — Note de traçabilité, intégrée au fichier corrigé (membre étranger GeoJSON)
    const note = construireNoteCorrection(report, codesResolus, row.name)
    const corrigeAvecNote = { ...(corrige as object), sensetho_correction: note }
    const noteTexte = noteCorrectionEnTexte(note)

    // — Nom du fichier corrigé (déterministe : une seule version corrigée par original)
    const base = row.name.replace(/\.(geojson|json)$/i, '')
    const ext = (row.name.match(/\.(geojson|json)$/i)?.[0]) ?? '.geojson'
    const nomCorrige = /\(corrigé\)/i.test(base) ? row.name : `${base} (corrigé)${ext}`

    // — Dépôt sur SharePoint (PUT content dans le dossier de l'original)
    const putPath = `/items/${parentId}:/${encodeURIComponent(nomCorrige)}:/content`
    const up = await spGraphForApp('eudr-fournisseurs', putPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corrigeAvecNote),
    })
    if (!up.ok) {
      const t = await up.text()
      return NextResponse.json({ error: 'Échec du dépôt du fichier corrigé sur SharePoint', detail: t }, { status: 502 })
    }
    const newItem = await up.json() as { id?: string; size?: number }
    if (!newItem.id) return NextResponse.json({ error: 'SharePoint n’a pas retourné l’identifiant du fichier corrigé' }, { status: 502 })

    const { data: profil } = await admin.from('profiles').select('email').eq('id', auth.userId!).maybeSingle()
    const createdBy = profil?.email ?? auth.userId ?? null

    // — Enregistrer l'attachement corrigé (une seule version corrigée par original,
    //   identifiée par son nom déterministe « … (corrigé) »). La note de traçabilité
    //   voyage avec le fichier (membre sensetho_correction) et est ré-émise à chaque tri.
    const champs = {
      org_id: orgId,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      doc_type: 'geojson',
      name: nomCorrige,
      sharepoint_item_id: newItem.id,
      mime: 'application/geo+json',
      size: newItem.size ?? null,
      created_by: createdBy,
    }
    const { data: existant } = await admin.from('eudr_attachments')
      .select('id').eq('org_id', orgId).eq('doc_type', 'geojson').eq('name', nomCorrige).maybeSingle()

    // Le lien vers l'original, écrit ici, évite d'avoir à le deviner plus tard :
    // c'est lui qui permet au versement de sortir l'autre version du périmètre
    // courant plutôt que de compter deux fois les mêmes terres.
    const avecOrigine = { ...champs, corrige_de: attachmentId }

    let newAttId: string
    if (existant) {
      let up = await admin.from('eudr_attachments').update(avecOrigine).eq('id', existant.id)
      if (colonneAbsente(up.error)) up = await admin.from('eudr_attachments').update(champs).eq('id', existant.id)
      newAttId = existant.id
    } else {
      let ins = await admin.from('eudr_attachments').insert(avecOrigine).select('id').single()
      // Migration 20260831_eudr_attachment_origine non appliquée (cf. §12) : le
      // rapprochement retombe sur le nom déterministe « … (corrigé) ».
      if (colonneAbsente(ins.error)) ins = await admin.from('eudr_attachments').insert(champs).select('id').single()
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 502 })
      newAttId = ins.data!.id
    }

    // — Historiser le tri du fichier corrigé
    await admin.from('eudr_geo_screening').insert({
      org_id: orgId,
      attachment_id: newAttId,
      pays_declare: paysDeclare,
      nb_parcelles: apres.nbParcelles,
      surface_ha: apres.surfaceTotaleHa,
      nb_bloquants: apres.constats.filter(c => c.gravite === 'bloquant').length,
      nb_alertes: apres.constats.filter(c => c.gravite === 'alerte').length,
      exploitable: apres.exploitable,
      constats: apres.constats,
      moteur_version: MOTEUR_VERSION,
      analyzed_by: createdBy,
    })

    return NextResponse.json({
      attachmentId: newAttId,
      name: nomCorrige,
      origineId: attachmentId,
      origineName: row.name,
      note,
      noteTexte,
      report,
      codesResolus,
      exploitable: apres.exploitable,
      constatsRestants: apres.constats.filter(c => c.gravite === 'bloquant').length,
    })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}
