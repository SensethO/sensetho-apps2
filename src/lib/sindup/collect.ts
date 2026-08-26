// Collecte d'une source de veille Sindup : fetch + parse du flux, upsert
// anti-doublon des mentions, mise à jour du statut de la source.
// Utilisée par POST /api/veille-sindup/collect et par le cron sindup-collect.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchFeed } from './rss'

export interface SindupSourceRow {
  id: string
  organisation_id: string
  type: 'rss' | 'api'
  label: string
  url: string | null
  actif: boolean
  last_fetch_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface CollectResult {
  source_id: string
  added: number
  error: string | null
}

/**
 * Collecte une source (type 'rss' uniquement — le connecteur API Sindup sera
 * branché quand la doc sera disponible). Met à jour last_fetch_at/status/error.
 */
export async function collectSource(
  admin: SupabaseClient,
  source: Pick<SindupSourceRow, 'id' | 'organisation_id' | 'type' | 'url'>
): Promise<CollectResult> {
  const now = new Date().toISOString()

  const fail = async (message: string): Promise<CollectResult> => {
    await admin
      .from('sindup_sources')
      .update({ last_fetch_at: now, last_status: 'error', last_error: message })
      .eq('id', source.id)
    return { source_id: source.id, added: 0, error: message }
  }

  if (source.type !== 'rss') {
    return fail('Connecteur API Sindup non encore disponible (client à brancher quand la doc Sindup sera publiée).')
  }
  if (!source.url) return fail('Source sans URL de flux.')

  try {
    const feed = await fetchFeed(source.url)
    // Dédoublonnage intra-flux par guid (certains flux répètent des items).
    const seen = new Set<string>()
    const items = feed.items.filter(i => (seen.has(i.guid) ? false : (seen.add(i.guid), true)))
    const rows = items.map(item => ({
      organisation_id: source.organisation_id,
      source_id: source.id,
      guid: item.guid,
      titre: item.titre,
      url: item.url,
      extrait: item.extrait,
      auteur: item.auteur,
      published_at: item.published_at,
      image_url: item.image_url,
    }))

    let added = 0
    if (rows.length > 0) {
      // Anti-doublon : ON CONFLICT (source_id, guid) DO NOTHING.
      const { data, error } = await admin
        .from('sindup_mentions')
        .upsert(rows, { onConflict: 'source_id,guid', ignoreDuplicates: true })
        .select('id')
      if (error) return fail(`Insertion des mentions échouée : ${error.message}`)
      added = data?.length ?? 0
    }

    await admin
      .from('sindup_sources')
      .update({ last_fetch_at: now, last_status: 'ok', last_error: null })
      .eq('id', source.id)
    return { source_id: source.id, added, error: null }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
