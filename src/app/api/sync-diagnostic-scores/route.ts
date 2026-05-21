import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SHARED_DOMAIN_IDS = new Set(['DA1.1','DA3.4','DA4.3','DA5.1','DA3.1','DA3.5','DA3.6','DA5.4','DA4.1','DA4.2','DA2.1','DA6.5','DA7.1'])

/**
 * POST /api/sync-diagnostic-scores
 * Body: { org_id, year, source: 'guided' | 'iso26000' }
 * Syncs overlapping domain scores from source to target.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, year, source } = await req.json() as { org_id: string; year: number; source: 'guided' | 'iso26000' }
    if (!org_id || !year || !source) return NextResponse.json({ error: 'org_id, year, source required' }, { status: 400 })

    const admin = createAdminClient()

    if (source === 'guided') {
      // Read from guided_diagnostics, write to iso26000_diagnostics
      const { data: guided } = await admin
        .from('guided_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()
      if (!guided?.scores) return NextResponse.json({ synced: 0 })

      const { data: iso } = await admin
        .from('iso26000_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()
      if (!iso) return NextResponse.json({ synced: 0, note: 'no iso26000 diagnostic' })

      const patch: Record<string, number> = { ...(iso.scores ?? {}) }
      let count = 0
      for (const [domainId, score] of Object.entries(guided.scores as Record<string, number>)) {
        if (SHARED_DOMAIN_IDS.has(domainId)) { patch[domainId] = score; count++ }
      }
      await admin.from('iso26000_diagnostics').update({ scores: patch }).eq('id', iso.id)
      return NextResponse.json({ synced: count })

    } else {
      // Read from iso26000_diagnostics, write to guided_diagnostics
      const { data: iso } = await admin
        .from('iso26000_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()
      if (!iso?.scores) return NextResponse.json({ synced: 0 })

      const { data: guided } = await admin
        .from('guided_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()
      if (!guided) return NextResponse.json({ synced: 0, note: 'no guided diagnostic' })

      const patch: Record<string, number> = { ...(guided.scores ?? {}) }
      let count = 0
      for (const [domainId, score] of Object.entries(iso.scores as Record<string, number>)) {
        if (SHARED_DOMAIN_IDS.has(domainId)) { patch[domainId] = score; count++ }
      }
      await admin.from('guided_diagnostics').update({ scores: patch }).eq('id', guided.id)
      return NextResponse.json({ synced: count })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
