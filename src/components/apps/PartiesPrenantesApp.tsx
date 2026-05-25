'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  PPSession,
  Stakeholder,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  MaterialityScore,
} from '@/types/parties-prenantes'
import { ESRS_TOPICS, STAKEHOLDER_TYPES, MATERIALITY_THRESHOLD } from '@/data/pp-questionnaires'
import type { RseContext } from '@/components/rse/RseAppShell'

const PPNotePanel = dynamic(() => import('./GuidedActionNotePanel'), { ssr: false, loading: () => null })

// ─── Types internes ───────────────────────────────────────────────────────────

type SessionListItem = Omit<PPSession, 'stakeholders' | 'surveys' | 'materiality_scores' | 'session_notes'>

// ─── Tutorial Modal ───────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: 'Bienvenue dans Parties Prenantes & Matérialité',
    icon: '👥',
    content: 'Cartographiez vos parties prenantes et évaluez la matérialité de vos enjeux ESG selon le cadre CSRD/ESRS.',
  },
  {
    title: 'Cartographie',
    icon: '🗺️',
    content: 'Identifiez et qualifiez vos parties prenantes (internes/externes) avec leur niveau d\'influence et d\'intérêt pour votre organisation.',
  },
  {
    title: 'Matrice Influence × Intérêt',
    icon: '📊',
    content: 'Visualisez vos parties prenantes dans les 4 quadrants stratégiques : Gérer activement, Satisfaire, Informer, Surveiller.',
  },
  {
    title: 'Enquêtes de matérialité',
    icon: '📋',
    content: 'Créez des questionnaires ESRS (simple ou double matérialité) et collectez les réponses de vos parties prenantes via lien de partage ou invitation email.',
  },
  {
    title: 'Bibliothèque ESRS',
    icon: '📚',
    content: 'Accédez aux 10 thèmes ESRS (E1-E5, S1-S4, G1) avec leurs questions adaptées à la CSRD. Filtrez par catégorie E, S ou G.',
  },
  {
    title: 'Notes & Documents',
    icon: '📝',
    content: 'Documentez vos analyses et joignez des preuves pour chaque session. Utilisez l\'éditeur riche pour structurer vos observations.',
  },
]

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = TUTORIAL_STEPS[step]
  const isLast = step === TUTORIAL_STEPS.length - 1

  function handleClose() {
    localStorage.setItem('pp_tutorial_seen', '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{current.icon}</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{current.title}</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8 leading-relaxed">
          {current.content}
        </p>
        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mb-8">
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Précédent
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
            >
              Suivant
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
            >
              {"C'est parti !"}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          Passer le tutoriel
        </button>
      </div>
    </div>
  )
}

// ─── Radar ESG ────────────────────────────────────────────────────────────────

function ESGRadar({ sessions }: { sessions: (SessionListItem & { materiality_scores?: MaterialityScore[] })[] }) {
  const categories: Array<{ key: 'E' | 'S' | 'G'; label: string; color: string; fill: string }> = [
    { key: 'E', label: 'Environnement', color: '#10b981', fill: '#10b98133' },
    { key: 'S', label: 'Social', color: '#f59e0b', fill: '#f59e0b33' },
    { key: 'G', label: 'Gouvernance', color: '#8b5cf6', fill: '#8b5cf633' },
  ]

  // Agréger les scores de toutes les sessions
  const allScores: MaterialityScore[] = sessions.flatMap(s => (s as PPSession).materiality_scores ?? [])

  const catValues = categories.map(cat => {
    const topicIds = ESRS_TOPICS.filter(t => t.category === cat.key).map(t => t.id)
    const relevant = allScores.filter(s => topicIds.includes(s.esrs))
    if (relevant.length === 0) return 0
    const avg = relevant.reduce((sum, s) => sum + s.combined_score, 0) / relevant.length
    return Math.min(100, Math.max(0, avg))
  })

  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 80

  // 3 axes à 120° d'écart, premier axe à -90° (haut)
  const angles = [-90, 30, 150].map(a => (a * Math.PI) / 180)

  function valueToPoint(value: number, angleIndex: number) {
    const ratio = value / 100
    const x = cx + r * ratio * Math.cos(angles[angleIndex])
    const y = cy + r * ratio * Math.sin(angles[angleIndex])
    return { x, y }
  }

  function gridPoint(ratio: number, angleIndex: number) {
    const x = cx + r * ratio * Math.cos(angles[angleIndex])
    const y = cy + r * ratio * Math.sin(angles[angleIndex])
    return `${x},${y}`
  }

  const dataPoints = catValues.map((v, i) => valueToPoint(v, i))
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Radar de maturité ESG (toutes sessions)
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <svg width={size} height={size} className="flex-shrink-0">
          {/* Grilles */}
          {gridLevels.map(lvl => (
            <polygon
              key={lvl}
              points={[0, 1, 2].map(i => gridPoint(lvl, i)).join(' ')}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
              className="dark:stroke-gray-600"
            />
          ))}
          {/* Axes */}
          {angles.map((angle, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(angle)}
              y2={cy + r * Math.sin(angle)}
              stroke="#e5e7eb"
              strokeWidth="1"
              className="dark:stroke-gray-600"
            />
          ))}
          {/* Polygon données */}
          {catValues.some(v => v > 0) && (
            <polygon
              points={polygon}
              fill="rgba(16,185,129,0.15)"
              stroke="#10b981"
              strokeWidth="2"
            />
          )}
          {/* Points */}
          {dataPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill={categories[i].color}
            />
          ))}
          {/* Labels axes */}
          {angles.map((angle, i) => {
            const labelR = r + 18
            const lx = cx + labelR * Math.cos(angle)
            const ly = cy + labelR * Math.sin(angle)
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="600"
                fill={categories[i].color}
              >
                {categories[i].key}
              </text>
            )
          })}
          {/* % labels */}
          {[25, 50, 75, 100].map((pct, i) => (
            <text
              key={pct}
              x={cx + 4}
              y={cy - r * gridLevels[i] - 2}
              fontSize="8"
              fill="#9ca3af"
            >
              {pct}%
            </text>
          ))}
        </svg>
        {/* Légende */}
        <div className="flex flex-col gap-2">
          {categories.map((cat, i) => (
            <div key={cat.key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-medium" style={{ color: cat.color }}>{cat.key}</span>
              <span>— {cat.label}</span>
              <span className="ml-auto font-semibold" style={{ color: cat.color }}>
                {catValues[i].toFixed(0)}%
              </span>
            </div>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Score moyen de matérialité par catégorie
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Modal nouvelle session ───────────────────────────────────────────────────

function NewSessionModal({
  onClose,
  onCreated,
  initialOrganisation = '',
  initialSecteur = '',
}: {
  onClose: () => void
  onCreated: (session: PPSession) => void
  initialOrganisation?: string
  initialSecteur?: string
}) {
  const [name, setName] = useState('')
  const [organisation, setOrganisation] = useState(initialOrganisation)
  const [secteur, setSecteur] = useState(initialSecteur)
  const [exercice, setExercice] = useState(new Date().getFullYear().toString())
  const [mode, setMode] = useState<'csrd' | 'voluntaire' | 'both'>('csrd')
  const [materialityType, setMaterialityType] = useState<'simple' | 'double'>('double')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom de la session est requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/parties-prenantes/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), organisation, secteur, exercice, mode, materiality_type: materialityType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      onCreated({ ...json.data, stakeholders: [], surveys: [], materiality_scores: [] } as PPSession)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nouvelle session</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom de la session *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Engagement parties prenantes CSRD 2025"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisation</label>
            <input
              type="text"
              value={organisation}
              onChange={e => setOrganisation(e.target.value)}
              placeholder="Nom de votre organisation"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secteur</label>
              <input
                type="text"
                value={secteur}
                onChange={e => setSecteur(e.target.value)}
                placeholder="Ex: Industrie"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercice</label>
              <input
                type="text"
                value={exercice}
                onChange={e => setExercice(e.target.value)}
                placeholder="2025"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mode d&apos;engagement</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as typeof mode)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="csrd">CSRD — Obligatoire</option>
              <option value="voluntaire">Volontaire</option>
              <option value="both">Les deux</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de matérialité</label>
            <select
              value={materialityType}
              onChange={e => setMaterialityType(e.target.value as typeof materialityType)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="double">Double matérialité (CSRD)</option>
              <option value="simple">Simple matérialité</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium transition-colors text-sm"
            >
              {saving ? 'Création...' : 'Créer la session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tab Notes ────────────────────────────────────────────────────────────────

function TabNotes({ session }: { session: PPSession }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Notes & documents</h3>
        <p className="text-sm text-gray-500 dark:text-gray-300 mt-0.5">
          Documentez votre analyse, ajoutez vos sources et pièces justificatives.
        </p>
      </div>
      <PPNotePanel
        apiBase="/api/parties-prenantes"
        noteTable="pp_session_notes"
        diagnosticId={session.id}
        actionKey="session"
        readOnly={false}
        note=""
        onNoteChange={() => {}}
        initialSections={[]}
        notesRemoteVersion={0}
        onSectionsChange={() => {}}
      />
    </div>
  )
}

// ─── Tab Parties Prenantes ────────────────────────────────────────────────────

function TabStakeholders({
  session,
  onUpdate,
}: {
  session: PPSession
  onUpdate: (patch: Partial<PPSession>) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    name: string
    organisation: string
    email: string
    category: 'interne' | 'externe'
    type: string
    influence: number
    interest: number
    engagement_type: 'csrd' | 'voluntaire' | 'both'
    notes: string
  }>({
    name: '', organisation: '', email: '', category: 'externe', type: 'clients',
    influence: 3, interest: 3, engagement_type: 'csrd', notes: '',
  })

  function resetForm() {
    setForm({ name: '', organisation: '', email: '', category: 'externe', type: 'clients', influence: 3, interest: 3, engagement_type: 'csrd', notes: '' })
    setEditId(null)
    setShowAdd(false)
  }

  function handleEdit(s: Stakeholder) {
    setForm({
      name: s.name,
      organisation: s.organisation ?? '',
      email: s.email ?? '',
      category: s.category,
      type: s.type,
      influence: s.influence,
      interest: s.interest,
      engagement_type: s.engagement_type,
      notes: s.notes ?? '',
    })
    setEditId(s.id)
    setShowAdd(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    let updated: Stakeholder[]
    if (editId) {
      updated = session.stakeholders.map(s =>
        s.id === editId
          ? { ...s, ...form, influence: form.influence as Stakeholder['influence'], interest: form.interest as Stakeholder['interest'] }
          : s
      )
    } else {
      const newOne: Stakeholder = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        organisation: form.organisation || undefined,
        email: form.email || undefined,
        category: form.category,
        type: form.type,
        influence: form.influence as Stakeholder['influence'],
        interest: form.interest as Stakeholder['interest'],
        engagement_type: form.engagement_type,
        notes: form.notes || undefined,
        created_at: now,
      }
      updated = [...session.stakeholders, newOne]
    }
    onUpdate({ stakeholders: updated })
    resetForm()
  }

  function handleDelete(id: string) {
    onUpdate({ stakeholders: session.stakeholders.filter(s => s.id !== id) })
  }

  const stakeholderTypeLabel = (type: string) =>
    STAKEHOLDER_TYPES.find(t => t.value === type)?.label ?? type

  const interne = session.stakeholders.filter(s => s.category === 'interne')
  const externe = session.stakeholders.filter(s => s.category === 'externe')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Cartographie des parties prenantes</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {session.stakeholders.length} partie{session.stakeholders.length !== 1 ? 's' : ''} prenante{session.stakeholders.length !== 1 ? 's' : ''} identifiée{session.stakeholders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditId(null) }}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
            {editId ? 'Modifier la partie prenante' : 'Nouvelle partie prenante'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom *"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            <input
              type="text"
              value={form.organisation}
              onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))}
              placeholder="Organisation"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as 'interne' | 'externe' }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="interne">Interne</option>
              <option value="externe">Externe</option>
            </select>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              {STAKEHOLDER_TYPES.filter(t => t.category === form.category).map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={form.engagement_type}
              onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value as typeof form.engagement_type }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="csrd">CSRD</option>
              <option value="voluntaire">Volontaire</option>
              <option value="both">Les deux</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Influence : {form.influence}/5
              </label>
              <input type="range" min="1" max="5" value={form.influence}
                onChange={e => setForm(f => ({ ...f, influence: Number(e.target.value) }))}
                className="w-full accent-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Intérêt : {form.interest}/5
              </label>
              <input type="range" min="1" max="5" value={form.interest}
                onChange={e => setForm(f => ({ ...f, interest: Number(e.target.value) }))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optionnel)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
              {editId ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {session.stakeholders.length === 0 && !showAdd && (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-2">👥</p>
          <p className="text-sm">Aucune partie prenante identifiée</p>
          <p className="text-xs mt-1">Cliquez sur &quot;Ajouter&quot; pour commencer la cartographie</p>
        </div>
      )}

      {[{ label: 'Internes', items: interne, color: 'blue' }, { label: 'Externes', items: externe, color: 'purple' }].map(group => (
        group.items.length > 0 && (
          <div key={group.label}>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {group.label} ({group.items.length})
            </h4>
            <div className="space-y-2">
              {group.items.map(s => {
                const stType = STAKEHOLDER_TYPES.find(t => t.value === s.type)
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xl flex-shrink-0">{stType?.icon ?? '👤'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.name}</span>
                        {s.organisation && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate">— {s.organisation}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{stakeholderTypeLabel(s.type)}</span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Influence {s.influence}/5</span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Intérêt {s.interest}/5</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(s)} className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Modifier">✏️</button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Supprimer">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

// ─── Tab Matrice Influence × Intérêt ─────────────────────────────────────────

function TabMatrix({ session }: { session: PPSession }) {
  const quadrants = [
    { label: 'Gérer activement', desc: 'Influence ↑ / Intérêt ↑', color: '#10b981', bg: '#ecfdf5', filter: (s: Stakeholder) => s.influence >= 3 && s.interest >= 3 },
    { label: 'Satisfaire', desc: 'Influence ↑ / Intérêt ↓', color: '#3b82f6', bg: '#eff6ff', filter: (s: Stakeholder) => s.influence >= 3 && s.interest < 3 },
    { label: 'Informer', desc: 'Influence ↓ / Intérêt ↑', color: '#f59e0b', bg: '#fffbeb', filter: (s: Stakeholder) => s.influence < 3 && s.interest >= 3 },
    { label: 'Surveiller', desc: 'Influence ↓ / Intérêt ↓', color: '#6b7280', bg: '#f9fafb', filter: (s: Stakeholder) => s.influence < 3 && s.interest < 3 },
  ]

  if (session.stakeholders.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        <p className="text-4xl mb-2">📊</p>
        <p className="text-sm">Aucune partie prenante à afficher</p>
        <p className="text-xs mt-1">Ajoutez des parties prenantes dans l&apos;onglet &quot;Parties prenantes&quot;</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Matrice Influence × Intérêt</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Positionnement stratégique de vos parties prenantes</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {quadrants.map(q => {
          const items = session.stakeholders.filter(q.filter)
          return (
            <div
              key={q.label}
              className="rounded-xl p-3 border"
              style={{ borderColor: q.color + '40', backgroundColor: q.bg }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: q.color }} />
                <span className="text-xs font-semibold" style={{ color: q.color }}>{q.label}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{q.desc}</p>
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune partie prenante</p>
              ) : (
                <div className="space-y-1">
                  {items.map(s => {
                    const st = STAKEHOLDER_TYPES.find(t => t.value === s.type)
                    return (
                      <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <span>{st?.icon ?? '👤'}</span>
                        <span className="truncate">{s.name}</span>
                        {s.organisation && <span className="text-gray-400 dark:text-gray-500 truncate">({s.organisation})</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-2 text-xs font-medium" style={{ color: q.color }}>
                {items.length} partie{items.length !== 1 ? 's' : ''} prenante{items.length !== 1 ? 's' : ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab Bibliothèque ESRS ────────────────────────────────────────────────────

function TabLibrary() {
  const [filterCat, setFilterCat] = useState<'all' | 'E' | 'S' | 'G'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = ESRS_TOPICS.filter(t => filterCat === 'all' || t.category === filterCat)

  const catColors: Record<string, string> = { E: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400', S: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', G: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400' }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Bibliothèque ESRS</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">10 thèmes ESRS avec questions adaptées CSRD</p>
      </div>
      <div className="flex gap-2">
        {(['all', 'E', 'S', 'G'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterCat === cat
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? 'Tous' : cat}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(topic => (
          <div key={topic.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === topic.id ? null : topic.id)}
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
            >
              <span className="text-xl">{topic.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${catColors[topic.category]}`}>{topic.id}</span>
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{topic.name}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{topic.description}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{topic.questions.length} questions</span>
              <span className="text-gray-400 flex-shrink-0">{expanded === topic.id ? '▲' : '▼'}</span>
            </button>
            {expanded === topic.id && (
              <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                {topic.questions.map(q => (
                  <div key={q.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <span className={`flex-shrink-0 mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
                        q.dimension === 'impact' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                        q.dimension === 'financial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {q.dimension === 'impact' ? 'Impact' : q.dimension === 'financial' ? 'Financier' : 'Général'}
                      </span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{q.text}</p>
                    </div>
                    {q.help && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-10 italic">{q.help}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab Enquêtes ─────────────────────────────────────────────────────────────

function TabSurveys({
  session,
  onUpdate,
}: {
  session: PPSession
  onUpdate: (patch: Partial<PPSession>) => void
}) {
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardName, setWizardName] = useState('')
  const [wizardDesc, setWizardDesc] = useState('')
  const [wizardType, setWizardType] = useState<'simple' | 'double'>('double')
  const [wizardTopics, setWizardTopics] = useState<string[]>([])
  const [wizardStakeholders, setWizardStakeholders] = useState<string[]>([])
  const [wizardAnonymous, setWizardAnonymous] = useState(false)
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null)
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ sent: string[]; failed: string[] } | null>(null)
  const [shareLoading, setShareLoading] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [showInviteFor, setShowInviteFor] = useState<string | null>(null)
  const [showResponseFor, setShowResponseFor] = useState<string | null>(null)
  const [responseForm, setResponseForm] = useState<{
    stakeholderId: string
    answers: Record<string, number>
  }>({ stakeholderId: '', answers: {} })

  function toggleTopic(id: string) {
    setWizardTopics(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])
  }

  function toggleStakeholder(id: string) {
    setWizardStakeholders(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function handleCreateSurvey() {
    if (!wizardName.trim() || wizardTopics.length === 0) return
    const now = new Date().toISOString()
    const questions: SurveyQuestion[] = ESRS_TOPICS
      .filter(t => wizardTopics.includes(t.id))
      .flatMap(t => t.questions
        .filter(q => wizardType === 'double' || q.dimension !== 'financial')
        .map(q => ({
          id: q.id,
          esrs: q.esrs,
          esrs_name: q.esrs_name,
          dimension: q.dimension,
          text: q.text,
          required: true,
        }))
      )
    const newSurvey: Survey = {
      id: crypto.randomUUID(),
      name: wizardName.trim(),
      description: wizardDesc || undefined,
      materiality_type: wizardType,
      status: 'brouillon',
      esrs_topics: wizardTopics,
      questions,
      stakeholder_ids: wizardStakeholders,
      responses: [],
      created_at: now,
      updated_at: now,
      anonymous: wizardAnonymous,
      share_token: null,
      token_expires_at: null,
    }
    onUpdate({ surveys: [...session.surveys, newSurvey] })
    setShowWizard(false)
    setWizardStep(0)
    setWizardName('')
    setWizardDesc('')
    setWizardTopics([])
    setWizardStakeholders([])
    setWizardAnonymous(false)
  }

  function handleDeleteSurvey(id: string) {
    onUpdate({ surveys: session.surveys.filter(s => s.id !== id) })
    if (activeSurveyId === id) setActiveSurveyId(null)
  }

  function handleStatusChange(surveyId: string, status: Survey['status']) {
    onUpdate({
      surveys: session.surveys.map(s => s.id === surveyId ? { ...s, status, updated_at: new Date().toISOString() } : s)
    })
  }

  async function handleGenerateShare(surveyId: string) {
    setShareLoading(surveyId)
    try {
      const res = await fetch(`/api/parties-prenantes/sessions/${session.id}/surveys/${surveyId}/share`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onUpdate({
        surveys: session.surveys.map(s => s.id === surveyId
          ? { ...s, share_token: json.data.token, token_expires_at: json.data.expires_at }
          : s
        )
      })
    } catch (e) {
      console.error(e)
    } finally {
      setShareLoading(null)
    }
  }

  async function handleRevokeShare(surveyId: string) {
    setShareLoading(surveyId)
    try {
      await fetch(`/api/parties-prenantes/sessions/${session.id}/surveys/${surveyId}/share`, { method: 'DELETE' })
      onUpdate({
        surveys: session.surveys.map(s => s.id === surveyId
          ? { ...s, share_token: null, token_expires_at: null }
          : s
        )
      })
    } finally {
      setShareLoading(null)
    }
  }

  function copyShareUrl(token: string) {
    const url = `https://app.sensetho.fr/enquete/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  async function handleSendInvites(surveyId: string) {
    const emails = inviteEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setInviteSending(true)
    try {
      const res = await fetch(`/api/parties-prenantes/sessions/${session.id}/surveys/${surveyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const json = await res.json()
      setInviteResult(json.data)
      setInviteEmails('')
    } catch (e) {
      console.error(e)
    } finally {
      setInviteSending(false)
    }
  }

  function handleAddResponse(surveyId: string) {
    const survey = session.surveys.find(s => s.id === surveyId)
    if (!survey || !responseForm.stakeholderId) return
    const stakeholder = session.stakeholders.find(s => s.id === responseForm.stakeholderId)
    if (!stakeholder) return

    const response: SurveyResponse = {
      stakeholder_id: stakeholder.id,
      stakeholder_name: stakeholder.name,
      completed_at: new Date().toISOString(),
      answers: responseForm.answers,
    }

    const updatedSurveys = session.surveys.map(s => {
      if (s.id !== surveyId) return s
      const existing = s.responses.findIndex(r => r.stakeholder_id === stakeholder.id)
      const responses = existing >= 0
        ? s.responses.map((r, i) => i === existing ? response : r)
        : [...s.responses, response]
      return { ...s, responses, updated_at: new Date().toISOString() }
    })

    // Recalculer les scores de matérialité
    const scores = computeMaterialityScores(updatedSurveys)

    onUpdate({ surveys: updatedSurveys, materiality_scores: scores })
    setShowResponseFor(null)
    setResponseForm({ stakeholderId: '', answers: {} })
  }

  function computeMaterialityScores(surveys: Survey[]): MaterialityScore[] {
    const topicMap = new Map<string, { impact: number[]; financial: number[]; name: string }>()

    for (const survey of surveys) {
      for (const response of survey.responses) {
        for (const question of survey.questions) {
          const score = response.answers[question.id]
          if (score === undefined) continue
          if (!topicMap.has(question.esrs)) {
            topicMap.set(question.esrs, { impact: [], financial: [], name: question.esrs_name })
          }
          const entry = topicMap.get(question.esrs)!
          if (question.dimension === 'impact') entry.impact.push(score)
          else if (question.dimension === 'financial') entry.financial.push(score)
        }
      }
    }

    const result: MaterialityScore[] = []
    Array.from(topicMap.entries()).forEach(([esrs, data]) => {
      const impactAvg = data.impact.length > 0 ? data.impact.reduce((a: number, b: number) => a + b, 0) / data.impact.length : 0
      const financialAvg = data.financial.length > 0 ? data.financial.reduce((a: number, b: number) => a + b, 0) / data.financial.length : 0
      const impactScore = (impactAvg / 5) * 100
      const financialScore = (financialAvg / 5) * 100
      const combined = Math.max(impactScore, financialScore)
      result.push({
        esrs,
        esrs_name: data.name,
        impact_score: impactScore,
        financial_score: financialScore,
        combined_score: combined,
        is_material: combined >= MATERIALITY_THRESHOLD,
        respondents: Math.max(data.impact.length, data.financial.length),
      })
    })

    return result.sort((a: MaterialityScore, b: MaterialityScore) => b.combined_score - a.combined_score)
  }

  const statusColors: Record<Survey['status'], string> = {
    brouillon: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    terminé: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  const statusLabels: Record<Survey['status'], string> = {
    brouillon: 'Brouillon',
    en_cours: 'En cours',
    terminé: 'Terminé',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Enquêtes de matérialité</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.surveys.length} enquête{session.surveys.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowWizard(true); setWizardStep(0) }}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          + Nouvelle enquête
        </button>
      </div>

      {/* Wizard création enquête */}
      {showWizard && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              Nouvelle enquête — Étape {wizardStep + 1}/3
            </h4>
            <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
          </div>

          {wizardStep === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Informations générales</p>
              <input
                type="text"
                value={wizardName}
                onChange={e => setWizardName(e.target.value)}
                placeholder="Nom de l'enquête *"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
              <textarea
                value={wizardDesc}
                onChange={e => setWizardDesc(e.target.value)}
                placeholder="Description (optionnel)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type de matérialité</label>
                  <select
                    value={wizardType}
                    onChange={e => setWizardType(e.target.value as typeof wizardType)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  >
                    <option value="double">Double matérialité</option>
                    <option value="simple">Simple matérialité</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardAnonymous}
                      onChange={e => setWizardAnonymous(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Anonyme</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sélectionnez les thèmes ESRS à inclure ({wizardTopics.length} sélectionné{wizardTopics.length !== 1 ? 's' : ''})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {ESRS_TOPICS.map(topic => (
                  <label key={topic.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    wizardTopics.includes(topic.id)
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                    <input
                      type="checkbox"
                      checked={wizardTopics.includes(topic.id)}
                      onChange={() => toggleTopic(topic.id)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>{topic.icon}</span>
                    <div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{topic.id}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">{topic.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Parties prenantes cibles ({wizardStakeholders.length} sélectionnée{wizardStakeholders.length !== 1 ? 's' : ''})</p>
              {session.stakeholders.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune partie prenante disponible. Vous pourrez en ajouter plus tard.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {session.stakeholders.map(s => {
                    const st = STAKEHOLDER_TYPES.find(t => t.value === s.type)
                    return (
                      <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        wizardStakeholders.includes(s.id)
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={wizardStakeholders.includes(s.id)}
                          onChange={() => toggleStakeholder(s.id)}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span>{st?.icon ?? '👤'}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.name}</span>
                        {s.organisation && <span className="text-xs text-gray-400">— {s.organisation}</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {wizardStep > 0 && (
              <button onClick={() => setWizardStep(w => w - 1)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Précédent
              </button>
            )}
            {wizardStep < 2 ? (
              <button
                onClick={() => setWizardStep(w => w + 1)}
                disabled={wizardStep === 0 && !wizardName.trim()}
                className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Suivant
              </button>
            ) : (
              <button
                onClick={handleCreateSurvey}
                disabled={wizardTopics.length === 0}
                className="flex-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Créer l&apos;enquête ({wizardTopics.reduce((n, id) => {
                  const t = ESRS_TOPICS.find(e => e.id === id)
                  return n + (t?.questions.filter(q => wizardType === 'double' || q.dimension !== 'financial').length ?? 0)
                }, 0)} questions)
              </button>
            )}
          </div>
        </div>
      )}

      {session.surveys.length === 0 && !showWizard && (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm">Aucune enquête créée</p>
          <p className="text-xs mt-1">Créez votre première enquête de matérialité</p>
        </div>
      )}

      {session.surveys.map(survey => (
        <div key={survey.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900 dark:text-white">{survey.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[survey.status]}`}>
                  {statusLabels[survey.status]}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {survey.materiality_type === 'double' ? '2M' : '1M'} · {survey.questions.length} Q · {survey.responses.length} rép.
                </span>
              </div>
              {survey.description && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{survey.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setActiveSurveyId(activeSurveyId === survey.id ? null : survey.id)}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {activeSurveyId === survey.id ? 'Fermer' : 'Détails'}
              </button>
              <button onClick={() => handleDeleteSurvey(survey.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Supprimer">🗑️</button>
            </div>
          </div>

          {activeSurveyId === survey.id && (
            <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
              {/* Statut */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Statut :</span>
                {(['brouillon', 'en_cours', 'terminé'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(survey.id, st)}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      survey.status === st ? statusColors[st] : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {statusLabels[st]}
                  </button>
                ))}
              </div>

              {/* Lien de partage */}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Lien de partage</p>
                {survey.share_token ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-300 truncate">
                      https://app.sensetho.fr/enquete/{survey.share_token}
                    </code>
                    <button
                      onClick={() => copyShareUrl(survey.share_token!)}
                      className="px-2.5 py-1.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex-shrink-0"
                    >
                      {copiedToken === survey.share_token ? 'Copié ✓' : 'Copier'}
                    </button>
                    <button
                      onClick={() => handleRevokeShare(survey.id)}
                      disabled={shareLoading === survey.id}
                      className="px-2.5 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex-shrink-0"
                    >
                      Révoquer
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateShare(survey.id)}
                    disabled={shareLoading === survey.id}
                    className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {shareLoading === survey.id ? 'Génération...' : 'Générer un lien de partage'}
                  </button>
                )}
                {survey.token_expires_at && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Expire le {new Date(survey.token_expires_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>

              {/* Invitations email */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Invitations email</p>
                  <button
                    onClick={() => { setShowInviteFor(showInviteFor === survey.id ? null : survey.id); setInviteResult(null) }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {showInviteFor === survey.id ? 'Fermer' : 'Inviter'}
                  </button>
                </div>
                {showInviteFor === survey.id && (
                  <div className="space-y-2">
                    <textarea
                      value={inviteEmails}
                      onChange={e => setInviteEmails(e.target.value)}
                      placeholder="Entrez les emails (un par ligne, ou séparés par virgule)"
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                    />
                    <button
                      onClick={() => handleSendInvites(survey.id)}
                      disabled={inviteSending || !inviteEmails.trim()}
                      className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      {inviteSending ? 'Envoi...' : 'Enregistrer les invitations'}
                    </button>
                    {inviteResult && (
                      <div className="text-xs space-y-1">
                        {inviteResult.sent.length > 0 && <p className="text-emerald-600 dark:text-emerald-400">✓ {inviteResult.sent.length} invitation{inviteResult.sent.length !== 1 ? 's' : ''} enregistrée{inviteResult.sent.length !== 1 ? 's' : ''}</p>}
                        {inviteResult.failed.length > 0 && <p className="text-red-600 dark:text-red-400">✗ {inviteResult.failed.length} échec{inviteResult.failed.length !== 1 ? 's' : ''}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Saisie des réponses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Réponses ({survey.responses.length})
                  </p>
                  <button
                    onClick={() => {
                      setShowResponseFor(showResponseFor === survey.id ? null : survey.id)
                      setResponseForm({ stakeholderId: '', answers: {} })
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {showResponseFor === survey.id ? 'Fermer' : '+ Saisir une réponse'}
                  </button>
                </div>

                {showResponseFor === survey.id && (
                  <div className="space-y-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Partie prenante</label>
                      <select
                        value={responseForm.stakeholderId}
                        onChange={e => setResponseForm(f => ({ ...f, stakeholderId: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                      >
                        <option value="">Sélectionner...</option>
                        {session.stakeholders.map(s => (
                          <option key={s.id} value={s.id}>{s.name}{s.organisation ? ` — ${s.organisation}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {survey.questions.map(q => (
                        <div key={q.id} className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{q.text}</p>
                          </div>
                          <select
                            value={responseForm.answers[q.id] ?? ''}
                            onChange={e => setResponseForm(f => ({
                              ...f,
                              answers: { ...f.answers, [q.id]: Number(e.target.value) }
                            }))}
                            className="w-20 flex-shrink-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-1.5 py-1 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                          >
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAddResponse(survey.id)}
                      disabled={!responseForm.stakeholderId}
                      className="w-full px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      Enregistrer les réponses
                    </button>
                  </div>
                )}

                {survey.responses.length > 0 && (
                  <div className="space-y-1">
                    {survey.responses.map(r => (
                      <div key={r.stakeholder_id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{r.stakeholder_name}</span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span>{Object.keys(r.answers).length} réponse{Object.keys(r.answers).length !== 1 ? 's' : ''}</span>
                        <span className="ml-auto text-gray-300 dark:text-gray-600">{new Date(r.completed_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Résultats de matérialité */}
              {session.materiality_scores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Scores de matérialité calculés</p>
                  <div className="space-y-1.5">
                    {session.materiality_scores.slice(0, 5).map(score => (
                      <div key={score.esrs} className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-8 flex-shrink-0">{score.esrs}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${score.is_material ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            style={{ width: `${score.combined_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right flex-shrink-0">
                          {score.combined_score.toFixed(0)}%
                        </span>
                        {score.is_material && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0 font-medium">Matériel</span>
                        )}
                      </div>
                    ))}
                    {session.materiality_scores.length > 5 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">+{session.materiality_scores.length - 5} autres thèmes</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────────

const TABS = [
  { label: '👥 Parties prenantes', key: 'pp' },
  { label: '📋 Enquêtes', key: 'surveys' },
  { label: '📚 Bibliothèque', key: 'library' },
  { label: '📊 Matrice', key: 'matrix' },
  { label: '📝 Notes', key: 'notes' },
] as const

type TabKey = typeof TABS[number]['key']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PartiesPrenantesApp({ ctx }: { ctx: RseContext }) {
  const [sessions, setSessions] = useState<(SessionListItem & { materiality_scores?: MaterialityScore[] })[]>([])
  const [activeSession, setActiveSession] = useState<PPSession | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('pp')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/parties-prenantes/sessions')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setSessions(json.data ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
    // Afficher le tutoriel si pas encore vu
    if (!localStorage.getItem('pp_tutorial_seen')) {
      setShowTutorial(true)
    }
  }, [loadSessions])

  const handleSelectSession = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/parties-prenantes/sessions/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setActiveSession(json.data)
      setActiveTab('pp')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSessionUpdate = useCallback(async (patch: Partial<PPSession>) => {
    if (!activeSession) return
    setSaving(true)
    // Optimistic update
    const updated = { ...activeSession, ...patch }
    setActiveSession(updated)
    try {
      await fetch(`/api/parties-prenantes/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [activeSession])

  const handleCreated = useCallback((session: PPSession) => {
    setShowNewModal(false)
    setActiveSession(session)
    setActiveTab('pp')
    setSessions(prev => [session as unknown as SessionListItem & { materiality_scores?: MaterialityScore[] }, ...prev])
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!confirm('Supprimer cette session ? Cette action est irréversible.')) return
    try {
      await fetch(`/api/parties-prenantes/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeSession?.id === id) setActiveSession(null)
    } catch (err) {
      console.error(err)
    }
  }, [activeSession])

  // ── Vue liste des sessions ──────────────────────────────────────────────────

  if (!activeSession) {
    const hasSessions = sessions.length > 0
    const sessionsWithScores = sessions.filter(s => (s as PPSession).materiality_scores?.length > 0)

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
        {showNewModal && (
          <NewSessionModal
            onClose={() => setShowNewModal(false)}
            onCreated={handleCreated}
            initialOrganisation={ctx.org?.denomination ?? ''}
            initialSecteur={ctx.org?.libelle_activite ?? ''}
          />
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parties Prenantes & Matérialité</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cartographie, enquêtes ESRS et matrice de double matérialité CSRD
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTutorial(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ? Guide d&apos;utilisation
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              + Nouvelle session
            </button>
          </div>
        </div>

        {/* Radar ESG si données disponibles */}
        {sessionsWithScores.length > 0 && (
          <ESGRadar sessions={sessions} />
        )}

        {loading && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Chargement...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !hasSessions && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <p className="text-5xl mb-4">👥</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Commencez votre engagement parties prenantes</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Créez votre première session pour cartographier vos parties prenantes et évaluer la matérialité de vos enjeux ESG.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
            >
              Créer ma première session
            </button>
          </div>
        )}

        {!loading && hasSessions && (
          <div className="space-y-3">
            {sessions.map(session => {
              const modeLabel: Record<string, string> = { csrd: 'CSRD', voluntaire: 'Volontaire', both: 'CSRD + Vol.' }
              const mtLabel: Record<string, string> = { double: '2 Matérialités', simple: '1 Matérialité' }
              const statusBadge = session.status === 'archivé'
                ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              return (
                <div
                  key={session.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                  onClick={() => handleSelectSession(session.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{session.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge}`}>
                          {session.status === 'archivé' ? 'Archivé' : 'Actif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {session.organisation && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{session.organisation}</span>
                        )}
                        {session.organisation && session.secteur && (
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                        )}
                        {session.secteur && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{session.secteur}</span>
                        )}
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {modeLabel[session.mode] ?? session.mode}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {mtLabel[session.materiality_type] ?? session.materiality_type}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Exercice {session.exercice}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Mis à jour le {new Date(session.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSession(session.id) }}
                      className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Vue session ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {/* Header session */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => { setActiveSession(null); loadSessions() }}
          className="mt-1 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
          title="Retour à la liste"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{activeSession.name}</h1>
            {saving && <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Sauvegarde...</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {activeSession.organisation && <span className="text-sm text-gray-500 dark:text-gray-400">{activeSession.organisation}</span>}
            {activeSession.organisation && activeSession.secteur && <span className="text-gray-300 dark:text-gray-600">·</span>}
            {activeSession.secteur && <span className="text-sm text-gray-500 dark:text-gray-400">{activeSession.secteur}</span>}
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Exercice {activeSession.exercice}</span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      {activeTab === 'pp' && (
        <TabStakeholders session={activeSession} onUpdate={handleSessionUpdate} />
      )}
      {activeTab === 'surveys' && (
        <TabSurveys session={activeSession} onUpdate={handleSessionUpdate} />
      )}
      {activeTab === 'library' && (
        <TabLibrary />
      )}
      {activeTab === 'matrix' && (
        <TabMatrix session={activeSession} />
      )}
      {activeTab === 'notes' && (
        <TabNotes session={activeSession} />
      )}
    </div>
  )
}
