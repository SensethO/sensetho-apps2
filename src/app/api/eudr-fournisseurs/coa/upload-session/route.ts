import { NextRequest, NextResponse } from 'next/server'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP = 'eudr-fournisseurs'

/**
 * POST { org_id, coa_id, filename, kind }
 * Crée une upload session SharePoint pour EUDR-FOURNISSEURS/{org}/coa/{coa_id}/{kind}/{fichier}.
 * Le navigateur envoie ensuite le fichier DIRECTEMENT à SharePoint (aucun transit serveur).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; coa_id?: string; filename?: string; kind?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.coa_id || !body.filename) return NextResponse.json({ error: 'coa_id et filename requis' }, { status: 400 })
    const kind = body.kind === 'client_demand' ? 'client_demand' : 'coa'

    const safeName = body.filename.replace(/[/\\:*?"<>|]/g, '_').trim()
    const config = await getConfigForApp(APP)
    const spPath = `/root:/${config.rootFolder}/${body.org_id}/coa/${body.coa_id}/${kind}/${safeName}:/createUploadSession`
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
