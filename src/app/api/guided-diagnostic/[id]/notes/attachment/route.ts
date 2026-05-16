import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraph } from '@/lib/sharepoint'

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

/** PATCH /api/guided-diagnostic/[id]/notes/attachment?attachment_id=xxx
 *  Body: { fileName: string }
 *  Renames the attachment in DB and on SharePoint.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

    const body = await req.json() as { fileName?: string }
    const { fileName } = body
    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row, error: fetchErr } = await admin
      .from('guided_action_attachments')
      .select('sharepoint_item_id')
      .eq('id', attachment_id)
      .eq('diagnostic_id', params.id)
      .single()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Rename on SharePoint
    const spRes = await spGraph(`/items/${row.sharepoint_item_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName }),
    })

    if (!spRes.ok && spRes.status !== 404) {
      const errText = await spRes.text()
      console.error('[attachment/rename/sharepoint] error', spRes.status, errText)
      return NextResponse.json({ error: 'SharePoint rename failed', detail: errText }, { status: 502 })
    }

    // Update in DB
    const { error: updErr } = await admin
      .from('guided_action_attachments')
      .update({ name: fileName })
      .eq('id', attachment_id)
      .eq('diagnostic_id', params.id)

    if (updErr) {
      console.error('[attachment/rename/db] error', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, name: fileName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/guided-diagnostic/[id]/notes/attachment?attachment_id=xxx */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

    // Récupérer le sharepoint_item_id depuis la DB
    const admin = createAdminClient()
    const { data: row, error: fetchErr } = await admin
      .from('guided_action_attachments')
      .select('sharepoint_item_id')
      .eq('id', attachment_id)
      .eq('diagnostic_id', params.id)
      .single()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Supprimer de SharePoint
    const spRes = await spGraph(`/items/${row.sharepoint_item_id}`, { method: 'DELETE' })
    // 204 = No Content = succès, 404 = déjà supprimé → on continue quand même
    if (!spRes.ok && spRes.status !== 404) {
      const errText = await spRes.text()
      console.error('[attachment/delete/sharepoint] error', spRes.status, errText)
      return NextResponse.json({ error: 'SharePoint delete failed', detail: errText }, { status: 502 })
    }

    // Supprimer de la DB
    const { error: delErr } = await admin
      .from('guided_action_attachments')
      .delete()
      .eq('id', attachment_id)
      .eq('diagnostic_id', params.id)

    if (delErr) {
      console.error('[attachment/delete/db] error', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
