import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


async function assertOwner(userId: string, diagnosticId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id')
    .eq('id', diagnosticId)
    .single()
  return data?.user_id === userId
}

/** GET /api/guided-diagnostic/[id]/shares — liste des partages */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await assertOwner(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data } = await admin
      .from('guided_diagnostic_shares')
      .select('id, permission, created_at, shared_with_user_id, profiles!shared_with_user_id(email, full_name)')
      .eq('diagnostic_id', params.id)

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/guided-diagnostic/[id]/shares — partager avec un email */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await assertOwner(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, permission = 'read' } = await req.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const admin = createAdminClient()

    // Trouver le profil cible
    const { data: target } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle()

    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (target.id === user.id) return NextResponse.json({ error: 'Vous ne pouvez pas vous partager à vous-même' }, { status: 400 })

    // Vérifier que la cible a un abonnement actif
    const { data: sub } = await admin
      .from('app_subscriptions')
      .select('id, expires_at, apps!inner(slug)')
      .eq('apps.slug', 'diagnostic-initial')
      .eq('user_id', target.id)
      .eq('status', 'active')
      .maybeSingle()

    const targetProfile = await admin.from('profiles').select('role').eq('id', target.id).single()
    const isAdmin = targetProfile.data?.role === 'admin'
    const hasValidSub = sub && (!sub.expires_at || new Date(sub.expires_at) > new Date())

    if (!isAdmin && !hasValidSub) {
      return NextResponse.json({
        error: `${target.email} n'a pas d'abonnement actif sur cette application.`
      }, { status: 403 })
    }

    const { data, error } = await admin
      .from('guided_diagnostic_shares')
      .upsert({ diagnostic_id: params.id, shared_with_user_id: target.id, permission, shared_by: user.id },
               { onConflict: 'diagnostic_id,shared_with_user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/guided-diagnostic/[id]/shares?share_id=xxx */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await assertOwner(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const share_id = new URL(req.url).searchParams.get('share_id')
    if (!share_id) return NextResponse.json({ error: 'share_id required' }, { status: 400 })

    const admin = createAdminClient()
    await admin.from('guided_diagnostic_shares').delete().eq('id', share_id).eq('diagnostic_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
