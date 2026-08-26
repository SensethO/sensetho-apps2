// Collecte manuelle des flux de veille Sindup d'une organisation.
// POST { organisation_id, source_id? } → collecte les sources actives de l'org
// (ou une seule) et renvoie { collected, perSource }.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/sindup/auth'
import { collectSource, type CollectResult, type SindupSourceRow } from '@/lib/sindup/collect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { organisation_id?: string; source_id?: string }
    const organisationId = body.organisation_id ?? null
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    let query = admin
      .from('sindup_sources')
      .select('id, organisation_id, type, url')
      .eq('organisation_id', organisationId!)
    query = body.source_id ? query.eq('id', body.source_id) : query.eq('actif', true)

    const { data: sources, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        body.source_id
          ? { error: 'Source introuvable pour cette organisation' }
          : { collected: 0, perSource: [] },
        { status: body.source_id ? 404 : 200 }
      )
    }

    const perSource: CollectResult[] = []
    for (const src of sources as Pick<SindupSourceRow, 'id' | 'organisation_id' | 'type' | 'url'>[]) {
      perSource.push(await collectSource(admin, src))
    }
    const collected = perSource.reduce((n, r) => n + r.added, 0)

    return NextResponse.json({ collected, perSource })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
