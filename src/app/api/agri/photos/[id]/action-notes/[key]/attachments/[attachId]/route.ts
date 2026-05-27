/**
 * DELETE /api/agri/photos/[id]/action-notes/[key]/attachments/[attachId]
 * Body: { path: string } — SharePoint item ID
 * Removes attachment from notes_sections and deletes from SharePoint.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { deleteSharePointItem } from '@/lib/sharepointAppStorage'

type Params = { params: Promise<{ id: string; key: string; attachId: string }> }

interface AttachmentMeta {
  id: string
  name: string
  path: string
  mime: string
  size: number
}

interface NoteSection {
  id: string
  title: string
  content: string
  attachments: AttachmentMeta[]
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id: photoId, attachId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    const serviceClient = createAdminClient()

    // Get photo + verify ownership
    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id, notes_sections')
      .eq('id', photoId)
      .single()

    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

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

    // Remove attachment from all sections
    const currentSections: NoteSection[] = photo.notes_sections ?? []
    const updatedSections = currentSections.map((section) => ({
      ...section,
      attachments: section.attachments.filter((a) => a.id !== attachId),
    }))

    // Update DB
    const { error: updateErr } = await serviceClient
      .from('photos_terrain')
      .update({ notes_sections: updatedSections })
      .eq('id', photoId)

    if (updateErr) throw new Error(updateErr.message)

    // Delete from SharePoint (silently ignore errors)
    try {
      const driveId = process.env.SHAREPOINT_DRIVE_ID!
      if (driveId && path) await deleteSharePointItem(driveId, path)
    } catch { /* silencieux */ }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
