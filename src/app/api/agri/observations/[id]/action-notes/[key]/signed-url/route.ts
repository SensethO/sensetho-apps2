/**
 * GET /api/agri/observations/[id]/action-notes/[key]/signed-url?path=SHAREPOINT_ITEM_ID
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { getSharePointDownloadUrl } from '@/lib/sharepointAppStorage'

type Params = { params: Promise<{ id: string; key: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    await params
    const url = new URL(req.url)
    const path = url.searchParams.get('path')?.trim()
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const signedUrl = await getSharePointDownloadUrl(driveId, path)
    return NextResponse.json({ url: signedUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
