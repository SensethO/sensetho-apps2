import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Accès ISO 26000 : propriétaire / admin / partagé (table dédiée iso26000_diagnostic_shares). */
async function canAccess(userId: string, diagId: string, requireEdit = false): Promise<boolean> {
  const admin = createAdminClient()
  const { data: diag } = await admin.from('iso26000_diagnostics').select('user_id').eq('id', diagId).single()
  if (!diag) return false
  if (diag.user_id === userId) return true
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (prof?.role === 'admin') return true
  const { data: share } = await admin.from('iso26000_diagnostic_shares')
    .select('permission').eq('diagnostic_id', diagId).eq('shared_with_user_id', userId).maybeSingle()
  if (!share) return false
  return requireEdit ? share.permission === 'edit' : true
}

/** GET ?critere_id=xxx — liste des actions. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const critereId = new URL(req.url).searchParams.get('critere_id')
    const admin = createAdminClient()
    let q = admin.from('iso26000_actions').select('*').eq('diagnostic_id', params.id).order('created_at')
    if (critereId) q = q.eq('critere_id', critereId)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST — créer une action. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { critere_id, titre, description, priorite, echeance, responsable } = await req.json()
    if (!titre) return NextResponse.json({ error: 'titre requis' }, { status: 400 })
    const admin = createAdminClient()
    const { data, error } = await admin.from('iso26000_actions').insert({
      diagnostic_id: params.id,
      critere_id: critere_id || 'general',
      titre: String(titre).trim(),
      description: description ?? null,
      priorite: priorite ?? 'moyenne',
      statut: 'a_faire',
      echeance: echeance ?? null,
      responsable: responsable ?? null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH ?action_id=xxx — modifier. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const actionId = new URL(req.url).searchParams.get('action_id')
    if (!actionId) return NextResponse.json({ error: 'action_id requis' }, { status: 400 })
    const body = await req.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ['titre', 'description', 'priorite', 'statut', 'echeance', 'responsable']) if (k in body) patch[k] = body[k]
    const admin = createAdminClient()
    const { data, error } = await admin.from('iso26000_actions').update(patch)
      .eq('id', actionId).eq('diagnostic_id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?action_id=xxx — supprimer. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const actionId = new URL(req.url).searchParams.get('action_id')
    if (!actionId) return NextResponse.json({ error: 'action_id requis' }, { status: 400 })
    const admin = createAdminClient()
    const { error } = await admin.from('iso26000_actions').delete().eq('id', actionId).eq('diagnostic_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
