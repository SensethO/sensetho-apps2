/**
 * GET /api/cron/sindup-collect
 *
 * Cron Vercel — collecte automatique des flux de veille Sindup.
 * Programmé 3 fois par jour ouvré (0 6,12,17 * * 1-5, UTC). Parcourt TOUTES
 * les sources actives de toutes les organisations (client service-role) et
 * collecte chaque flux (upsert anti-doublon). Plafond de 30 s : les sources
 * restantes seront rattrapées à l'exécution suivante (ordre = plus ancien
 * last_fetch_at d'abord).
 *
 * Sécurisé par le header Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectSource, type CollectResult, type SindupSourceRow } from '@/lib/sindup/collect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const TIME_BUDGET_MS = 27_000 // marge sous le plafond de 30 s

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const auth = req.headers.get('authorization') ?? ''
    const secret = process.env.CRON_SECRET ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: sources, error } = await admin
      .from('sindup_sources')
      .select('id, organisation_id, type, url, last_fetch_at')
      .eq('actif', true)
      .eq('type', 'rss')
      .order('last_fetch_at', { ascending: true, nullsFirst: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const perSource: CollectResult[] = []
    let skipped = 0
    for (const src of (sources ?? []) as Pick<SindupSourceRow, 'id' | 'organisation_id' | 'type' | 'url'>[]) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        skipped = (sources?.length ?? 0) - perSource.length
        break
      }
      perSource.push(await collectSource(admin, src))
    }

    const collected = perSource.reduce((n, r) => n + r.added, 0)
    const errors = perSource.filter(r => r.error !== null).length
    const orgs = new Set((sources ?? []).map(s => s.organisation_id)).size

    return NextResponse.json({
      ok: true,
      orgs,
      sources: sources?.length ?? 0,
      processed: perSource.length,
      skipped,
      collected,
      errors,
      perSource,
      duration_ms: Date.now() - startedAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
