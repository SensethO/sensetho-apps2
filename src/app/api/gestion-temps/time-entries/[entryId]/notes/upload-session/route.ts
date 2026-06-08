import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

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
 * POST /api/gestion-temps/time-entries/[entryId]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName, annexeIndex }
 * Règle absolue : aucun transit de fichier par Vercel — direct navigateur → SharePoint.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.entryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const attachmentId = crypto.randomUUID()
    const safeName     = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    // Préfixe atomique A001_ via fonction SQL
    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_gt_time_entry_notes_counter', { p_entry_id: params.entryId })
    if (counterError || counterData == null) {
      console.error('[gestion-temps/time-entries/notes/upload-session/counter]', counterError)
      return NextResponse.json({ error: 'Échec génération index annexe' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix    = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    const key    = actionKey ?? params.entryId
    const config = await getConfigForApp('gestion-temps')
    const spPath = `/root:/${config.rootFolder}/${params.entryId}/notes/${key}/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp('gestion-temps', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[gestion-temps/time-entries/notes/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
