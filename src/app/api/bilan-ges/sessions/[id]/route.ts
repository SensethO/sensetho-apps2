/**
 * GET    /api/bilan-ges/sessions/[id]
 * PATCH  /api/bilan-ges/sessions/[id]  (scopes JSONB + totaux)
 * DELETE /api/bilan-ges/sessions/[id]
 * Auth : owner (user_id) ou profil admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_sessions').select('user_id').eq('id', sessionId).single()
  return data?.user_id === userId
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_sessions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

const ALLOWED = ['name','organisation','organisation_id','secteur','exercice','methode','status',
                 'scope1','scope2','scope3','esrs_e1','objectif',
                 'total_scope1','total_scope2','total_scope3','total_global','notes']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of ALLOWED) {
      if (key in body) updates[key] = body[key]
    }
    if (updates.name) updates.name = String(updates.name).trim()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_sessions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erreur mise à jour' }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('bilan_ges_sessions')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
