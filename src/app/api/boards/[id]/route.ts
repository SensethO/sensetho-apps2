import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, boardId: string, needEdit = false): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: board } = await admin.from('boards').select('user_id').eq('id', boardId).single()
  if (board?.user_id === userId) return true
  const { data: share } = await admin.from('board_shares').select('permission').eq('board_id', boardId).eq('shared_with_user_id', userId).maybeSingle()
  if (!share) return false
  return needEdit ? share.permission === 'edit' : true
}

/** GET /api/boards/[id] */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data } = await admin.from('boards').select('*').eq('id', params.id).single()
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/boards/[id] — sauvegarder le contenu + métadonnées */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { title?: string; description?: string; document?: unknown; thumbnail?: string }
    const admin = createAdminClient()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined)       updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.document !== undefined)    updateData.document = body.document
    if (body.thumbnail !== undefined)   updateData.thumbnail = body.thumbnail

    const { data, error } = await admin.from('boards').update(updateData).eq('id', params.id).select('id, title, updated_at').single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/boards/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: board } = await admin.from('boards').select('user_id').eq('id', params.id).single()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (board?.user_id !== user.id && profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await admin.from('boards').delete().eq('id', params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
