/**
 * GET /api/agri/photos/[id]/action-notes/[key]/signed-url?path=SHAREPOINT_ITEM_ID
 * Returns a pre-authenticated download URL (~1h validity).
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { getSharePointDownloadUrl } from '@/lib/sharepointAppStorage'

type Params = { params: Promise<{ id: string; key: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    await params // consume params (not needed for this route but required signature)

    const url = new URL(req.url)
    const path = url.searchParams.get('path')?.trim()
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    if (!driveId) return NextResponse.json({ error: 'SHAREPOINT_DRIVE_ID non configuré' }, { status: 500 })

    const signedUrl = await getSharePointDownloadUrl(driveId, path)
    return NextResponse.json({ url: signedUrl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
