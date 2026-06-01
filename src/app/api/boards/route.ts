import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** GET /api/boards — liste les tableaux de l'utilisateur */
export async function GET() {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: owned } = await admin.from('boards').select('id, title, description, thumbnail, is_template, created_at, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false })
    const { data: shared } = await admin.from('board_shares').select('board_id, permission, boards(id, title, description, thumbnail, created_at, updated_at)').eq('shared_with_user_id', user.id)

    return NextResponse.json({
      owned: owned ?? [],
      shared: (shared ?? []).map(s => ({ ...(s.boards as Record<string, unknown>), permission: s.permission })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/boards — créer un tableau */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { title?: string; description?: string; document?: unknown; is_template?: boolean }
    const admin = createAdminClient()
    const { data, error } = await admin.from('boards').insert({
      user_id: user.id,
      title: body.title ?? 'Nouveau tableau',
      description: body.description ?? null,
      document: body.document ?? null,
      is_template: body.is_template ?? false,
    }).select('id, title, description, thumbnail, created_at, updated_at').single()

    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
