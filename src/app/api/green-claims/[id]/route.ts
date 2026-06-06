import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, diagId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('green_claims_diagnostics').select('user_id').eq('id', diagId).single()
  return data?.user_id === userId
}

/** GET /api/green-claims/[id] — diagnostic complet + allégations */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [{ data: diag }, { data: allegations }] = await Promise.all([
      admin.from('green_claims_diagnostics').select('*').eq('id', params.id).single(),
      admin.from('green_claims_allegations').select('*').eq('diagnostic_id', params.id).order('created_at'),
    ])
    return NextResponse.json({ data: { diag, allegations: allegations ?? [] } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/green-claims/[id] */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as Record<string, unknown>
    const allowed = ['titre', 'statut', 'score_global', 'nb_conformes', 'nb_risque', 'nb_non_conformes', 'nb_total']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) { if (k in body) update[k] = body[k] }

    const admin = createAdminClient()
    const { data, error } = await admin.from('green_claims_diagnostics').update(update).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/green-claims/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { error } = await admin.from('green_claims_diagnostics').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
