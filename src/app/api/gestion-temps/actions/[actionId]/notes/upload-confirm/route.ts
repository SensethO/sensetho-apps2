import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
 * POST /api/gestion-temps/actions/[actionId]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex }
 * Le fichier est déjà sur SharePoint — on retourne juste les métadonnées pour le client.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      actionKey?:    string
      attachmentId?: string
      spItemId?:     string
      name?:         string
      mime?:         string
      size?:         number
      annexeIndex?:  number
    }
    const { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex } = body
    if (!spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    if (!name)     return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const id = attachmentId ?? crypto.randomUUID()

    return NextResponse.json({
      data: {
        id,
        name,
        sharepoint_item_id: spItemId,
        mime:        mime ?? null,
        size:        size ?? null,
        annexe_index: annexeIndex ?? null,
        action_key:  actionKey ?? null,
        action_id:   params.actionId,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
