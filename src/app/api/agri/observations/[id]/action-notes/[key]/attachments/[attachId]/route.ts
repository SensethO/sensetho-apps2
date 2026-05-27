/**
 * DELETE /api/agri/observations/[id]/action-notes/[key]/attachments/[attachId]
 * Body: { path: string } — SharePoint item ID
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { deleteSharePointItem } from '@/lib/sharepointAppStorage'

type Params = { params: Promise<{ id: string; key: string; attachId: string }> }

interface AttachmentMeta { id: string; name: string; path: string; mime: string; size: number }
interface NoteSection { id: string; title: string; content: string; attachments: AttachmentMeta[] }

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id: observationId, attachId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

    const svc = createAdminClient()
    const { data: row } = await svc
      .from('agri_observation_notes')
      .select('notes_sections')
      .eq('observation_id', observationId)
      .maybeSingle()

    const currentSections: NoteSection[] = row?.notes_sections ?? []
    const updatedSections = currentSections.map(s => ({
      ...s,
      attachments: s.attachments.filter(a => a.id !== attachId),
    }))

    await svc
      .from('agri_observation_notes')
      .update({ notes_sections: updatedSections, updated_at: new Date().toISOString() })
      .eq('observation_id', observationId)

    try {
      const driveId = process.env.SHAREPOINT_DRIVE_ID!
      if (driveId && path) await deleteSharePointItem(driveId, path)
    } catch { /* silencieux */ }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
