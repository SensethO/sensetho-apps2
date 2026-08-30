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

    return { tables: data.length, rows, dbSizeBytes, measuredAt: new Date().toISOString() }
  } catch {
    return null
  }
}

export const getImpactMetrics = unstable_cache(measure, ['impact-metrics', 'v2-taille'], {
  revalidate: 86_400, // 24 h : la mesure n'a pas besoin d'être plus fraîche que ça
  tags: ['impact-metrics', 'v2-taille'],
})
