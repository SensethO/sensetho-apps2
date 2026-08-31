import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { guard } from '../../traces/_auth'
import { baseDe, versionDe, journaliser } from '@/lib/eudr/fichiers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DOC_TYPES = ['geojson', 'questionnaire', 'certificate', 'ddr', 'dds', 'other']

/**
 * POST { org_id, entity_type, entity_id, spItemId, mime, size, doc_type }
 * Enregistre les métadonnées d'un fichier déjà déposé sur SharePoint.
 *
 * Le nom N'EST PAS pris dans la requête : il est relu sur SharePoint à partir de
 * `spItemId`. C'est la seule façon d'être certain que la base enregistre le nom du
 * fichier réel — un client qui se tromperait, ou mentirait, ne peut pas décaler
 * la traçabilité. Le chemin est figé au passage, pour le contrôle d'intégrité.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      org_id?: string; entity_type?: string; entity_id?: string
      spItemId?: string; name?: string; mime?: string; size?: number; doc_type?: string
    }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = body.entity_type === 'contract' ? 'contract' : body.entity_type === 'supplier' ? 'supplier' : null
    if (!entityType || !body.entity_id) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })
    if (!body.spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    const docType = DOC_TYPES.includes(body.doc_type ?? '') ? body.doc_type! : 'other'

    // Nom et chemin RÉELS, lus à la source.
    let nomReel = body.name ?? null
    let spPath: string | null = null
    let tailleReelle: number | null = body.size ?? null
    const itemRes = await spGraphForApp('eudr-fournisseurs',
      `/items/${body.spItemId}?$select=name,size,parentReference`)
    if (itemRes.ok) {
      const item = await itemRes.json() as { name?: string; size?: number; parentReference?: { path?: string } }
      if (item.name) nomReel = item.name
      if (typeof item.size === 'number') tailleReelle = item.size
      // parentReference.path : « /drives/{id}/root:/Documents partages/EUDR-FOURNISSEURS/… »
      const dossier = (item.parentReference?.path ?? '').replace(/^.*root:\//, '')
      if (dossier && item.name) spPath = `${dossier}/${item.name}`
    }
    if (!nomReel) return NextResponse.json({ error: 'Nom du fichier introuvable sur SharePoint' }, { status: 502 })

    const admin = createAdminClient()
    const { data, error } = await admin.from('eudr_attachments').insert({
      org_id: body.org_id,
      entity_type: entityType,
      entity_id: body.entity_id,
      doc_type: docType,
      name: nomReel,
      base_name: baseDe(nomReel),
      version_num: versionDe(nomReel),
      sp_path: spPath,
      sharepoint_item_id: body.spItemId,
      mime: body.mime ?? null,
      size: tailleReelle,
      created_by: auth.userId,
    }).select('id, name, base_name, version_num, doc_type, mime, size, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await journaliser({
      orgId: body.org_id!,
      attachmentId: data.id as string,
      nom: nomReel,
      versionNum: (data.version_num as number | null) ?? null,
      evenement: 'depot',
      detail: { entity_type: entityType, entity_id: body.entity_id, doc_type: docType, sp_path: spPath },
      acteur: auth.userId,
    })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
