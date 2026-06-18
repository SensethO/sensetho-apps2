import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'bilan-ges'
const TABLE = 'bilan_ges_diagnostics'

const canAccess = (userId: string, diagnosticId: string, requireEdit = false) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId, { requireEdit })

/** GET /api/bilan-ges/[id] — détail complet */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const [diagRes, repRes, actRes] = await Promise.all([
      admin.from('bilan_ges_diagnostics').select('*').eq('id', params.id).single(),
      admin.from('bilan_ges_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('bilan_ges_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
    ])

    return NextResponse.json({
      data: {
        diagnostic: diagRes.data,
        reponses:   repRes.data ?? [],
        actions:    actRes.data ?? [],
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/bilan-ges/[id] — mise à jour score_global et statut */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id, true)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['score_global', 'statut']
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_diagnostics')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
