'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import type { RseContext } from '@/components/rse/RseAppShell'
import {
  DOMAINS,
  PHASES,
  SCORE_LABELS,
  type Domain,
  type DiagnosticRecord,
  type DiagnosticShare as ShareEntry,
} from '@sensetho/catalogue-app/guided-diagnostic'


// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s === 0) return '#6b7280'
  if (s <= 1) return '#ef4444'
  if (s <= 2) return '#f97316'
  if (s <= 3) return '#eab308'
  if (s <= 4) return '#22c55e'
  return '#4ade80'
}

function progressColor(p: number) {
  if (p === 0) return '#6b7280'
  if (p <= 2) return '#ef4444'
  if (p <= 4) return '#f97316'
  if (p <= 6) return '#eab308'
  if (p <= 8) return '#22c55e'
  return '#4ade80'
}

// ─── ActionItem ───────────────────────────────────────────────────────────────

function ActionItem({ text, progress, na, note, isOpen, readOnly, onToggle, onSetProgress, onToggleNa, onNoteChange }: {
  text: string; progress: number; na: boolean; note: string; isOpen: boolean
  readOnly: boolean
  onToggle: () => void; onSetProgress: (v: number) => void; onToggleNa: () => void
  onNoteChange: (v: string) => void
}) {
  const done = na || progress >= 10
  return (
    <li className="rounded-lg border transition-colors"
      style={isOpen
        ? { borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.05)' }
        : { borderColor: 'transparent' }}>
      <button onClick={onToggle}
        className="w-full flex items-start gap-2 px-2 pt-1.5 pb-1 text-left">
        <span className={`shrink-0 mt-0.5 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}
          style={{ color: isOpen ? '#6366f1' : 'var(--text-muted)' }}>▶</span>
        <span className={`flex-1 text-sm leading-snug ${done ? 'line-through' : ''}`}
          style={{ color: done ? 'var(--text-muted)' : 'var(--text)' }}>{text}</span>
        {done && <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${na ? 'bg-gray-500/20 text-gray-500' : 'bg-green-500/20 text-green-600'}`}>{na ? 'N/A' : '✓'}</span>}
        {note && !done && <span className="shrink-0 text-indigo-400 text-xs">📝</span>}
      </button>

      <div className="flex items-center gap-2 px-2 pb-1.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} disabled={readOnly}
              onClick={e => { e.stopPropagation(); if (!readOnly) onSetProgress(progress === n ? 0 : n) }}
              className={`w-3.5 h-3.5 transition-all hover:scale-110 ${n === 1 ? 'rounded-l-sm' : n === 10 ? 'rounded-r-sm' : ''}`}
              style={n <= progress ? { backgroundColor: progressColor(progress) } : undefined}>
              {n > progress && <span className="block w-full h-full rounded-[inherit] bg-gray-200 dark:bg-gray-700" />}
            </button>
          ))}
        </div>
        {progress > 0 && <span className="text-xs tabular-nums w-8" style={{ color: progressColor(progress) }}>{progress}/10</span>}
        <button disabled={readOnly} onClick={e => { e.stopPropagation(); if (!readOnly) onToggleNa() }}
          className={`ml-auto text-xs px-2 py-0.5 rounded border font-medium transition-colors ${na ? 'bg-gray-500/80 text-white border-gray-500' : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-gray-500'}`}>N/A</button>
      </div>

      {isOpen && (
        <div className="px-2 pb-2">
          <textarea
            readOnly={readOnly}
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Notes, observations, pièces justificatives…"
            rows={3}
            className="w-full text-xs p-2 rounded border resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
      )}
    </li>
  )
}

// ─── ScoreSelector ────────────────────────────────────────────────────────────

function ScoreSelector({ score, readOnly, onChange }: { score: number; readOnly: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {[0, 1, 2, 3, 4, 5].map(v => (
        <button key={v} disabled={readOnly} onClick={() => onChange(v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
          style={score === v
            ? { backgroundColor: scoreColor(v), color: '#fff', borderColor: scoreColor(v) }
            : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          {v} — {SCORE_LABELS[v]}
        </button>
      ))}
    </div>
  )
}

// ─── ShareModal ───────────────────────────────────────────────────────────────

function ShareModal({ diagnosticId, onClose }: { diagnosticId: string; onClose: () => void }) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'read' | 'edit'>('read')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/guided-diagnostic/${diagnosticId}/shares`)
      .then(r => r.json())
      .then(j => { setShares(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [diagnosticId])

  async function share() {
    if (!email.trim()) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/guided-diagnostic/${diagnosticId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), permission }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShares(prev => [...prev, json.data])
    setEmail(''); setSaving(false)
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/guided-diagnostic/${diagnosticId}/shares?share_id=${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Partager ce diagnostic</h3>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Seuls les utilisateurs ayant un abonnement actif sur cette application peuvent être invités.
        </p>

        <div className="flex gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && share()}
            placeholder="email@exemple.com"
            className="flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={permission} onChange={e => setPermission(e.target.value as 'read' | 'edit')}
            className="px-2 py-1.5 text-xs border rounded-lg focus:outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="read">Lecture</option>
            <option value="edit">Édition</option>
          </select>
          <button onClick={share} disabled={saving || !email.trim()}
            className="px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#6366f1' }}>Inviter</button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {loading ? (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : shares.length === 0 ? (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Aucun partage actif</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shares.map(s => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg)' }}>
                <span className="flex-1 text-xs" style={{ color: 'var(--text)' }}>
                  {s.profiles?.full_name || s.profiles?.email}
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {s.permission === 'edit' ? 'Édition' : 'Lecture'}
                  </span>
                </span>
                <button onClick={() => removeShare(s.id)}
                  className="text-red-400 hover:text-red-600 p-0.5 rounded hover:opacity-80">
                  <Icon name="trash" size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GuidedDiagnostic({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions } = ctx

  const [diagnostic, setDiagnostic] = useState<DiagnosticRecord | null>(null)
  const [isOwner, setIsOwner] = useState(true)
  const [loadingDiag, setLoadingDiag] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [actionProgress, setActionProgress] = useState<Record<string, number>>({})
  const [actionNa, setActionNa] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4>(1)
  const [activeDomainId, setActiveDomainId] = useState<string>(DOMAINS[0].id)
  const [view, setView] = useState<'step' | 'summary'>('step')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Charger ou créer le diagnostic quand org/year change ──────────────────
  useEffect(() => {
    if (!org) { setDiagnostic(null); setScores({}); setActionProgress({}); setActionNa({}); return }
    load()

    async function load() {
      setLoadingDiag(true)
      try {
        const res = await fetch(`/api/guided-diagnostic?org_id=${org!.id}&year=${year}`)
        const json = await res.json()

        if (json.data) {
          const d = json.data as DiagnosticRecord
          setDiagnostic(d)
          setIsOwner(json.isOwner ?? true)
          setScores(d.scores ?? {})
          setActionProgress(d.action_progress ?? {})
          setActionNa(d.action_na ?? {})
          setAiAnalysis(d.ai_analysis ?? null)
          // Charger les notes
          const nr = await fetch(`/api/guided-diagnostic/${d.id}/notes`)
          if (nr.ok) { const nj = await nr.json(); setNotes(nj.data ?? {}) }
        } else {
          // Créer automatiquement
          const cr = await fetch('/api/guided-diagnostic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org!.id, year }),
          })
          if (cr.ok) {
            const cj = await cr.json()
            setDiagnostic(cj.data)
            setIsOwner(true)
            setScores({}); setActionProgress({}); setActionNa({}); setNotes({})
            setAiAnalysis(null)
          }
        }
      } finally {
        setLoadingDiag(false)
      }
    }
  }, [org?.id, year]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Injecter les boutons dans le header RSE ───────────────────────────────
  useEffect(() => {
    if (!diagnostic) { setActions(null); return }
    setActions(
      <div className="flex items-center gap-2">
        {/* Statut sauvegarde */}
        {saveStatus === 'saving' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Enregistrement…</span>}
        {saveStatus === 'saved'  && <span className="text-xs text-green-500">✓ Enregistré</span>}
        {/* Partager */}
        {isOwner && (
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="share" size={13} /> Partager
          </button>
        )}
        {/* Vue */}
        <button onClick={() => setView(v => v === 'step' ? 'summary' : 'step')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Icon name={view === 'step' ? 'barChart' : 'list'} size={13} />
          {view === 'step' ? 'Synthèse' : 'Questionnaire'}
        </button>
      </div>
    )
  }, [diagnostic, saveStatus, isOwner, view]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounce save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((newScores: Record<string, number>, newProgress: Record<string, number>, newNa: Record<string, boolean>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!diagnostic) return
      setSaveStatus('saving')
      try {
        await fetch(`/api/guided-diagnostic/${diagnostic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: newScores, action_progress: newProgress, action_na: newNa }),
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('idle') }
    }, 700)
  }, [diagnostic])

  function setScore(domainId: string, score: number) {
    const s = { ...scores, [domainId]: score }
    setScores(s); scheduleSave(s, actionProgress, actionNa)
  }

  function setProgress(key: string, value: number) {
    const p = { ...actionProgress, [key]: value }
    setActionProgress(p); scheduleSave(scores, p, actionNa)
  }

  function toggleNa(key: string) {
    const n = { ...actionNa, [key]: !actionNa[key] }
    setActionNa(n); scheduleSave(scores, actionProgress, n)
  }

  function updateNote(key: string, value: string) {
    setNotes(prev => ({ ...prev, [key]: value }))
    if (noteSaveTimers.current[key]) clearTimeout(noteSaveTimers.current[key])
    noteSaveTimers.current[key] = setTimeout(() => {
      if (!diagnostic) return
      fetch(`/api/guided-diagnostic/${diagnostic.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: key, content: value }),
      })
    }, 800)
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async function generateAnalysis() {
    if (!diagnostic || generatingAI) return
    setGeneratingAI(true); setAiError(null)
    try {
      const res = await fetch(`/api/guided-diagnostic/${diagnostic.id}/analyze`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setAiError(json.error); return }
      setAiAnalysis(json.analysis)
    } catch (e) { setAiError(String(e)) }
    finally { setGeneratingAI(false) }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const evaluatedCount = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).length
  const avgScore = evaluatedCount > 0
    ? DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).reduce((s, d) => s + scores[d.id], 0) / evaluatedCount
    : 0
  const readOnly = !isOwner

  const activeDomain = DOMAINS.find(d => d.id === activeDomainId)!
  const phaseForActive = PHASES.find(p => p.id === activeDomain?.phase)!

  // ── Pas d'org sélectionnée ────────────────────────────────────────────────
  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-5xl">🏢</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sélectionnez une organisation dans le panneau de gauche<br />pour commencer le diagnostic.
        </p>
      </div>
    )
  }

  if (loadingDiag) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!diagnostic) {
    return <div className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>Impossible de charger le diagnostic.</div>
  }

  // ── Vue SYNTHÈSE ──────────────────────────────────────────────────────────
  if (view === 'summary') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Bouton retour questionnaire */}
        <button onClick={() => setView('step')}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Icon name="chevronLeft" size={14} />
          Retour au questionnaire
        </button>

        {/* Scores globaux */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
            Synthèse — {evaluatedCount}/{DOMAINS.length} domaines évalués
          </h3>
          {evaluatedCount > 0 && (
            <p className="text-xs mb-4 font-semibold text-green-600 dark:text-green-400">
              Score moyen : {avgScore.toFixed(1)}/5 — {SCORE_LABELS[Math.round(avgScore)]}
            </p>
          )}
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Cliquez sur un domaine pour l&apos;évaluer ou le modifier.
          </p>
          {PHASES.map(phase => {
            const pDomains = DOMAINS.filter(d => d.phase === phase.id)
            return (
              <div key={phase.id} className="mb-5">
                <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: phase.color }}>
                  Phase {phase.id} — {phase.label}
                </div>
                <div className="space-y-2">
                  {pDomains.map(d => {
                    const s = scores[d.id] ?? 0
                    return (
                      <button
                        key={d.id}
                        onClick={() => { setActiveDomainId(d.id); setActivePhase(d.phase); setView('step') }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60 group"
                        style={{ border: '1px solid var(--border)' }}>
                        <span className="text-xs flex-1 font-medium group-hover:underline" style={{ color: 'var(--text)' }}>
                          {d.qcIcone} {d.nom}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-600">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(s / 5) * 100}%`, backgroundColor: scoreColor(s) }} />
                          </div>
                          <span className="text-xs font-semibold w-10 tabular-nums text-right" style={{ color: s > 0 ? scoreColor(s) : 'var(--text-muted)' }}>
                            {s > 0 ? `${s}/5` : '—'}
                          </span>
                        </div>
                        <Icon name="chevronRight" size={12} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Analyse IA */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>✨ Analyse IA</h3>
            {!readOnly && (
              <button onClick={generateAnalysis} disabled={generatingAI || evaluatedCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#6366f1' }}>
                {generatingAI ? '⏳ Génération…' : aiAnalysis ? '↻ Mettre à jour' : '✨ Générer'}
              </button>
            )}
          </div>
          {aiError && <p className="text-xs text-red-500 mb-2">{aiError}</p>}
          {evaluatedCount === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Évaluez au moins un domaine pour générer l&apos;analyse.</p>}
          {aiAnalysis ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {aiAnalysis.split('\n').map((line, i) => (
                <p key={i} className="text-sm mb-2 last:mb-0" style={{ color: 'var(--text)' }}>
                  {line.startsWith('**') ? <strong>{line.replace(/\*\*/g, '')}</strong> : line}
                </p>
              ))}
            </div>
          ) : (
            !generatingAI && evaluatedCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cliquez sur &quot;Générer&quot; pour obtenir une analyse personnalisée.</p>
            )
          )}
        </div>
      </div>
    )
  }

  // ── Vue QUESTIONNAIRE ─────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 max-w-5xl mx-auto">
      {/* Colonne phases + domaines */}
      <div className="w-52 flex-shrink-0">
        <div className="sticky top-0 space-y-1">
          {PHASES.map(phase => {
            const pDomains = DOMAINS.filter(d => d.phase === phase.id)
            const evaluated = pDomains.filter(d => (scores[d.id] ?? 0) > 0).length
            return (
              <div key={phase.id}>
                <button onClick={() => { setActivePhase(phase.id); setActiveDomainId(pDomains[0].id) }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors"
                  style={activePhase === phase.id
                    ? { backgroundColor: phase.bg, color: phase.color, border: `1px solid ${phase.border}` }
                    : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
                  <span className="flex-1">Phase {phase.id} — {phase.label}</span>
                  <span className="text-[10px] font-normal">{evaluated}/{pDomains.length}</span>
                </button>
                {activePhase === phase.id && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {pDomains.map(d => {
                      const s = scores[d.id] ?? 0
                      return (
                        <button key={d.id} onClick={() => setActiveDomainId(d.id)}
                          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs transition-colors"
                          style={activeDomainId === d.id
                            ? { backgroundColor: 'var(--bg-card)', color: 'var(--text)', fontWeight: 500 }
                            : { color: 'var(--text-muted)' }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: scoreColor(s) }} />
                          <span className="flex-1 truncate">{d.nom}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Bouton synthèse */}
          <button onClick={() => setView('summary')}
            className="w-full mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-center border transition-colors"
            style={{ borderColor: '#6366f1', color: '#6366f1', borderStyle: 'dashed' }}>
            📊 Voir la synthèse
          </button>
        </div>
      </div>

      {/* Domaine actif */}
      {activeDomain && (
        <div className="flex-1 min-w-0 rounded-xl border p-5"
          style={{ borderColor: phaseForActive.border, backgroundColor: `${phaseForActive.bg}` }}>

          {/* En-tête domaine */}
          <div className="mb-4">
            <div className="text-xs font-semibold mb-0.5" style={{ color: phaseForActive.color }}>
              Phase {phaseForActive.id} — {phaseForActive.label}
            </div>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>
              {activeDomain.qcIcone} {activeDomain.nom}
            </h2>
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{activeDomain.rationale}</p>
          </div>

          {/* Score de maturité */}
          <div className="mb-5">
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Niveau de maturité RSE
            </label>
            <ScoreSelector score={scores[activeDomain.id] ?? 0} readOnly={readOnly}
              onChange={v => setScore(activeDomain.id, v)} />
          </div>

          {/* Actions prioritaires */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Actions prioritaires
            </label>
            <ul className="space-y-1">
              {activeDomain.focusActionIndices
                .filter(i => i < activeDomain.actions.length)
                .map(i => {
                  const key = `${activeDomain.id}_${i}`
                  return (
                    <ActionItem key={key} text={activeDomain.actions[i]}
                      progress={actionProgress[key] ?? 0}
                      na={actionNa[key] ?? false}
                      note={notes[key] ?? ''}
                      isOpen={expandedKey === key}
                      readOnly={readOnly}
                      onToggle={() => setExpandedKey(prev => prev === key ? null : key)}
                      onSetProgress={v => setProgress(key, v)}
                      onToggleNa={() => toggleNa(key)}
                      onNoteChange={v => updateNote(key, v)} />
                  )
                })}
            </ul>
          </div>

          {/* Navigation entre domaines */}
          <div className="flex justify-between mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {(() => {
              const idx = DOMAINS.findIndex(d => d.id === activeDomainId)
              const prev = DOMAINS[idx - 1]
              const next = DOMAINS[idx + 1]
              return (
                <>
                  <button onClick={() => { if (prev) { setActiveDomainId(prev.id); setActivePhase(prev.phase) } }}
                    disabled={!prev}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-700"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <Icon name="chevronLeft" size={14} />
                    {prev ? `${prev.qcIcone} ${prev.nom}`.substring(0, 24) + '…' : 'Précédent'}
                  </button>
                  {next ? (
                    <button onClick={() => { setActiveDomainId(next.id); setActivePhase(next.phase) }}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors"
                      style={{ backgroundColor: phaseForActive.color }}>
                      {`${next.qcIcone} ${next.nom}`.substring(0, 24) + '…'}
                      <Icon name="chevronRight" size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setView('summary')}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent)' }}>
                      Voir la synthèse
                      <Icon name="barChart" size={14} />
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {showShare && diagnostic && (
        <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
