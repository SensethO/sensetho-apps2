import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

type Params = { params: { actionId: string } }

async function canWrite(userId: string, actionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', actionId).single()
  if (!action) return false
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', action.project_id).single()
  if (!project) return false
  if (project.owner_id === userId) return true
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', action.project_id).eq('user_id', userId).maybeSingle()
  return member?.role === 'editor'
}

/**
 * DELETE /api/gestion-temps/actions/[actionId]/notes/attachment?attachment_id=xxx
 * Cherche le sharepoint_item_id dans les sections JSON et supprime le fichier de SharePoint.
 * La mise à jour des sections JSON dans gt_action_notes se fait via PUT /notes (panel côté client).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const attachmentId = req.nextUrl.searchParams.get('attachment_id')
    if (!attachmentId) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })

    // Trouver le sharepoint_item_id dans les sections JSON
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('gt_action_notes')
      .select('sections')
      .eq('action_id', params.actionId)
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
      // Supprimer de SharePoint (204 = OK, 404 = déjà supprimé → on continue)
      const spRes = await spGraphForApp('gestion-temps', `/items/${spItemId}`, { method: 'DELETE' })
      if (!spRes.ok && spRes.status !== 404) {
        const errText = await spRes.text()
        console.error('[gestion-temps/notes/attachment/delete/sp]', spRes.status, errText)
        // On ne bloque pas — les métadonnées seront nettoyées via PUT sections
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
