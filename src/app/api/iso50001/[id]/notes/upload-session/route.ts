import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('iso50001_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * POST /api/iso50001/[id]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName, annexeIndex }
 * Règle absolue : aucun transit de fichier par Vercel.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (!actionKey) return NextResponse.json({ error: 'actionKey requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const diagnosticId = params.id
    const attachmentId = crypto.randomUUID()
    const safeName = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    // Préfixe atomique A001_ via fonction SQL
    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_iso50001_notes_counter', { p_id: diagnosticId })
    if (counterError || counterData == null) {
      console.error('[iso50001/notes/upload-session/counter]', counterError)
      return NextResponse.json({ error: 'Échec génération index annexe' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    const config = await getConfigForApp('iso50001-diagnostic')
    const spPath = `/root:/${config.rootFolder}/${diagnosticId}/notes/${actionKey}/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp('iso50001-diagnostic', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[iso50001/notes/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
