import { createAdminClient } from '@/lib/supabase/admin'
import { getConfigForApp, uploadSpFile, createSpFolder } from '@/lib/sharepointMulti'

/**
 * Export de sauvegarde de la base vers SharePoint (JSON), hors plateforme Supabase.
 *
 * Complète les sauvegardes Supabase (quotidiennes + PITR sur l'offre Pro) par une copie
 * *sous contrôle du client*, utile si le compte Supabase devenait inaccessible.
 * Conforme à la règle « aucun fichier stocké sur Supabase ou Vercel » : le JSON est
 * assemblé en mémoire côté serveur puis téléversé directement sur SharePoint.
 */

const FOLDER = 'SAUVEGARDES'
const PAGE = 1000
const APP_KEY = 'eudr-fournisseurs' // configuration SharePoint utilisée pour le dépôt

/** Tables exclues : volumineuses, régénérables, ou sans valeur de restauration. */
const SKIP = new Set(['page_logs', 'pp_track_events'])

export interface BackupReport {
  fileName: string
  tables: number
  rows: number
  bytes: number
  skipped: string[]
  errors: string[]
  durationMs: number
}

export async function backupDatabaseToSharepoint(triggeredBy: string | null): Promise<BackupReport> {
  const started = Date.now()
  const admin = createAdminClient()
  const errors: string[] = []
  const skipped: string[] = []

  // Liste des tables (fonction SQL dédiée : reste exhaustive quand le schéma évolue).
  const { data: list, error: listErr } = await admin.rpc('list_public_tables')
  if (listErr) throw new Error(`Liste des tables impossible : ${listErr.message}`)
  const tables = ((list as { table_name: string }[] | null) ?? []).map(t => t.table_name)

  const dump: Record<string, unknown[]> = {}
  let rows = 0

  for (const table of tables) {
    if (SKIP.has(table)) { skipped.push(table); continue }
    try {
      const all: unknown[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        if (!data?.length) break
        all.push(...data)
        if (data.length < PAGE) break
      }
      dump[table] = all
      rows += all.length
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message}`)
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    triggered_by: triggeredBy,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    table_count: Object.keys(dump).length,
    row_count: rows,
    skipped,
    errors,
    data: dump,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf-8')

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const fileName = `sauvegarde-${stamp}.json`

  const config = await getConfigForApp(APP_KEY)
  try {
    await uploadSpFile(config, FOLDER, fileName, new Uint8Array(body).buffer as ArrayBuffer, 'application/json')
  } catch (e) {
    // Le dossier n'existe probablement pas encore : on le crée puis on retente une fois.
    if (/404/.test(String((e as Error).message))) {
      await createSpFolder(config, null, FOLDER)
      await uploadSpFile(config, FOLDER, fileName, new Uint8Array(body).buffer as ArrayBuffer, 'application/json')
    } else throw e
  }

  return { fileName, tables: Object.keys(dump).length, rows, bytes: body.length, skipped, errors, durationMs: Date.now() - started }
}
