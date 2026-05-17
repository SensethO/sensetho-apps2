import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


/**
 * PATCH /api/guided-diagnostic/shift-year
 * Body: { org_id: string, delta: number }
 * Décale l'année de tous les diagnostics d'une organisation du même delta
 * que celui appliqué aux rse_years (suite à un changeStartYear).
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, delta } = await req.json()
    if (!org_id || typeof delta !== 'number' || delta === 0) {
      return NextResponse.json({ error: 'org_id and non-zero delta are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Récupérer tous les diagnostics de cet utilisateur pour cette organisation
    const { data: diags, error: fetchErr } = await admin
      .from('guided_diagnostics')
      .select('id, year')
      .eq('user_id', user.id)
      .eq('organisation_id', org_id)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    // Décaler l'année de chaque diagnostic
    for (const d of (diags ?? [])) {
      const { error: updateErr } = await admin
        .from('guided_diagnostics')
        .update({ year: d.year + delta })
        .eq('id', d.id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, updated: (diags ?? []).length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
