'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'

interface UptimeResult {
  url: string
  label: string
  project: string
  status: number
  ok: boolean
  ms: number
  error: string | null
}
interface UptimeResponse {
  checkedAt: string
  allOk: boolean
  results: UptimeResult[]
}

// ── Garde-fous en place (statique — reflète la configuration du 2026-08) ────────
const SAFEGUARDS = [
  { icon: '🔌', label: 'Coupe-circuit rate-limit /api (300 req/min/IP → 429)', detail: 'Borne une boucle emballée avant tout appel Supabase/fonction.', where: 'code · middleware.ts' },
  { icon: '⏱️', label: 'Hook usePolling (plancher 8 s + pause si onglet caché)', detail: 'Tout rafraîchissement réseau passe par ce hook.', where: 'code · hooks/usePolling.ts' },
  { icon: '🧹', label: 'Garde ESLint anti-setInterval réseau', detail: 'Empêche la réintroduction de boucles brutes.', where: 'code · .eslintrc.json' },
  { icon: '💶', label: 'Budget Vercel 20 $ — alerte email (sans coupure)', detail: 'Notifie dès que l’usage payant atteint 20 $.', where: 'Vercel · Spend Management' },
  { icon: '📈', label: 'Alerte « Usage Anomaly » (pic invocations/CPU)', detail: 'Email temps réel + route en cause.', where: 'Vercel · Alerts' },
  { icon: '🚨', label: 'Alerte « Error Anomaly » (pic 5xx)', detail: 'Email temps réel en cas de déploiement cassé.', where: 'Vercel · Alerts' },
  { icon: '🛢️', label: 'Supabase Spend Cap activé', detail: 'Plafond ~25 $ + email avant blocage/lecture seule.', where: 'Supabase · Cost Control' },
  { icon: '🕒', label: 'Routine cloud uptime (midi & 18h)', detail: 'Vérifie que les sites répondent, sans jeton.', where: 'claude.ai · Routines' },
]

const LINKS = [
  { icon: '📊', label: 'Vercel — Usage',           href: 'https://vercel.com/sensethos-projects/~/usage' },
  { icon: '💳', label: 'Vercel — Budget / Facturation', href: 'https://vercel.com/sensethos-projects/~/settings/billing' },
  { icon: '🔔', label: 'Vercel — Alertes',          href: 'https://vercel.com/sensethos-projects/~/settings/alerts' },
  { icon: '🛢️', label: 'Supabase — Facturation',   href: 'https://supabase.com/dashboard/org/pwhonugmggorawsfssgq/billing' },
  { icon: '🕒', label: 'Routine uptime (rapports)', href: 'https://claude.ai/code/routines/trig_01Kzqe2S5rGBvRRiupgpDFmT' },
]

function statusColor(r: UptimeResult): string {
  if (r.ok) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-red-600 dark:text-red-400'
}
function msColor(ms: number): string {
  if (ms < 800)  return 'text-emerald-600 dark:text-emerald-400'
  if (ms < 2500) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function SurveillancePage() {
  const [data, setData] = useState<UptimeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetch('/api/admin/uptime', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json()
      })
      .then((d: UptimeResponse) => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const allOk = data?.allOk ?? false

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>🛡️ Surveillance</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              État des sites et garde-fous anti-dépassement de quotas (Vercel &amp; Supabase)
            </p>
          </div>
          <button onClick={load}
            className="px-3 py-1.5 rounded-lg border text-sm transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            🔄 Actualiser
          </button>
        </div>

        {/* Bandeau état global */}
        <div className="rounded-xl border p-4 flex items-center gap-3"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: loading ? 'var(--border)' : allOk ? '#34d399' : '#f87171',
          }}>
          <div className="text-2xl">{loading ? '⏳' : allOk ? '✅' : '🚨'}</div>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text)' }}>
              {loading ? 'Vérification en cours…' : allOk ? 'Tous les sites répondent normalement' : 'Un ou plusieurs sites en défaut'}
            </div>
            {data && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Dernière vérification : {new Date(data.checkedAt).toLocaleString('fr-FR')}
              </div>
            )}
            {error && <div className="text-xs text-red-500">Erreur : {error}</div>}
          </div>
        </div>

        {/* Uptime des sites */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>🌐 Disponibilité des sites</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data?.results ?? []).map(r => (
              <div key={r.url} className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{r.label}</div>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-mono truncate hover:underline block" style={{ color: 'var(--text-muted)' }}>
                      {r.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-bold ${statusColor(r)}`}>{r.ok ? r.status : (r.status || 'KO')}</div>
                    <div className={`text-[11px] font-mono ${msColor(r.ms)}`}>{r.ms} ms</div>
                  </div>
                </div>
                {r.error && <div className="text-[11px] text-red-500 mt-1 truncate" title={r.error}>{r.error}</div>}
                <div className="text-[10px] mt-2" style={{ color: 'var(--text-subtle)' }}>Projet Vercel : {r.project}</div>
              </div>
            ))}
            {loading && (data?.results ?? []).length === 0 && (
              <div className="flex justify-center py-8 col-span-full">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Garde-fous en place */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>🧰 Garde-fous en place</h2>
          <div className="rounded-xl border divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {SAFEGUARDS.map(s => (
              <div key={s.label} className="flex items-start gap-3 p-3">
                <span className="text-lg flex-shrink-0">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    <span className="text-emerald-500">✓</span> {s.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.detail}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                  {s.where}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Liens rapides */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>🔗 Tableaux de bord</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LINKS.map(l => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                className="rounded-xl border p-3 flex items-center gap-3 transition-colors hover:border-indigo-400"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="text-lg">{l.icon}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{l.label}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>↗</span>
              </a>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          ℹ️ Les alertes d’usage/coût (temps réel) arrivent par email sur info@monheure.fr. Cette page vérifie la
          disponibilité des sites à la demande ; la routine cloud la contrôle aussi automatiquement à midi et 18h.
        </p>
      </div>
    </AppShell>
  )
}
