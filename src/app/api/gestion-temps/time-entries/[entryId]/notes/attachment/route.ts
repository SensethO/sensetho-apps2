import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

type Params = { params: { entryId: string } }

async function canWrite(userId: string, entryId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: entry } = await admin.from('gt_time_entries').select('user_id, project_id').eq('id', entryId).single()
  if (!entry) return false
  if (entry.user_id === userId) return true
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', entry.project_id).single()
  if (project?.owner_id === userId) return true
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', entry.project_id).eq('user_id', userId).maybeSingle()
  return member?.role === 'editor'
}

/**
 * DELETE /api/gestion-temps/time-entries/[entryId]/notes/attachment?attachment_id=xxx
 * Supprime la pièce jointe de SharePoint.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.entryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const attachmentId = req.nextUrl.searchParams.get('attachment_id')
    if (!attachmentId) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })

    // Trouver le sharepoint_item_id dans les sections JSON
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('gt_time_entry_notes')
      .select('sections')
      .eq('entry_id', params.entryId)
      .maybeSingle()

    let spItemId: string | null = null
    if (row?.sections) {
      const sections = row.sections as Array<{ id: string; attachments?: Array<{ id: string; path: string }> }>
      for (const section of sections) {
        const att = section.attachments?.find(a => a.id === attachmentId)
        if (att) { spItemId = att.path; break }
      }
    }

    if (spItemId) {
      const spRes = await spGraphForApp('gestion-temps', `/items/${spItemId}`, { method: 'DELETE' })
      if (!spRes.ok && spRes.status !== 404) {
        const errText = await spRes.text()
        console.error('[gestion-temps/time-entries/notes/attachment/delete/sp]', spRes.status, errText)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
