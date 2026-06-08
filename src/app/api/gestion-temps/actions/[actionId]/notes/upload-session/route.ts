import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

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
 * POST /api/gestion-temps/actions/[actionId]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName, annexeIndex }
 * Règle absolue : aucun transit de fichier par Vercel — direct navigateur → SharePoint.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const attachmentId = crypto.randomUUID()
    const safeName     = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    // Préfixe atomique A001_ via fonction SQL
    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_gt_action_notes_counter', { p_action_id: params.actionId })
    if (counterError || counterData == null) {
      console.error('[gestion-temps/notes/upload-session/counter]', counterError)
      return NextResponse.json({ error: 'Échec génération index annexe' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix    = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    const key   = actionKey ?? params.actionId
    const config = await getConfigForApp('gestion-temps')
    const spPath = `/root:/${config.rootFolder}/${params.actionId}/notes/${key}/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp('gestion-temps', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[gestion-temps/notes/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
