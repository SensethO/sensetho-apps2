import { NextRequest, NextResponse } from 'next/server'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP = 'eudr-fournisseurs'

/**
 * POST { org_id, entity_type, entity_id, filename }
 * Crée une upload session SharePoint pour EUDR-FOURNISSEURS/{org}/{entity_type}/{entity_id}/{fichier}.
 * Le fichier est ensuite envoyé DIRECTEMENT par le navigateur vers SharePoint (aucun transit serveur).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; entity_type?: string; entity_id?: string; filename?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = body.entity_type === 'contract' ? 'contract' : body.entity_type === 'supplier' ? 'supplier' : null
    if (!entityType || !body.entity_id) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })
    if (!body.filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })

    const safeName = body.filename.replace(/[/\\:*?"<>|]/g, '_').trim()
    const config = await getConfigForApp(APP)
    const spPath = `/root:/${config.rootFolder}/${body.org_id}/${entityType}/${body.entity_id}/${safeName}:/createUploadSession`
    const spRes = await spGraphForApp(APP, spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename', name: safeName } }),
    })
    if (!spRes.ok) {
      const detail = await spRes.text()
      return NextResponse.json({ error: 'Échec upload session SharePoint', detail }, { status: 502 })
    }
    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, finalName: safeName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
