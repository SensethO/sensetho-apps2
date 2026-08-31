import { NextRequest, NextResponse } from 'next/server'
import { spGraph, spAuthCheck, assertSafeId } from '@/lib/sharepoint'

/**
 * GET — téléchargement d'un fichier SharePoint.
 *
 * Mise en conformité du 2026-08-30 (docs/RSE_APP_PATTERN.md §11) : cette route
 * proxifiait le corps du fichier (`new NextResponse(fileRes.body)`), donc TOUS
 * les octets traversaient Vercel. Elle redirige désormais vers l'URL signée
 * Microsoft : le navigateur télécharge directement chez Microsoft, et la
 * plateforme ne voit plus passer aucun octet.
 *
 * Les appelants (FileUpload, SharePointBrowser) n'ont rien à changer : ils
 * pointent toujours un lien vers cette route, le navigateur suit la redirection.
 * L'URL Graph exposée est signée et temporaire (~1 h), comme toutes les URL
 * servies par les routes `signed-url` de la plateforme.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const id = assertSafeId(req.nextUrl.searchParams.get('id'))
    const meta = await spGraph(`/items/${id}?$select=name,@microsoft.graph.downloadUrl,file`)
    if (!meta.ok) {
      const d = await meta.json()
      return NextResponse.json({ error: d }, { status: meta.status })
    }
    const { '@microsoft.graph.downloadUrl': dlUrl } = await meta.json()
    if (!dlUrl) return NextResponse.json({ error: 'URL de téléchargement introuvable' }, { status: 404 })

    // 302 : le navigateur va chercher le fichier chez Microsoft, pas chez nous.
    return NextResponse.redirect(dlUrl, { status: 302 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
