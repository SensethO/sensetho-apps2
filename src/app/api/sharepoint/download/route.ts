import { NextRequest, NextResponse } from 'next/server'
import { spGraph, spAuthCheck, assertSafeId } from '@/lib/sharepoint'

/* GET — proxy de téléchargement (cache la direct URL SharePoint) */
export async function GET(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const id = assertSafeId(req.nextUrl.searchParams.get('id'))
    // Récupère l'URL de téléchargement depuis Graph
    const meta = await spGraph(`/items/${id}?$select=name,@microsoft.graph.downloadUrl,file`)
    if (!meta.ok) {
      const d = await meta.json()
      return NextResponse.json({ error: d }, { status: meta.status })
    }
    const { name, '@microsoft.graph.downloadUrl': dlUrl, file } = await meta.json()
    if (!dlUrl) return NextResponse.json({ error: 'URL de téléchargement introuvable' }, { status: 404 })
    // Proxy le fichier
    const fileRes = await fetch(dlUrl, { cache: 'no-store' })
    const headers = new Headers()
    headers.set('Content-Type', file?.mimeType ?? 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`)
    const ct = fileRes.headers.get('Content-Length')
    if (ct) headers.set('Content-Length', ct)
    return new NextResponse(fileRes.body, { status: 200, headers })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
