import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SHARED_DOMAIN_IDS = new Set(['DA1.1','DA3.4','DA4.3','DA5.1','DA3.1','DA3.5','DA3.6','DA5.4','DA4.1','DA4.2','DA2.1','DA6.5','DA7.1'])

/**
 * POST /api/sync-diagnostic-scores
 * Body: { org_id, year, source: 'guided' | 'iso26000' }
 * Syncs overlapping domain scores from source to target.
 * Robustesse : year est casté en number, les diagnostics cibles sont créés s'ils n'existent pas.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { org_id: string; year: number | string; source: 'guided' | 'iso26000' }
    const { org_id, source } = body
    const year = Number(body.year) // cast explicite pour éviter type mismatch string/int
    if (!org_id || !year || !source) return NextResponse.json({ error: 'org_id, year, source required' }, { status: 400 })

    const admin = createAdminClient()

    if (source === 'guided') {
      // ── Source : guided_diagnostics → cible : iso26000_diagnostics ──────────
      const { data: guided } = await admin
        .from('guided_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()

      // Pas de diagnostic guidé → rien à syncher
      if (!guided?.scores) return NextResponse.json({ synced: 0, note: 'no guided diagnostic or empty scores' })

      // Récupérer ou créer le diagnostic ISO26000
      let { data: iso } = await admin
        .from('iso26000_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()

      if (!iso) {
        const { data: created } = await admin
          .from('iso26000_diagnostics')
          .upsert({ user_id: user.id, organisation_id: org_id, year }, { onConflict: 'user_id,organisation_id,year' })
          .select('id, scores')
          .single()
        iso = created
      }
      if (!iso) return NextResponse.json({ synced: 0, note: 'could not create iso26000 diagnostic' })

      const patch: Record<string, number> = { ...(iso.scores ?? {}) }
      let count = 0
      for (const [domainId, score] of Object.entries(guided.scores as Record<string, number>)) {
        if (SHARED_DOMAIN_IDS.has(domainId) && score > 0) { patch[domainId] = score; count++ }
      }
      if (count > 0) {
        await admin.from('iso26000_diagnostics').update({ scores: patch }).eq('id', iso.id)
      }
      return NextResponse.json({ synced: count })

    } else {
      // ── Source : iso26000_diagnostics → cible : guided_diagnostics ──────────
      const { data: iso } = await admin
        .from('iso26000_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()

      if (!iso?.scores) return NextResponse.json({ synced: 0, note: 'no iso26000 diagnostic or empty scores' })

      // Récupérer ou créer le diagnostic guidé
      let { data: guided } = await admin
        .from('guided_diagnostics')
        .select('id, scores')
        .eq('user_id', user.id)
        .eq('organisation_id', org_id)
        .eq('year', year)
        .maybeSingle()

      if (!guided) {
        const { data: created } = await admin
          .from('guided_diagnostics')
          .upsert({ user_id: user.id, organisation_id: org_id, year }, { onConflict: 'user_id,organisation_id,year' })
          .select('id, scores')
          .single()
        guided = created
      }
      if (!guided) return NextResponse.json({ synced: 0, note: 'could not create guided diagnostic' })

      const patch: Record<string, number> = { ...(guided.scores ?? {}) }
      let count = 0
      for (const [domainId, score] of Object.entries(iso.scores as Record<string, number>)) {
        if (SHARED_DOMAIN_IDS.has(domainId) && score > 0) { patch[domainId] = score; count++ }
      }
      if (count > 0) {
        await admin.from('guided_diagnostics').update({ scores: patch }).eq('id', guided.id)
      }
      return NextResponse.json({ synced: count })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
