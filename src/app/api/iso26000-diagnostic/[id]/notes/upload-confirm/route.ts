import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id, iso26000_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).iso26000_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  return share?.permission === 'edit'
}

/**
 * POST /api/iso26000-diagnostic/[id]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size }
 * Returns: { id, name, sharepoint_item_id, mime, size }
 *
 * Inserts a confirmed attachment into iso26000_attachments.
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
      annexeIndex?: number
    }

    const { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex } = body

    if (!actionKey) return NextResponse.json({ error: 'actionKey required' }, { status: 400 })
    if (!spItemId) return NextResponse.json({ error: 'spItemId required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const admin = createAdminClient()

    // Use provided attachmentId if valid UUID, otherwise generate a new one
    const id = attachmentId ?? crypto.randomUUID()

    const { data: row, error: dbErr } = await admin
      .from('iso26000_attachments')
      .insert({
        id,
        diagnostic_id: params.id,
        action_key: actionKey,
        name,
        sharepoint_item_id: spItemId,
        mime: mime ?? null,
        size: size ?? null,
        annexe_index: annexeIndex ?? null,
      })
      .select('id, name, sharepoint_item_id, mime, size, annexe_index')
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
