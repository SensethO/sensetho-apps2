export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getUser } from '../_auth'
import { getSharePointDownloadUrl } from '@/lib/sharepointAppStorage'

// GET /api/agri/crm/download?path=xxx
// path = SharePoint item ID (sans "/") — seul format accepté
// Tout stockage passe exclusivement par SharePoint (aucun transit Supabase/Vercel)
export async function GET(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    // Rejeter tout chemin qui n'est pas un item ID SharePoint
    if (path.includes('/')) {
      return NextResponse.json({ error: 'Format de chemin invalide — seuls les item IDs SharePoint sont acceptés' }, { status: 400 })
    }

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const url = await getSharePointDownloadUrl(driveId, path)
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
