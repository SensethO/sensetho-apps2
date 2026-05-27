/**
 * GET /api/agri/photos/signed-url?item_id={sharepoint_item_id}
 * Retourne une URL pré-authentifiée (~1h) pour visualiser une photo SharePoint.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { getSharePointDownloadUrl } from '@/lib/sharepointAppStorage'

export async function GET(request: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item_id')
    if (!itemId) {
      return NextResponse.json({ error: 'item_id manquant' }, { status: 400 })
    }

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const url = await getSharePointDownloadUrl(driveId, itemId)

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
