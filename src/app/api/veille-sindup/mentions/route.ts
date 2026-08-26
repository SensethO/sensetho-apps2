// Mentions de veille Sindup d'une organisation.
// GET (filtres + pagination 50/page) | PATCH { id, lu?, favori? } | DELETE ?id=.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/sindup/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PAGE_SIZE = 50

export interface SindupMentionRow {
  id: string
  organisation_id: string
  source_id: string
  guid: string
  titre: string | null
  url: string | null
  extrait: string | null
  auteur: string | null
  published_at: string | null
  image_url: string | null
  lu: boolean
  favori: boolean
  created_at: string
}

/**
 * GET ?organisation_id=&source_id=&q=&lus=&favoris=&from=&to=&page=
 * (50/page, tri published_at DESC) → { mentions, total, page, page_size }
 * - lus : 'true' | 'false' ; favoris : 'true' | 'false'
 * - q : recherche insensible à la casse dans titre + extrait
 * - from / to : bornes sur published_at (ISO)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const organisationId = sp.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const fromIdx = (page - 1) * PAGE_SIZE

    const admin = createAdminClient()
    let query = admin
      .from('sindup_mentions')
      .select('*', { count: 'exact' })
      .eq('organisation_id', organisationId!)

    const sourceId = sp.get('source_id')
    if (sourceId) query = query.eq('source_id', sourceId)

    const q = (sp.get('q') ?? '').trim()
    if (q) {
      // Neutralise les caractères spéciaux PostgREST dans le motif ilike.
      const safe = q.replace(/[%_,()]/g, ' ').trim().replace(/\s+/g, '%')
      if (safe) query = query.or(`titre.ilike.%${safe}%,extrait.ilike.%${safe}%`)
    }

    const lus = sp.get('lus')
    if (lus === 'true' || lus === 'false') query = query.eq('lu', lus === 'true')

    const favoris = sp.get('favoris')
    if (favoris === 'true' || favoris === 'false') query = query.eq('favori', favoris === 'true')

    const from = sp.get('from')
    if (from) query = query.gte('published_at', from)
    const to = sp.get('to')
    if (to) query = query.lte('published_at', to)

    const { data, count, error } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(fromIdx, fromIdx + PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      mentions: (data ?? []) as SindupMentionRow[],
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, lu?, favori? } → { mention } */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; lu?: boolean; favori?: boolean }
    if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('sindup_mentions')
      .select('id, organisation_id')
      .eq('id', body.id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Mention introuvable' }, { status: 404 })

    const auth = await requireOrgOwner(existing.organisation_id)
    if (auth instanceof NextResponse) return auth

    const patch: Record<string, boolean> = {}
    if (typeof body.lu === 'boolean') patch.lu = body.lu
    if (typeof body.favori === 'boolean') patch.favori = body.favori
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à modifier (lu, favori)' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('sindup_mentions')
      .update(patch)
      .eq('id', body.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ mention: data as SindupMentionRow })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= → { ok: true } */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('sindup_mentions')
      .select('id, organisation_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Mention introuvable' }, { status: 404 })

    const auth = await requireOrgOwner(existing.organisation_id)
    if (auth instanceof NextResponse) return auth

    const { error } = await admin.from('sindup_mentions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
