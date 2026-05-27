/**
 * PATCH /api/agri/photos/[id]  → update photo fields
 * DELETE /api/agri/photos/[id] → delete a photo (DB + SharePoint)
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { deleteSharePointItem } from '@/lib/sharepointAppStorage'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    // Get photo to verify ownership
    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id')
      .eq('id', id)
      .single()

    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    // Verify plantation ownership
    const { data: plantation } = await serviceClient
      .from('plantations')
      .select('user_id')
      .eq('id', photo.plantation_id)
      .single()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation?.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const allowedFields: Record<string, unknown> = {}
    const fields = ['date_prise', 'champ_id', 'type_sujet', 'produit', 'commentaire', 'latitude', 'longitude', 'filename']
    for (const f of fields) {
      if (f in body) allowedFields[f] = body[f]
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from('photos_terrain')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw new Error(updateErr.message)
    return NextResponse.json({ photo: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    // Get photo to find SharePoint item ID and plantation_id
    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id, url_sharepoint')
      .eq('id', id)
      .single()

    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    // Verify plantation ownership
    const { data: plantation } = await serviceClient
      .from('plantations')
      .select('user_id')
      .eq('id', photo.plantation_id)
      .single()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation?.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Delete from SharePoint if it's an item ID (no slash = SharePoint item ID)
    if (photo.url_sharepoint && !photo.url_sharepoint.includes('/')) {
      try {
        const driveId = process.env.SHAREPOINT_DRIVE_ID!
        if (driveId) await deleteSharePointItem(driveId, photo.url_sharepoint)
      } catch { /* silencieux si déjà supprimé */ }
    }

    // Delete from DB
    const { error: deleteErr } = await serviceClient
      .from('photos_terrain')
      .delete()
      .eq('id', id)

    if (deleteErr) throw new Error(deleteErr.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
