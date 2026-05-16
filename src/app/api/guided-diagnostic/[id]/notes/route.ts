import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function canRead(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ shared_with_user_id: string }> | undefined
  return shares?.some(s => s.shared_with_user_id === userId) ?? false
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

interface Attachment {
  id: string
  name: string
  sharepoint_item_id: string
  mime: string | null
  size: number | null
}

/** GET /api/guided-diagnostic/[id]/notes — charger toutes les notes + attachments */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canRead(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [notesResult, attachmentsResult] = await Promise.all([
      admin
        .from('guided_action_notes')
        .select('action_key, content, updated_at')
        .eq('diagnostic_id', params.id),
      admin
        .from('guided_action_attachments')
        .select('id, action_key, name, sharepoint_item_id, mime, size')
        .eq('diagnostic_id', params.id),
    ])

    const notes: Record<string, string> = {}
    for (const row of (notesResult.data ?? [])) notes[row.action_key] = row.content

    const attachments: Record<string, Attachment[]> = {}
    for (const row of (attachmentsResult.data ?? [])) {
      if (!attachments[row.action_key]) attachments[row.action_key] = []
      attachments[row.action_key].push({
        id: row.id,
        name: row.name,
        sharepoint_item_id: row.sharepoint_item_id,
        mime: row.mime,
        size: row.size,
      })
    }

    return NextResponse.json({ data: { notes, attachments } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT /api/guided-diagnostic/[id]/notes — upsert une note */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { action_key, content } = await req.json()
    if (!action_key) return NextResponse.json({ error: 'action_key required' }, { status: 400 })

    const admin = createAdminClient()
    await admin
      .from('guided_action_notes')
      .upsert({ diagnostic_id: params.id, action_key, content: content ?? '' },
               { onConflict: 'diagnostic_id,action_key' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
