import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, rapportId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('rapports_integres').select('user_id').eq('id', rapportId).single()
  return data?.user_id === userId
}

/** GET /api/rapport-integre/[id] — rapport complet avec sections */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [{ data: rapport }, { data: sections }] = await Promise.all([
      admin.from('rapports_integres').select('*').eq('id', params.id).single(),
      admin.from('rapport_sections').select('*').eq('rapport_id', params.id).order('ordre'),
    ])

    return NextResponse.json({ data: { rapport, sections: sections ?? [] } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/rapport-integre/[id] — mettre à jour titre, statut, sources, score_completion */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as Record<string, unknown>
    const allowed = ['titre', 'statut', 'sources', 'score_completion', 'template']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) { if (k in body) update[k] = body[k] }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('rapports_integres').update(update).eq('id', params.id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/rapport-integre/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { error } = await admin.from('rapports_integres').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
