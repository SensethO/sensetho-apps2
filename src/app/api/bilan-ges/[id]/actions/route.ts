import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin
    .from('bilan_ges_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/** GET /api/bilan-ges/[id]/actions?critere_id=xxx */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const critereId = searchParams.get('critere_id')

    const admin = createAdminClient()
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let query = admin
      .from('bilan_ges_actions')
      .select('*')
      .eq('diagnostic_id', params.id)
      .order('created_at') as any

    if (critereId) query = query.eq('critere_id', critereId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/bilan-ges/[id]/actions — créer une action */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { critere_id, titre, description, priorite, echeance, responsable } = await req.json()
    if (!critere_id || !titre) {
      return NextResponse.json({ error: 'critere_id et titre requis' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_actions')
      .insert({
        diagnostic_id: params.id,
        critere_id,
        titre: titre.trim(),
        description: description ?? null,
        priorite: priorite ?? 'moyenne',
        statut: 'a_faire',
        echeance: echeance ?? null,
        responsable: responsable ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/bilan-ges/[id]/actions?action_id=xxx */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const actionId = searchParams.get('action_id')
    if (!actionId) return NextResponse.json({ error: 'action_id requis' }, { status: 400 })

    const body = await req.json()
    const allowed = ['titre', 'description', 'priorite', 'statut', 'echeance', 'responsable']
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_actions')
      .update(patch)
      .eq('id', actionId)
      .eq('diagnostic_id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/bilan-ges/[id]/actions?action_id=xxx */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const actionId = searchParams.get('action_id')
    if (!actionId) return NextResponse.json({ error: 'action_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('bilan_ges_actions')
      .delete()
      .eq('id', actionId)
      .eq('diagnostic_id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
