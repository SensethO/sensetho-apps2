// Statistiques de la veille Sindup d'une organisation.
// GET ?organisation_id= → { total, non_lues, favoris, par_jour (30 j), par_source }.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/sindup/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const orgId = organisationId!

    // Compteurs globaux (count only — pas de lignes rapatriées).
    const base = () =>
      admin.from('sindup_mentions').select('id', { count: 'exact', head: true }).eq('organisation_id', orgId)
    const [totalRes, nonLuesRes, favorisRes] = await Promise.all([
      base(),
      base().eq('lu', false),
      base().eq('favori', true),
    ])
    const firstError = totalRes.error ?? nonLuesRes.error ?? favorisRes.error
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

    // Mentions par jour sur 30 jours glissants (agrégation côté serveur Node).
    const since = new Date(Date.now() - 30 * 86400000)
    since.setUTCHours(0, 0, 0, 0)
    const { data: recent, error: recentError } = await admin
      .from('sindup_mentions')
      .select('published_at')
      .eq('organisation_id', orgId)
      .gte('published_at', since.toISOString())
      .order('published_at', { ascending: false })
      .limit(10000)
    if (recentError) return NextResponse.json({ error: recentError.message }, { status: 500 })

    const byDay = new Map<string, number>()
    for (const row of recent ?? []) {
      if (!row.published_at) continue
      const date = String(row.published_at).slice(0, 10) // YYYY-MM-DD (UTC)
      byDay.set(date, (byDay.get(date) ?? 0) + 1)
    }
    const par_jour = Array.from(byDay.entries())
      .map(([date, n]) => ({ date, n }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Mentions par source (toutes les sources de l'org, même à zéro).
    const { data: sources, error: sourcesError } = await admin
      .from('sindup_sources')
      .select('id, label')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: true })
    if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })

    const par_source = await Promise.all(
      (sources ?? []).map(async s => {
        const { count } = await admin
          .from('sindup_mentions')
          .select('id', { count: 'exact', head: true })
          .eq('source_id', s.id)
        return { source_id: s.id as string, label: s.label as string, n: count ?? 0 }
      })
    )

    return NextResponse.json({
      total: totalRes.count ?? 0,
      non_lues: nonLuesRes.count ?? 0,
      favoris: favorisRes.count ?? 0,
      par_jour,
      par_source,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
