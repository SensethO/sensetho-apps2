/**
 * GET /api/sharepoint/thumbnail?item_id=xxx&app=guided-diagnostic
 *
 * Retourne l'URL de thumbnail d'un fichier SharePoint via Microsoft Graph.
 * Supporte : PDF (1ère page), images, vidéos, documents Office.
 * L'URL retournée est une URL CDN Microsoft directe (aucun transit Vercel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('item_id')
    const app = searchParams.get('app') ?? 'guided-diagnostic'

    if (!itemId) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    // Appel Graph : GET /items/{itemId}/thumbnails/0/medium
    const res = await spGraphForApp(app, `/items/${itemId}/thumbnails/0/medium`)

    if (!res.ok) {
      // Fichier non prévisualisable (ex: format non supporté)
      return NextResponse.json({ url: null, error: `SP ${res.status}` }, { status: 200 })
    }

    const data = await res.json() as {
      url?: string
      width?: number
      height?: number
    }

    return NextResponse.json({ url: data.url ?? null })
  } catch (err) {
    console.error('[sharepoint/thumbnail]', err)
    return NextResponse.json({ url: null, error: String(err) }, { status: 200 })
  }
}
