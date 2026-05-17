import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  return share?.permission === 'edit'
}

/** POST /api/guided-diagnostic/[id]/notes/upload */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const action_key = formData.get('action_key') as string | null

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (!action_key) return NextResponse.json({ error: 'action_key required' }, { status: 400 })

    const diagnosticId = params.id
    const filename = file.name
    const arrayBuffer = await file.arrayBuffer()

    // Créer le dossier parent {rootFolder}/{diagnosticId}/{action_key} si inexistant
    // On tente l'upload directement via le path — Graph crée les dossiers intermédiaires automatiquement
    // via la syntaxe :/path:/content
    const config = await getConfigForApp('guided-diagnostic')
    const uploadPath = `/root:/${config.rootFolder}/${diagnosticId}/${action_key}/${filename}:/content`

    const uploadRes = await spGraphForApp('guided-diagnostic', uploadPath, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: arrayBuffer,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('[upload/sharepoint] error', uploadRes.status, errText)
      return NextResponse.json({ error: 'SharePoint upload failed', detail: errText }, { status: 502 })
    }

    const spItem = await uploadRes.json() as { id: string; name: string; size: number; file?: { mimeType?: string } }
    const sharepoint_item_id = spItem.id
    const mime = file.type || null
    const size = file.size

    // Insérer en DB
    const admin = createAdminClient()
    const { data: row, error: dbErr } = await admin
      .from('guided_action_attachments')
      .insert({
        diagnostic_id: diagnosticId,
        action_key,
        name: filename,
        sharepoint_item_id,
        mime,
        size,
      })
      .select('id, name, sharepoint_item_id, mime, size')
      .single()

    if (dbErr) {
      console.error('[upload/db] error', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
