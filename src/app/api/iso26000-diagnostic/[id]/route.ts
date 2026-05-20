import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


async function getAccessLevel(userId: string, diagnosticId: string): Promise<'owner' | 'editor' | 'reader' | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id, iso26000_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return null
  if (data.user_id === userId) return 'owner'
  const shares = (data as Record<string, unknown>).iso26000_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  if (!share) return null
  return share.permission === 'edit' ? 'editor' : 'reader'
}

/** PATCH /api/iso26000-diagnostic/[id] — sauvegarder scores, progress, na, secteur */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const access = await getAccessLevel(user.id, params.id)
    if (!access || access === 'reader') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['scores', 'action_progress', 'action_na',
                     'ai_analysis', 'ai_scores', 'ai_generated_at']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('iso26000_diagnostics')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
