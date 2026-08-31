import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../traces/_auth'
import { journaliser } from '@/lib/eudr/fichiers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id&entity_type&entity_id — liste les documents d'une entité (fournisseur/contrat). */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = sp.get('entity_type')
    const entityId = sp.get('entity_id')
    if (!entityType || !entityId) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })

    const admin = createAdminClient()
    // Les documents retirés restent en base et sur SharePoint ; ils sortent de
    // l'usage courant, et ne reviennent qu'avec ?inclure_retires=1 (dossier d'audit).
    let q = admin.from('eudr_attachments')
      .select('id, name, base_name, version_num, doc_type, mime, size, created_at, retire_le, retire_motif')
      .eq('org_id', orgId).eq('entity_type', entityType).eq('entity_id', entityId)
    if (sp.get('inclure_retires') !== '1') q = q.is('retire_le', null)
    const { data } = await q.order('created_at', { ascending: false })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * DELETE ?org_id&id[&motif] — RETRAIT LOGIQUE, jamais une suppression.
 *
 * Depuis le 2026-09-01 les fichiers EUDR sont immuables : le document est masqué
 * de l'usage courant, mais le fichier reste sur SharePoint et sa ligne reste en
 * base. Article 33 du règlement (UE) 2023/1115 — cinq ans de conservation ; une
 * pièce détruite ne se reconstitue pas, et son absence ne se remarque qu'au
 * contrôle.
 *
 * Un document déjà transmis à TRACES ne peut pas même être retiré : la
 * déclaration deviendrait orpheline de sa pièce justificative.
 */
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const id = sp.get('id')
    const auth = await guard(orgId, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments')
      .select('id, name, version_num, retire_le').eq('id', id).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    if (row.retire_le) return NextResponse.json({ ok: true, deja: true })

    // Verrou : pièce jointe à une déclaration déposée.
    const { data: dds } = await admin.from('eudr_dds')
      .select('reference_number, dds_uuid').eq('org_id', orgId).eq('geojson_attachment_id', id).limit(1)
    if (dds && dds.length) {
      const ref = (dds[0].reference_number as string | null) ?? (dds[0].dds_uuid as string)
      await journaliser({
        orgId: orgId!, attachmentId: id, nom: row.name as string,
        versionNum: (row.version_num as number | null) ?? null,
        evenement: 'suppression_refusee',
        detail: { motif: 'document transmis dans une DDS', declaration: ref },
        acteur: auth.userId,
      })
      return NextResponse.json({
        error: `Ce fichier a été transmis à TRACES dans la déclaration ${ref}. Il ne peut être ni retiré ni supprimé :`
          + ' la déclaration doit rester rattachée à la pièce qui l’a alimentée (art. 33, conservation cinq ans).'
          + ' Pour corriger les géométries, déposez une nouvelle version — elle prendra le numéro suivant.',
      }, { status: 409 })
    }

    // Retrait logique : SharePoint n'est pas touché.
    const motif = sp.get('motif')?.trim() || null
    await admin.from('eudr_attachments')
      .update({ retire_le: new Date().toISOString(), retire_par: auth.userId, retire_motif: motif })
      .eq('id', id).eq('org_id', orgId)
    await journaliser({
      orgId: orgId!, attachmentId: id, nom: row.name as string,
      versionNum: (row.version_num as number | null) ?? null,
      evenement: 'retrait_logique', detail: { motif }, acteur: auth.userId,
    })
    return NextResponse.json({ ok: true, retireLogiquement: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
