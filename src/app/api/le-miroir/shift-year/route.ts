import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/le-miroir/shift-year
 * Body: { org_id: string, delta: number }
 * Décale l'année de toutes les campagnes Le Miroir de cette organisation
 * (possédées par l'utilisateur) du même delta que rse_years.
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
    const { data: camps, error: fetchErr } = await admin
      .from('le_miroir_campagnes')
      .select('id, annee')
      .eq('owner_id', user.id)
      .eq('org_id', org_id)
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    // Ordre d'update pour éviter une collision transitoire sur UNIQUE(owner,org,annee)
    const ordered = (camps ?? []).sort((a, b) => (delta > 0 ? b.annee - a.annee : a.annee - b.annee))
    for (const c of ordered) {
      const { error: updErr } = await admin
        .from('le_miroir_campagnes')
        .update({ annee: c.annee + delta })
        .eq('id', c.id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, shifted: ordered.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
