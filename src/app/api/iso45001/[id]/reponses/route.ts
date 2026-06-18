import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'iso45001'
const TABLE = 'iso45001_diagnostics'

const canWrite = (userId: string, diagnosticId: string, requireEdit = false) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId, { requireEdit })

/** GET /api/iso45001/[id]/reponses */
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
      .from('iso45001_reponses')
      .select('*')
      .eq('diagnostic_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST /api/iso45001/[id]/reponses
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
    if (!await canWrite(user.id, params.id, true)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { critere_id, niveau, commentaire } = await req.json()
    if (!critere_id || niveau === undefined) {
      return NextResponse.json({ error: 'critere_id et niveau requis' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('iso45001_reponses')
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
