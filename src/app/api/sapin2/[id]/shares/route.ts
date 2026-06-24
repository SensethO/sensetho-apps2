import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'sapin2'
const TABLE = 'sapin2_diagnostics'

/** Seuls le propriétaire du diagnostic ou un admin gèrent les partages. */
async function canManage(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from(TABLE).select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/** GET /api/sapin2/[id]/shares — liste des partages */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: shares } = await admin
      .from('rse_diagnostic_shares')
      .select('id, shared_with_user_id, permission, created_at')
      .eq('app_slug', APP_SLUG)
      .eq('diagnostic_id', params.id)
      .order('created_at')

    // Récupère les emails des destinataires
    const ids = (shares ?? []).map(s => s.shared_with_user_id)
    let emails: Record<string, string> = {}
    if (ids.length) {
      const { data: profiles } = await admin.from('profiles').select('id, email').in('id', ids)
      emails = Object.fromEntries((profiles ?? []).map(p => [p.id, p.email]))
    }
    const data = (shares ?? []).map(s => ({ ...s, email: emails[s.shared_with_user_id] ?? '—' }))
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/sapin2/[id]/shares — body { email, permission } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, permission } = await req.json() as { email?: string; permission?: string }
    const cleanEmail = (email ?? '').trim().toLowerCase()
    if (!cleanEmail) return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    const perm = permission === 'edit' ? 'edit' : 'read'

    const admin = createAdminClient()
    const { data: target } = await admin.from('profiles').select('id, email').ilike('email', cleanEmail).maybeSingle()
    if (!target) return NextResponse.json({ error: "Aucun compte Sens'ethO avec cet email" }, { status: 404 })
    if (target.id === user.id) return NextResponse.json({ error: 'Vous êtes déjà propriétaire' }, { status: 400 })

    const { error } = await admin.from('rse_diagnostic_shares').upsert({
      app_slug: APP_SLUG,
      diagnostic_id: params.id,
      shared_with_user_id: target.id,
      permission: perm,
      created_by: user.id,
    }, { onConflict: 'app_slug,diagnostic_id,shared_with_user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/sapin2/[id]/shares?shareId=xxx */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const shareId = new URL(req.url).searchParams.get('shareId')
    if (!shareId) return NextResponse.json({ error: 'shareId requis' }, { status: 400 })

    const admin = createAdminClient()
    await admin.from('rse_diagnostic_shares').delete()
      .eq('id', shareId).eq('app_slug', APP_SLUG).eq('diagnostic_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
