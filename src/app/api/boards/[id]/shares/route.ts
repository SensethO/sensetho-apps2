import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canManage(userId: string, boardId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('boards').select('user_id').eq('id', boardId).single()
  return data?.user_id === userId
}

/** GET /api/boards/[id]/shares — liste les partages */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('board_shares')
      .select('id, permission, created_at, shared_with_user_id')
      .eq('board_id', params.id)
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrichir avec les profils utilisateurs
    const userIds = (data ?? []).map(s => s.shared_with_user_id)
    const profiles = userIds.length
      ? (await admin.from('profiles').select('id, email, full_name').in('id', userIds)).data ?? []
      : []

    const enriched = (data ?? []).map(s => ({
      ...s,
      profiles: profiles.find(p => p.id === s.shared_with_user_id) ?? null,
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/boards/[id]/shares — ajouter un partage */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, permission = 'view' } = await req.json()
    if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })

    const admin = createAdminClient()

    // Trouver l'utilisateur cible par email
    const { data: target } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', email.trim())
      .maybeSingle()

    if (!target) return NextResponse.json({ error: `Aucun compte trouvé pour "${email}"` }, { status: 404 })
    if (target.id === user.id) return NextResponse.json({ error: 'Vous ne pouvez pas partager avec vous-même' }, { status: 400 })

    // Upsert (évite les doublons)
    const { data: share, error } = await admin
      .from('board_shares')
      .upsert(
        { board_id: params.id, shared_by: user.id, shared_with_user_id: target.id, permission },
        { onConflict: 'board_id,shared_with_user_id' }
      )
      .select('id, permission, created_at, shared_with_user_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data: {
        ...share,
        profiles: { email: target.email, full_name: target.full_name },
      }
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/boards/[id]/shares?share_id=xxx — révoquer un partage */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canManage(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const shareId = new URL(req.url).searchParams.get('share_id')
    if (!shareId) return NextResponse.json({ error: 'share_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('board_shares')
      .delete()
      .eq('id', shareId)
      .eq('board_id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
