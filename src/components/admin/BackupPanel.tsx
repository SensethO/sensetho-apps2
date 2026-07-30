'use client'

import { useState } from 'react'

// Export de sauvegarde de la base vers SharePoint (dossier SAUVEGARDES).
// Complète les sauvegardes Supabase (quotidiennes + PITR) par une copie hors plateforme.

interface Report {
  fileName: string; tables: number; rows: number; bytes: number
  skipped: string[]; errors: string[]; durationMs: number
}

export default function BackupPanel() {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true); setError(null); setReport(null)
    try {
      const r = await fetch('/api/admin/backup', { method: 'POST' })
      const j = await r.json()
      if (r.ok && j.ok) setReport(j.report)
      else setError(j.error ?? `Échec (HTTP ${r.status})`)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">💾 Sauvegarde vers SharePoint</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Exporte l’ensemble des données de la base dans un fichier JSON déposé sur SharePoint
          (dossier <span className="font-mono">SAUVEGARDES</span>). C’est une copie <strong>hors plateforme</strong>,
          en complément des sauvegardes quotidiennes et du PITR de Supabase — utile si le compte
          Supabase devenait inaccessible. Aucun fichier n’est stocké sur Supabase ni Vercel.
        </p>
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
      >
        {busy ? 'Sauvegarde en cours…' : 'Lancer une sauvegarde'}
      </button>

      {busy && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Parcours de toutes les tables puis dépôt sur SharePoint — cela prend en général moins d’une minute.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          ❌ {error}
        </div>
      )}

      {report && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-800 dark:text-green-300 space-y-1">
          <p className="font-medium">✅ Sauvegarde déposée : <span className="font-mono">{report.fileName}</span></p>
          <p className="text-xs">
            {report.tables} tables · {report.rows.toLocaleString('fr-FR')} lignes ·{' '}
            {(report.bytes / 1024 / 1024).toFixed(2)} Mo · {(report.durationMs / 1000).toFixed(0)} s
          </p>
          {report.errors.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ {report.errors.length} table(s) en erreur : {report.errors.slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
