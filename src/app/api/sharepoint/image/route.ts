/**
 * GET /api/sharepoint/image?item_id=xxx&app=guided-diagnostic
 *
 * Proxy de fichier SharePoint pour visualisation inline (PDFs, images).
 * Retourne le contenu avec Content-Disposition: inline pour permettre
 * l'affichage dans un <iframe> ou <img>.
 *
 * Note : les fichiers passent par ce proxy — réservé aux fichiers légers
 * (< 10 MB recommandé). Pour les gros fichiers, utiliser le lien direct SP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('item_id')
    const app = searchParams.get('app') ?? 'guided-diagnostic'

    if (!itemId) return new NextResponse('item_id requis', { status: 400 })

    // 1. Récupérer les métadonnées + URL de téléchargement
    const metaRes = await spGraphForApp(app, `/items/${itemId}`)
    if (!metaRes.ok) return new NextResponse('Fichier non trouvé', { status: 404 })

    const meta = await metaRes.json() as Record<string, unknown>
    const downloadUrl = meta['@microsoft.graph.downloadUrl'] as string | undefined
    const mimeType = (meta.file as Record<string, string> | undefined)?.mimeType ?? 'application/octet-stream'
    const fileName = meta.name as string | undefined ?? 'file'

    if (!downloadUrl) return new NextResponse('URL non disponible', { status: 502 })

    // 2. Télécharger le contenu depuis SharePoint (CDN direct)
    const fileRes = await fetch(downloadUrl)
    if (!fileRes.ok) return new NextResponse('Erreur téléchargement', { status: 502 })

    const body = await fileRes.arrayBuffer()

    // 3. Retourner avec Content-Disposition: inline pour prévisualisation
    return new NextResponse(body, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch (err) {
    console.error('[sharepoint/image]', err)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
