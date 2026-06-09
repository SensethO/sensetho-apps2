import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin
    .from('act_carbone_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/** GET /api/act-carbone/[id]/reponses */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('act_carbone_reponses')
      .select('*')
      .eq('diagnostic_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST /api/act-carbone/[id]/reponses
 * Upsert (diagnostic_id, critere_id) → niveau + commentaire
 */
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

    const { critere_id, niveau, commentaire } = await req.json()
    if (!critere_id || niveau === undefined) {
      return NextResponse.json({ error: 'critere_id et niveau requis' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('act_carbone_reponses')
      .upsert(
        {
          diagnostic_id: params.id,
          critere_id,
          niveau: Number(niveau),
          commentaire: commentaire ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'diagnostic_id,critere_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
