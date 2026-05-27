export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { makeSvc, getUser } from '../_auth'
import { getSharePointDownloadUrl } from '@/lib/sharepointAppStorage'

// GET /api/agri/crm/download?path=xxx
// path = SharePoint item ID (sans "/") ou ancien chemin Supabase (avec "/")
export async function GET(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    // SharePoint item ID = pas de "/" dans le chemin
    if (!path.includes('/')) {
      const driveId = process.env.SHAREPOINT_DRIVE_ID!
      const url = await getSharePointDownloadUrl(driveId, path)
      return NextResponse.json({ url })
    }

    // Fallback legacy : ancien fichier stocké dans Supabase Storage (crm-docs)
    const svc = makeSvc()
    const { data, error } = await svc.storage.from('crm-docs').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
