import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// Mesure réelle des volumes hébergés, publiée sur /hebergement-responsable.
// Règle de la page : on ne publie que ce qu'on mesure, en disant comment.
// → volumes lus dans PostgreSQL (pg_stat / pg_total_relation_size), mis en
//   cache 24 h pour ne pas transformer une page publique en charge inutile.

export interface ImpactMetrics {
  /** Nombre de tables du schéma public. */
  tables: number
  /** Somme des estimations de lignes vivantes (pg_stat_user_tables.n_live_tup). */
  rows: number
  /** Taille totale du schéma public en octets — null si la fonction SQL n'est pas déployée. */
  dbSizeBytes: number | null
  /** Pages vues enregistrées sur 30 jours (journal interne, robots exclus). */
  pageViews30d: number | null
  /** Pages vues enregistrées depuis la mise en service (robots exclus). */
  pageViewsTotal: number | null
  /** Horodatage de la mesure (ISO). */
  measuredAt: string
}

async function measure(): Promise<ImpactMetrics | null> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin.rpc('list_public_tables')
    if (error || !Array.isArray(data)) return null

    const rows = (data as { row_estimate: number | string | null }[]).reduce(
      (sum, t) => sum + Number(t.row_estimate ?? 0),
      0,
    )

    // Optionnelle : voir supabase/migrations/20260829_public_schema_size.sql.
    // Tant qu'elle n'est pas appliquée, la taille n'est simplement pas affichée.
    let dbSizeBytes: number | null = null
    const size = await admin.rpc('public_schema_size_bytes')
    if (!size.error) {
      const n = Number(size.data)
      if (Number.isFinite(n) && n > 0) dbSizeBytes = n
    }

    // Visites de pages réellement enregistrées par notre propre journal
    // (app_logs, alimenté par /api/logs) — robots exclus. PostgREST interdisant
    // les agrégats, on utilise le comptage exact en HEAD : aucune ligne transférée.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const [win, all] = await Promise.all([
      admin.from('app_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', since).neq('device_type', 'bot'),
      admin.from('app_logs').select('id', { count: 'exact', head: true })
        .neq('device_type', 'bot'),
    ])

    return {
      tables: data.length,
      rows,
      dbSizeBytes,
      pageViews30d: win.error ? null : (win.count ?? null),
      pageViewsTotal: all.error ? null : (all.count ?? null),
      measuredAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export const getImpactMetrics = unstable_cache(measure, ['impact-metrics', 'v3-usage'], {
  revalidate: 86_400, // 24 h : la mesure n'a pas besoin d'être plus fraîche que ça
  tags: ['impact-metrics'], // stable : permet un revalidateTag('impact-metrics') quelle que soit la version de clé
})
