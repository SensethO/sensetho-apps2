// Sources de veille Sindup (flux RSS/Atom) d'une organisation.
// GET ?organisation_id= | POST { organisation_id, label, url } (teste le flux
// avant d'enregistrer) | PATCH { id, …champs } | DELETE ?id= (cascade mentions).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/sindup/auth'
import { fetchFeed } from '@/lib/sindup/rss'
import type { SindupSourceRow } from '@/lib/sindup/collect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?organisation_id= → { sources } */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('sindup_sources')
      .select('*')
      .eq('organisation_id', organisationId!)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sources: (data ?? []) as SindupSourceRow[] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST { organisation_id, label, url } → teste le flux (fetch + parse) AVANT
 * d'enregistrer ; 400 explicite si le flux est invalide. → { source, feed_title, items_found }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { organisation_id?: string; label?: string; url?: string }
    const auth = await requireOrgOwner(body.organisation_id ?? null)
    if (auth instanceof NextResponse) return auth

    const label = (body.label ?? '').trim()
    const url = (body.url ?? '').trim()
    if (!label || !url) {
      return NextResponse.json({ error: 'label et url requis' }, { status: 400 })
    }

    // Test du flux avant enregistrement.
    let feedTitle: string | null = null
    let itemsFound = 0
    try {
      const feed = await fetchFeed(url)
      feedTitle = feed.title
      itemsFound = feed.items.length
    } catch (err) {
      return NextResponse.json(
        { error: `Flux invalide : ${err instanceof Error ? err.message : String(err)}` },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('sindup_sources')
      .insert({ organisation_id: body.organisation_id, type: 'rss', label, url, actif: true })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(
      { source: data as SindupSourceRow, feed_title: feedTitle, items_found: itemsFound },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, label?, url?, actif? } → { source } */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; label?: string; url?: string; actif?: boolean }
    if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('sindup_sources')
      .select('id, organisation_id')
      .eq('id', body.id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Source introuvable' }, { status: 404 })

    const auth = await requireOrgOwner(existing.organisation_id)
    if (auth instanceof NextResponse) return auth

    const patch: Record<string, unknown> = {}
    if (typeof body.label === 'string') {
      const label = body.label.trim()
      if (!label) return NextResponse.json({ error: 'label vide' }, { status: 400 })
      patch.label = label
    }
    if (typeof body.actif === 'boolean') patch.actif = body.actif
    if (typeof body.url === 'string') {
      const url = body.url.trim()
      if (!url) return NextResponse.json({ error: 'url vide' }, { status: 400 })
      try {
        await fetchFeed(url)
      } catch (err) {
        return NextResponse.json(
          { error: `Flux invalide : ${err instanceof Error ? err.message : String(err)}` },
          { status: 400 }
        )
      }
      patch.url = url
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à modifier (label, url, actif)' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('sindup_sources')
      .update(patch)
      .eq('id', body.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ source: data as SindupSourceRow })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= → { ok: true } (les mentions suivent en cascade). */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('sindup_sources')
      .select('id, organisation_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Source introuvable' }, { status: 404 })

    const auth = await requireOrgOwner(existing.organisation_id)
    if (auth instanceof NextResponse) return auth

    const { error } = await admin.from('sindup_sources').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
