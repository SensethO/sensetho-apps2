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

/**
 * POST /api/guided-diagnostic/[id]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size }
 * Returns: { id, name, sharepoint_item_id, mime, size }
 *
 * Inserts a confirmed attachment into guided_action_attachments.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      actionKey?: string
      attachmentId?: string
      spItemId?: string
      name?: string
      mime?: string
      size?: number
    }

    const { actionKey, attachmentId, spItemId, name, mime, size } = body

    if (!actionKey) return NextResponse.json({ error: 'actionKey required' }, { status: 400 })
    if (!spItemId) return NextResponse.json({ error: 'spItemId required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const admin = createAdminClient()

    // Use provided attachmentId if valid UUID, otherwise generate a new one
    const id = attachmentId ?? crypto.randomUUID()

    const { data: row, error: dbErr } = await admin
      .from('guided_action_attachments')
      .insert({
        id,
        diagnostic_id: params.id,
        action_key: actionKey,
        name,
        sharepoint_item_id: spItemId,
        mime: mime ?? null,
        size: size ?? null,
      })
      .select('id, name, sharepoint_item_id, mime, size')
      .single()

    if (dbErr) {
      console.error('[upload-confirm/db] error', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
