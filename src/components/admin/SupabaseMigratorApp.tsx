'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectCredentials {
  url: string
  serviceRoleKey: string
  dbPassword: string
  projectRef: string
  pat: string
}

interface TransferOptions {
  schema: boolean
  data: boolean
  rls: boolean
  auth: boolean
  storage: boolean
  listFunctions: boolean
  listSecrets: boolean
}

interface LogLine {
  step: string
  status: 'running' | 'done' | 'error' | 'info' | 'warn'
  msg: string
  count?: number
  timestamp: string
}

interface Summary {
  tables: number
  rows: number
  users: number
  files: number
  functions: string[]
  secrets: string[]
  warnings: string[]
}

interface ConnectionStatus {
  tested: boolean
  ok: boolean
  pgOk: boolean
  error?: string
  loading: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  connect: 'Connexion DB',
  schema: 'Schéma',
  rls: 'Politiques RLS',
  data: 'Données',
  auth: 'Utilisateurs Auth',
  storage: 'Storage',
  functions: 'Edge Functions',
  secrets: 'Secrets',
  done: 'Terminé',
  error: 'Erreur',
}

const defaultCreds = (): ProjectCredentials => ({
  url: '',
  serviceRoleKey: '',
  dbPassword: '',
  projectRef: '',
  pat: '',
})

const defaultOptions = (): TransferOptions => ({
  schema: true,
  data: true,
  rls: true,
  auth: true,
  storage: true,
  listFunctions: true,
  listSecrets: true,
})

// ── Sub-components ────────────────────────────────────────────────────────────

function PasswordInput({
  value, onChange, placeholder, label, hint,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string; hint?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          aria-label={show ? 'Masquer' : 'Afficher'}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, label, hint,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  )
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (!status.tested && !status.loading) return null
  if (status.loading) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Test en cours...
      </span>
    )
  }
  const bothOk = status.ok && status.pgOk
  return (
    <div className="mt-2 rounded-md border px-3 py-2 text-xs"
      style={{ borderColor: bothOk ? '#22c55e44' : '#ef444444', backgroundColor: bothOk ? '#14532d22' : '#7f1d1d22' }}>
      <div className="flex items-center gap-2 font-medium" style={{ color: bothOk ? '#4ade80' : '#f87171' }}>
        {bothOk ? '✓' : '✗'} {bothOk ? 'Connexion réussie' : 'Connexion échouée'}
      </div>
      <div className="mt-1 flex gap-4 text-slate-400">
        <span>API REST: {status.ok ? '✓' : '✗'}</span>
        <span>PostgreSQL: {status.pgOk ? '✓' : '✗'}</span>
      </div>
      {status.error && <div className="mt-1 text-red-400">{status.error}</div>}
    </div>
  )
}

function CredentialsForm({
  title, creds, onChange, connStatus, onTest,
}: {
  title: string; creds: ProjectCredentials; onChange: (c: ProjectCredentials) => void
  connStatus: ConnectionStatus; onTest: () => void
}) {
  const set = (field: keyof ProjectCredentials) => (v: string) => onChange({ ...creds, [field]: v })
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <TextInput label="URL du projet Supabase" placeholder="https://abcdefghij.supabase.co"
        value={creds.url} onChange={set('url')} hint="Paramètres → API → Project URL" />
      <PasswordInput label="Service Role Key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        value={creds.serviceRoleKey} onChange={set('serviceRoleKey')} hint="Paramètres → API → service_role (secret)" />
      <PasswordInput label="Mot de passe de la base de données" placeholder="Votre mot de passe DB"
        value={creds.dbPassword} onChange={set('dbPassword')} hint="Paramètres → Database → Database Password" />
      <TextInput label="Project Reference ID" placeholder="abcdefghijklmnop"
        value={creds.projectRef} onChange={set('projectRef')} hint="Paramètres → General → Reference ID" />
      <PasswordInput label="Supabase PAT / Access Token" placeholder="sbp_..."
        value={creds.pat} onChange={set('pat')} hint="app.supabase.com → Account → Access Tokens → Generate new token" />
      <button type="button" onClick={onTest} disabled={connStatus.loading}
        className="mt-1 w-fit rounded-lg border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50">
        {connStatus.loading ? 'Test en cours...' : 'Tester la connexion'}
      </button>
      <ConnectionBadge status={connStatus} />
    </div>
  )
}

function StepIcon({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <svg className="h-4 w-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )
  }
  if (status === 'done') return <span className="text-green-400">✓</span>
  if (status === 'error') return <span className="text-red-400">✗</span>
  if (status === 'warn') return <span className="text-yellow-400">⚠</span>
  return <span className="text-slate-500">·</span>
}

function statusColor(status: string): string {
  switch (status) {
    case 'done': return 'text-green-400'
    case 'error': return 'text-red-400'
    case 'warn': return 'text-yellow-400'
    case 'running': return 'text-indigo-300'
    default: return 'text-slate-400'
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SupabaseMigratorApp() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [source, setSource] = useState<ProjectCredentials>(defaultCreds())
  const [destination, setDestination] = useState<ProjectCredentials>(defaultCreds())
  const [options, setOptions] = useState<TransferOptions>(defaultOptions())

  const [sourceConn, setSourceConn] = useState<ConnectionStatus>({ tested: false, ok: false, pgOk: false, loading: false })
  const [destConn, setDestConn] = useState<ConnectionStatus>({ tested: false, ok: false, pgOk: false, loading: false })

  const [logs, setLogs] = useState<LogLine[]>([])
  const [stepStatuses, setStepStatuses] = useState<Map<string, 'running' | 'done' | 'error' | 'warn'>>(new Map())
  const [summary, setSummary] = useState<Summary | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [transferDone, setTransferDone] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const testConnection = useCallback(async (creds: ProjectCredentials, which: 'source' | 'destination') => {
    const setStatus = which === 'source' ? setSourceConn : setDestConn
    setStatus({ tested: false, ok: false, pgOk: false, loading: true })
    try {
      const res = await fetch('/api/supabase-migrator/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      })
      const data = await res.json() as { ok: boolean; pgOk: boolean; error?: string }
      setStatus({ tested: true, ok: data.ok, pgOk: data.pgOk, error: data.error, loading: false })
    } catch (e) {
      setStatus({ tested: true, ok: false, pgOk: false, error: String(e), loading: false })
    }
  }, [])

  const startTransfer = useCallback(async () => {
    setLogs([])
    setStepStatuses(new Map())
    setSummary(null)
    setTransferDone(false)
    setTransferring(true)
    setStep(4)

    try {
      const res = await fetch('/api/supabase-migrator/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination, options }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          try {
            const event = JSON.parse(jsonStr) as LogLine & { summary?: Summary }
            if (event.step === 'done' && event.summary) {
              setSummary(event.summary)
              setTransferDone(true)
            } else {
              const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              setLogs(prev => [...prev, { ...event, timestamp: ts }])
              setStepStatuses(prev => {
                const next = new Map(prev)
                if (['running', 'done', 'error', 'warn'].includes(event.status)) {
                  next.set(event.step, event.status as 'running' | 'done' | 'error' | 'warn')
                }
                return next
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e) {
      setLogs(prev => [...prev, { step: 'error', status: 'error', msg: String(e), timestamp: new Date().toLocaleTimeString() }])
    } finally {
      setTransferring(false)
      setTransferDone(true)
    }
  }, [source, destination, options])

  const downloadReport = useCallback(() => {
    if (!summary) return
    const report = {
      generatedAt: new Date().toISOString(),
      source: { url: source.url, projectRef: source.projectRef },
      destination: { url: destination.url, projectRef: destination.projectRef },
      summary, logs,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supabase-migration-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [summary, source, destination, logs])

  const toggleOption = (key: keyof TransferOptions) => setOptions(prev => ({ ...prev, [key]: !prev[key] }))

  const card = 'rounded-2xl border border-slate-700 bg-slate-800 p-6'

  const resetAll = () => {
    setStep(1); setLogs([]); setStepStatuses(new Map()); setSummary(null)
    setTransferDone(false); setSource(defaultCreds()); setDestination(defaultCreds()); setOptions(defaultOptions())
    setSourceConn({ tested: false, ok: false, pgOk: false, loading: false })
    setDestConn({ tested: false, ok: false, pgOk: false, loading: false })
  }

  return (
    <div className="p-6" style={{ backgroundColor: '#0f172a', minHeight: 'calc(100vh - 120px)' }}>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">🔄 Supabase Migrator</h1>
          <p className="mt-1 text-slate-400">Transférez un projet Supabase d&apos;un compte à un autre, automatiquement.</p>
        </div>

        {/* Security notice */}
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          <span className="font-semibold">⚠ Sécurité : </span>
          Vos clés ne sont jamais stockées ni loguées. Elles sont utilisées uniquement le temps du transfert, côté serveur, et supprimées immédiatement après.
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {([
            { n: 1 as const, label: 'Source' },
            { n: 2 as const, label: 'Destination' },
            { n: 3 as const, label: 'Options' },
            { n: 4 as const, label: 'Transfert' },
          ]).map(({ n, label }, i) => (
            <div key={n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                  step === n ? 'bg-indigo-600 text-white' : step > n ? 'bg-green-600 text-white' : 'border border-slate-600 text-slate-500'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-xs ${step >= n ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
              </div>
              {i < 3 && <div className={`mx-2 h-px flex-1 ${step > n ? 'bg-green-600' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Source */}
        {step === 1 && (
          <div className={card}>
            <CredentialsForm title="Projet Source" creds={source} onChange={setSource}
              connStatus={sourceConn} onTest={() => testConnection(source, 'source')} />
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep(2)}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Destination */}
        {step === 2 && (
          <div className={card}>
            <CredentialsForm title="Projet Destination" creds={destination} onChange={setDestination}
              connStatus={destConn} onTest={() => testConnection(destination, 'destination')} />
            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(1)}
                className="rounded-lg border border-slate-600 px-6 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">
                ← Retour
              </button>
              <button onClick={() => setStep(3)}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Options */}
        {step === 3 && (
          <div className={card}>
            <h2 className="mb-4 text-xl font-semibold text-white">Options de transfert</h2>
            <p className="mb-6 text-sm text-slate-400">Sélectionnez les éléments à transférer du projet source vers le projet destination.</p>
            <div className="flex flex-col gap-3">
              {([
                { key: 'schema',        label: 'Schéma (tables, vues, types, fonctions SQL, index)', desc: 'Recrée toute la structure de la base de données' },
                { key: 'data',          label: 'Données (toutes les tables)',                         desc: 'Copie toutes les lignes de chaque table (par lots de 100)' },
                { key: 'rls',           label: 'Politiques RLS',                                      desc: 'Row Level Security — policies de sécurité par ligne' },
                { key: 'auth',          label: 'Utilisateurs Auth',                                   desc: 'Comptes utilisateurs (⚠ mots de passe non copiables — reset requis)' },
                { key: 'storage',       label: 'Storage (buckets + fichiers)',                        desc: 'Recrée les buckets et téléverse tous les fichiers' },
                { key: 'listFunctions', label: 'Lister les Edge Functions (audit)',                   desc: 'Liste les fonctions — le code doit être redéployé manuellement' },
                { key: 'listSecrets',   label: 'Lister les Secrets (audit)',                          desc: 'Liste les noms — les valeurs ne sont pas accessibles via API' },
              ] as { key: keyof TransferOptions; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 hover:border-slate-600 transition">
                  <input type="checkbox" checked={options[key]} onChange={() => toggleOption(key)}
                    className="mt-0.5 h-4 w-4 accent-indigo-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-200">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Résumé : </span>
              Source <span className="text-indigo-300">{source.projectRef || '(non défini)'}</span>
              {' → '}
              Destination <span className="text-indigo-300">{destination.projectRef || '(non défini)'}</span>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(2)}
                className="rounded-lg border border-slate-600 px-6 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">
                ← Retour
              </button>
              <button onClick={startTransfer}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                🚀 Lancer le transfert
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Live transfer */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            {/* Step overview */}
            <div className={card}>
              <h2 className="mb-4 text-xl font-semibold text-white">
                {transferring ? '⏳ Transfert en cours...' : transferDone ? '✅ Transfert terminé' : 'Démarrage...'}
              </h2>
              <div className="flex flex-col gap-2">
                {(['connect', 'schema', 'rls', 'data', 'auth', 'storage', 'functions', 'secrets'] as const).map(s => {
                  const st = stepStatuses.get(s)
                  if (!st) return null
                  return (
                    <div key={s} className="flex items-center gap-2 text-sm">
                      <StepIcon status={st} />
                      <span className="w-36 text-slate-300">{STEP_LABELS[s]}</span>
                      <span className={statusColor(st)}>{st}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live log */}
            <div className={card}>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Journal en direct</h3>
              <div ref={logRef} className="h-80 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs">
                {logs.length === 0 && <span className="text-slate-600">En attente des événements...</span>}
                {logs.map((line, i) => (
                  <div key={i} className={`mb-1 flex gap-2 ${statusColor(line.status)}`}>
                    <span className="shrink-0 text-slate-600">[{line.timestamp}]</span>
                    <span className="shrink-0 text-slate-500">{STEP_LABELS[line.step] ?? line.step}</span>
                    <span>{line.msg}</span>
                    {line.count !== undefined && <span className="ml-auto shrink-0 text-slate-500">({line.count})</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {summary && (
              <div className={card}>
                <h3 className="mb-4 text-lg font-semibold text-white">Résumé du transfert</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Tables',          value: summary.tables },
                    { label: 'Lignes copiées',  value: summary.rows },
                    { label: 'Utilisateurs',    value: summary.users },
                    { label: 'Fichiers storage', value: summary.files },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-slate-900 p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-400">{value}</div>
                      <div className="mt-1 text-xs text-slate-400">{label}</div>
                    </div>
                  ))}
                </div>

                {summary.functions.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-slate-300 mb-1">Edge Functions détectées :</div>
                    <div className="flex flex-wrap gap-1">
                      {summary.functions.map(f => (
                        <span key={f} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {summary.secrets.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-slate-300 mb-1">Secrets détectés :</div>
                    <div className="flex flex-wrap gap-1">
                      {summary.secrets.map(s => (
                        <span key={s} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {summary.warnings.length > 0 && (
                  <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <div className="mb-2 text-sm font-semibold text-yellow-300">⚠ Actions manuelles requises</div>
                    <ul className="flex flex-col gap-1">
                      {summary.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-yellow-200">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button onClick={downloadReport}
                    className="rounded-lg border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 transition">
                    Télécharger le rapport JSON
                  </button>
                  <button onClick={resetAll}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">
                    Nouveau transfert
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-600">
          Supabase Migrator — outil interne sensetho · Les connexions sont chiffrées via SSL
        </p>
      </div>
    </div>
  )
}
