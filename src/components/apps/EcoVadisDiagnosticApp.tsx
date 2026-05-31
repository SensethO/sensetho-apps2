'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'

// ─── Données statiques EcoVadis ───────────────────────────────────────────────

export const ECOVADIS_THEMES = [
  {
    id: 'env',
    label: 'Environnement',
    icon: '🌿',
    poids: 0.40,
    colorCls: 'emerald',
    criteres: [
      { id: 'env-politique',  label: 'Politique environnementale',         description: 'Existence d\'une politique formalisée, engagement de la direction, objectifs chiffrés.' },
      { id: 'env-energie',    label: 'Énergie & GES',                      description: 'Mesure des consommations énergétiques et émissions de GES (scope 1, 2, 3), réduction.' },
      { id: 'env-eau',        label: 'Gestion de l\'eau',                  description: 'Mesure et réduction des consommations d\'eau, gestion des eaux usées.' },
      { id: 'env-dechets',    label: 'Déchets & Matières',                 description: 'Gestion des déchets, économie circulaire, réduction à la source.' },
      { id: 'env-pollution',  label: 'Pollution & Contamination',          description: 'Prévention des pollutions (air, sol, eau), gestion des substances dangereuses.' },
      { id: 'env-reporting',  label: 'Reporting Environnemental',          description: 'Publication de données environnementales vérifiées, certification (ISO 14001, etc.).' },
    ],
  },
  {
    id: 'social',
    label: 'Social & Droits Humains',
    icon: '👥',
    poids: 0.40,
    colorCls: 'blue',
    criteres: [
      { id: 'soc-politique',  label: 'Politique RH & Engagement',         description: 'Politique formalisée, charte éthique, conventions collectives.' },
      { id: 'soc-sante',      label: 'Santé & Sécurité',                  description: 'Système de management SST, taux accidents, actions de prévention.' },
      { id: 'soc-conditions', label: 'Conditions de travail',              description: 'Temps de travail, rémunération, qualité de vie au travail.' },
      { id: 'soc-formation',  label: 'Formation & Développement',         description: 'Heures de formation, plans de développement, égalité des chances.' },
      { id: 'soc-droits',     label: 'Droits Humains Fondamentaux',       description: 'Respect des droits fondamentaux, lutte contre le travail forcé et enfants.' },
      { id: 'soc-reporting',  label: 'Reporting Social',                   description: 'Publication d\'indicateurs sociaux vérifiés, certification (SA8000, etc.).' },
    ],
  },
  {
    id: 'ethique',
    label: 'Éthique des Affaires',
    icon: '⚖️',
    poids: 0.10,
    colorCls: 'purple',
    criteres: [
      { id: 'eth-corruption',   label: 'Anti-corruption & Pots-de-vin',   description: 'Programme anti-corruption, code de conduite, formation des employés.' },
      { id: 'eth-concurrence',  label: 'Pratiques anticoncurrentielles',  description: 'Politique de respect du droit de la concurrence, formation.' },
      { id: 'eth-ip',           label: 'Propriété Intellectuelle',        description: 'Protection des droits de PI, procédures internes.' },
      { id: 'eth-donnees',      label: 'Protection des Données',          description: 'Conformité RGPD, politique de confidentialité, sécurité des données.' },
      { id: 'eth-reporting',    label: 'Reporting Éthique',               description: 'Mécanismes d\'alerte (whistleblowing), publication du code éthique.' },
    ],
  },
  {
    id: 'achats',
    label: 'Achats Responsables',
    icon: '🤝',
    poids: 0.10,
    colorCls: 'amber',
    criteres: [
      { id: 'ach-politique',  label: 'Politique Achats Responsables',     description: 'Politique formalisée intégrant critères RSE fournisseurs, code de conduite.' },
      { id: 'ach-actions',    label: 'Actions & Évaluation Fournisseurs', description: 'Évaluation RSE des fournisseurs, audits, plans de progrès.' },
      { id: 'ach-reporting',  label: 'Reporting Achats',                  description: 'Publication d\'indicateurs achats responsables, % fournisseurs évalués.' },
    ],
  },
] as const

export const NIVEAUX = [
  { value: 0, label: 'NC',         shortLabel: 'NC',  description: 'Non communiqué ou absent',              color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-600 dark:text-gray-400', pct: 0    },
  { value: 1, label: 'Basique',    shortLabel: '1',   description: 'Éléments de base en place',             color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',   text: 'text-red-600 dark:text-red-400',   pct: 0.25 },
  { value: 2, label: 'Avancé',     shortLabel: '2',   description: 'Système formalisé et déployé',          color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', pct: 0.50 },
  { value: 3, label: 'Pro-actif',  shortLabel: '3',   description: 'Démarche proactive, mesurée & améliorée', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', pct: 0.75 },
  { value: 4, label: 'Leader',     shortLabel: '4',   description: 'Excellence, certifié ou primé',         color: '#16a34a', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', pct: 1.00 },
] as const

const BADGE_LEVELS = [
  { label: 'Platinum', min: 75, color: '#6366f1', icon: '💎' },
  { label: 'Gold',     min: 65, color: '#f59e0b', icon: '🥇' },
  { label: 'Silver',   min: 45, color: '#9ca3af', icon: '🥈' },
  { label: 'Bronze',   min: 25, color: '#cd7f32', icon: '🥉' },
  { label: 'Non noté', min: 0,  color: '#e5e7eb', icon: '—'  },
]

export function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const theme of ECOVADIS_THEMES) {
    let themeScore = 0
    const nbCriteres = theme.criteres.length
    for (const c of theme.criteres) {
      const n = niveaux[c.id] ?? 0
      const pct = NIVEAUX[n]?.pct ?? 0
      themeScore += pct / nbCriteres
    }
    total += themeScore * theme.poids
  }
  return Math.round(total * 100)
}

function getBadge(score: number) {
  return BADGE_LEVELS.find(b => score >= b.min) ?? BADGE_LEVELS[BADGE_LEVELS.length - 1]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'presentation' | 'diagnostic' | 'actions' | 'documents'

interface DiagnosticData { id: string; annee: number; statut: string; score_global: number | null }
interface Reponse { id?: string; critere_id: string; niveau: number; commentaire: string | null }
interface Action {
  id: string; critere_id: string; titre: string; description: string | null
  priorite: 'haute' | 'moyenne' | 'basse'; statut: 'a_faire' | 'en_cours' | 'termine'
  echeance: string | null; responsable: string | null; created_at: string
}
interface EcoDoc {
  id: string; critere_id: string | null; nom: string; description: string | null
  type_doc: string | null; sp_item_id: string; size: number | null
  annexe_index: number | null; url?: string
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const THEME_COLORS: Record<string, { ring: string; text: string; bg: string; bar: string }> = {
  env:     { ring: 'ring-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500' },
  social:  { ring: 'ring-blue-400',    text: 'text-blue-700 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       bar: 'bg-blue-500'    },
  ethique: { ring: 'ring-purple-400',  text: 'text-purple-700 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20',   bar: 'bg-purple-500'  },
  achats:  { ring: 'ring-amber-400',   text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     bar: 'bg-amber-500'   },
}

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1048576).toFixed(1)} Mo`
}

function critereLabel(id: string): string {
  for (const t of ECOVADIS_THEMES) {
    const c = t.criteres.find(x => x.id === id)
    if (c) return `${t.icon} ${c.label}`
  }
  return id
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className={card('p-6 space-y-3')}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🏆</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">EcoVadis — Diagnostic RSE</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Référence mondiale d&apos;évaluation des pratiques RSE des entreprises</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          EcoVadis évalue chaque année des milliers d&apos;entreprises sur leurs pratiques de responsabilité sociale et environnementale.
          Un questionnaire détaillé couvre <strong>4 thèmes</strong>, vous obtenez un score de 0 à 100 et un badge (Bronze, Silver, Gold, Platinum).
          Cette application vous aide à préparer votre évaluation, identifier vos points faibles, construire un plan d&apos;actions et centraliser vos preuves documentaires.
        </p>
      </div>

      {/* Thèmes et poids */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 4 thèmes d&apos;évaluation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ECOVADIS_THEMES.map(t => {
            const clr = THEME_COLORS[t.id]
            return (
              <div key={t.id} className={card('p-4')}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className={`font-semibold text-sm ${clr.text}`}>{t.label}</div>
                    <div className="text-xs text-gray-400">Poids : {Math.round(t.poids * 100)}%</div>
                  </div>
                  <div className={`ml-auto text-lg font-bold ${clr.text}`}>{Math.round(t.poids * 100)}%</div>
                </div>
                <div className="space-y-1">
                  {t.criteres.map(c => (
                    <div key={c.id} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <span className="mt-0.5 text-gray-400">•</span>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Niveaux de maturité */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
            <div key={n.value} className={card('p-3 text-center')}>
              <div className="text-2xl font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{n.label}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{n.description}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: n.color }}>{Math.round(n.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badges EcoVadis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.filter(b => b.label !== 'Non noté').map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min} / 100</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic', 'Pour chaque critère, évaluez votre niveau de maturité (0 à 4), ajoutez un commentaire explicatif et créez des actions d\'amélioration.'],
            ['2', 'Plan d\'actions', 'Visualisez et gérez toutes vos actions d\'amélioration : priorité, responsable, échéance, statut d\'avancement.'],
            ['3', 'Documents & Preuves', 'Uploadez directement dans SharePoint vos preuves documentaires (politiques, rapports, certificats) classées par critère.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">{num}</div>
              <div><span className="font-medium">{title}</span> — {desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Panneau critère (Diagnostic) ─────────────────────────────────────────────

interface CriterePanelProps {
  theme: typeof ECOVADIS_THEMES[number]
  critere: typeof ECOVADIS_THEMES[number]['criteres'][number]
  reponse: Reponse | null
  actions: Action[]
  documents: EcoDoc[]
  diagnosticId: string
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (actions: Action[]) => void
  onDocumentsChange: (docs: EcoDoc[]) => void
}

function CriterePanel({
  theme, critere, reponse, actions, documents,
  diagnosticId, onReponseChange, onActionsChange, onDocumentsChange,
}: CriterePanelProps) {
  const [niveau, setNiveau] = useState(reponse?.niveau ?? 0)
  const [commentaire, setCommentaire] = useState(reponse?.commentaire ?? '')
  const [savingReponse, setSavingReponse] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Action form
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
  const [savingAction, setSavingAction] = useState(false)

  // Upload doc
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [typeDoc, setTypeDoc] = useState('politique')

  const clr = THEME_COLORS[theme.id]
  const critereActions = actions.filter(a => a.critere_id === critere.id)
  const critereDocs = documents.filter(d => d.critere_id === critere.id)

  // Sync niveau/commentaire si la réponse change de l'extérieur
  useEffect(() => {
    setNiveau(reponse?.niveau ?? 0)
    setCommentaire(reponse?.commentaire ?? '')
  }, [reponse])

  function handleNiveauChange(n: number) {
    setNiveau(n)
    scheduleSave(n, commentaire)
  }

  function handleCommentaireChange(c: string) {
    setCommentaire(c)
    scheduleSave(niveau, c)
  }

  function scheduleSave(n: number, c: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingReponse(true)
      onReponseChange(critere.id, n, c)
      setSavingReponse(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    }, 800)
  }

  async function addAction() {
    if (!actionForm.titre.trim()) return
    setSavingAction(true)
    const res = await fetch(`/api/ecovadis/${diagnosticId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id: critere.id, ...actionForm }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange([...actions, data])
      setActionForm({ titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
      setShowActionForm(false)
    }
    setSavingAction(false)
  }

  async function deleteAction(id: string) {
    if (!confirm('Supprimer cette action ?')) return
    await fetch(`/api/ecovadis/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function toggleActionStatut(action: Action) {
    const next = action.statut === 'a_faire' ? 'en_cours' : action.statut === 'en_cours' ? 'termine' : 'a_faire'
    const res = await fetch(`/api/ecovadis/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadProgress('Préparation upload…')
    try {
      // 1. Upload session
      const sessionRes = await fetch(`/api/ecovadis/${diagnosticId}/upload-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size, critere_id: critere.id }),
      })
      if (!sessionRes.ok) throw new Error('Échec session upload')
      const { uploadUrl, attachmentId, finalName, annexeIndex } = await sessionRes.json()

      // 2. Upload direct navigateur → SharePoint (aucun transit Vercel)
      setUploadProgress('Upload vers SharePoint…')
      const CHUNK_SIZE = 10 * 1024 * 1024 // 10 MB
      let spItemId = ''

      if (file.size <= CHUNK_SIZE) {
        const upRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Range': `bytes 0-${file.size - 1}/${file.size}`,
          },
          body: file,
        })
        if (!upRes.ok) throw new Error('Échec upload SharePoint')
        const upJson = await upRes.json() as { id?: string }
        spItemId = upJson.id ?? ''
      } else {
        let offset = 0
        while (offset < file.size) {
          const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
          const end = Math.min(offset + CHUNK_SIZE, file.size) - 1
          setUploadProgress(`Upload ${Math.round((offset / file.size) * 100)}%…`)
          const upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(chunk.size),
              'Content-Range': `bytes ${offset}-${end}/${file.size}`,
            },
            body: chunk,
          })
          if (!upRes.ok && upRes.status !== 202) throw new Error('Échec chunk upload')
          if (upRes.status !== 202) {
            const upJson = await upRes.json() as { id?: string }
            spItemId = upJson.id ?? ''
          }
          offset += CHUNK_SIZE
        }
      }

      // 3. Confirm — stocke les métadonnées
      setUploadProgress('Finalisation…')
      const confirmRes = await fetch(`/api/ecovadis/${diagnosticId}/upload-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          critere_id: critere.id, attachmentId, spItemId,
          name: finalName, mime: file.type, size: file.size,
          type_doc: typeDoc, annexeIndex,
        }),
      })
      if (confirmRes.ok) {
        const { data } = await confirmRes.json()
        onDocumentsChange([...documents, data])
      }
    } catch (e) {
      console.error('[ecovadis/upload]', e)
      alert('Échec de l\'upload : ' + String(e))
    } finally {
      setUploading(false)
      setUploadProgress('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deleteDoc(doc: EcoDoc) {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return
    const res = await fetch(`/api/ecovadis/${diagnosticId}/documents?doc_id=${doc.id}`, { method: 'DELETE' })
    if (res.ok) onDocumentsChange(documents.filter(d => d.id !== doc.id))
  }

  const niv = NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      {/* Header critère */}
      <div className={`${clr.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700`}>
        <h3 className={`font-bold text-base ${clr.text}`}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      {/* Sélecteur de niveau */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
            <button
              key={n.value}
              onClick={() => handleNiveauChange(n.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${
                niveau === n.value
                  ? `border-[${n.color}] ${n.bg} ring-2 ring-offset-1`
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              style={{ borderColor: niveau === n.value ? n.color : undefined, ringColor: n.color }}
            >
              <div className="text-lg font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mt-0.5">{n.label}</div>
            </button>
          ))}
        </div>
        {niv && (
          <div className={`text-xs px-3 py-1.5 rounded-lg ${niv.bg} ${niv.text} font-medium`}>
            {niv.description} ({Math.round(niv.pct * 100)}%)
          </div>
        )}
      </div>

      {/* Commentaire */}
      <div className={card('p-4 space-y-2')}>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & contexte</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves existantes et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Nous disposons d'une politique environnementale formalisée depuis 2022, validée par la direction. Le bilan carbone scope 1&2 est réalisé annuellement. Points à améliorer : scope 3 non mesuré…"
          className={`${inputCls()} resize-y`}
        />
      </div>

      {/* Actions d&apos;amélioration */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🎯 Actions d&apos;amélioration
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div>
              <label className={labelCls()}>Titre de l&apos;action *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Réaliser le bilan carbone scope 3" />
            </div>
            <div>
              <label className={labelCls()}>Description</label>
              <textarea className={`${inputCls()} resize-none`} rows={2} value={actionForm.description} onChange={e => setActionForm(f => ({ ...f, description: e.target.value }))} placeholder="Détails, objectifs…" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls()}>Priorité</label>
                <select className={inputCls()} value={actionForm.priorite} onChange={e => setActionForm(f => ({ ...f, priorite: e.target.value }))}>
                  <option value="haute">🔴 Haute</option>
                  <option value="moyenne">🟡 Moyenne</option>
                  <option value="basse">🟢 Basse</option>
                </select>
              </div>
              <div>
                <label className={labelCls()}>Échéance</label>
                <input type="date" className={inputCls()} value={actionForm.echeance} onChange={e => setActionForm(f => ({ ...f, echeance: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls()}>Responsable</label>
                <input className={inputCls()} value={actionForm.responsable} onChange={e => setActionForm(f => ({ ...f, responsable: e.target.value }))} placeholder="Prénom Nom" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className={btnS()} onClick={() => setShowActionForm(false)}>Annuler</button>
              <button className={btnP()} onClick={addAction} disabled={savingAction || !actionForm.titre.trim()}>
                {savingAction ? '…' : '✓ Créer'}
              </button>
            </div>
          </div>
        )}

        {critereActions.length === 0 && !showActionForm && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des points d&apos;amélioration concrets</p>
        )}

        <div className="space-y-2">
          {critereActions.map(a => (
            <div key={a.id} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-700">
              <button onClick={() => toggleActionStatut(a)} title="Changer statut"
                className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[a.statut]}`}>
                {STATUT_LABELS[a.statut]}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                {a.description && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{a.description}</div>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] px-1 py-0.5 rounded ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                  {a.echeance && <span className="text-[9px] text-gray-400">📅 {a.echeance}</span>}
                  {a.responsable && <span className="text-[9px] text-gray-400">👤 {a.responsable}</span>}
                </div>
              </div>
              <button onClick={() => deleteAction(a.id)} className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Documents & Preuves */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            📂 Documents & Preuves
            {critereDocs.length > 0 && (
              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">{critereDocs.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={typeDoc} onChange={e => setTypeDoc(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="politique">Politique</option>
              <option value="rapport">Rapport</option>
              <option value="certificat">Certificat</option>
              <option value="procedure">Procédure</option>
              <option value="autre">Autre</option>
            </select>
            <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnP('text-xs py-1.5')}>
              {uploading ? <span className="animate-spin">⟳</span> : '+ Preuve'}
            </button>
          </div>
        </div>

        {uploading && uploadProgress && (
          <div className="text-xs text-blue-600 dark:text-blue-400 animate-pulse px-2">{uploadProgress}</div>
        )}
        <p className="text-[10px] text-gray-400">Fichiers stockés directement dans SharePoint — aucun transit par les serveurs</p>

        {critereDocs.length === 0 && !uploading && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune preuve uploadée pour ce critère</p>
        )}

        <div className="space-y-1.5">
          {critereDocs.map(d => (
            <div key={d.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-700">
              <span className="text-sm flex-shrink-0">📄</span>
              <div className="flex-1 min-w-0">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">{d.nom}</a>
                ) : (
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">{d.nom}</span>
                )}
                <div className="text-[9px] text-gray-400 flex items-center gap-2">
                  {d.type_doc && <span className="capitalize">{d.type_doc}</span>}
                  {d.size && <span>{formatSize(d.size)}</span>}
                </div>
              </div>
              <button onClick={() => deleteDoc(d)} className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Diagnostic ───────────────────────────────────────────────────────────

interface DiagViewProps {
  diagnostic: DiagnosticData
  reponses: Record<string, Reponse>
  actions: Action[]
  documents: EcoDoc[]
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (a: Action[]) => void
  onDocumentsChange: (d: EcoDoc[]) => void
}

function DiagnosticView({ diagnostic, reponses, actions, documents, onReponseChange, onActionsChange, onDocumentsChange }: DiagViewProps) {
  const [activeTheme, setActiveTheme] = useState(ECOVADIS_THEMES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ECOVADIS_THEMES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateScore(niveaux)
  const badge = getBadge(scoreGlobal)

  return (
    <div className="space-y-4">
      {/* Score simulé */}
      <div className={card('p-4')}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score simulé</div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-gray-900 dark:text-white">{scoreGlobal}</div>
              <div className="text-sm text-gray-400">/ 100</div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
                {badge.icon} {badge.label}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${scoreGlobal}%`, background: badge.color }} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ECOVADIS_THEMES.map(t => {
              const clr = THEME_COLORS[t.id]
              const themeNiveaux = t.criteres.map(c => niveaux[c.id] ?? 0)
              const themePct = Math.round(themeNiveaux.reduce((s, n) => s + NIVEAUX[n].pct, 0) / t.criteres.length * 100)
              const renseignes = t.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={t.id} className={`text-center p-2 rounded-lg ${clr.bg}`}>
                  <div className="text-base">{t.icon}</div>
                  <div className={`text-sm font-bold ${clr.text}`}>{themePct}%</div>
                  <div className="text-[9px] text-gray-400">{renseignes}/{t.criteres.length}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar thèmes/critères */}
        <div className={card('overflow-hidden')}>
          <div className="space-y-1 p-2">
            {ECOVADIS_THEMES.map(theme => {
              const clr = THEME_COLORS[theme.id]
              const isOpen = activeTheme === theme.id
              const renseignes = theme.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={theme.id}>
                  <button
                    onClick={() => { setActiveTheme(theme.id); if (!isOpen) setActiveCritere(theme.criteres[0].id) }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${isOpen ? `${clr.bg} ${clr.text}` : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'}`}
                  >
                    <span className="text-base">{theme.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{theme.label}</div>
                      <div className="text-[10px] text-gray-400">{renseignes}/{theme.criteres.length} critères · {Math.round(theme.poids * 100)}%</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {theme.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = NIVEAUX[n]
                        const isActive = activeCritere === c.id
                        return (
                          <button
                            key={c.id}
                            onClick={() => setActiveCritere(c.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-900 dark:bg-white/10 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`}
                          >
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                              style={{ background: niv.color + '33', color: niv.color }}>
                              {niv.shortLabel}
                            </div>
                            <span className="text-[10px] font-medium truncate flex-1">{c.label}</span>
                            {actions.filter(a => a.critere_id === c.id).length > 0 && (
                              <span className="text-[9px] text-gray-400 flex-shrink-0">
                                {actions.filter(a => a.critere_id === c.id).length}🎯
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panneau critère actif */}
        <div className="min-w-0">
          {activeCritere ? (() => {
            const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === activeCritere))!
            const critere = theme.criteres.find(c => c.id === activeCritere)!
            return (
              <CriterePanel
                key={activeCritere}
                theme={theme}
                critere={critere}
                reponse={reponses[activeCritere] ?? null}
                actions={actions}
                documents={documents}
                diagnosticId={diagnostic.id}
                onReponseChange={onReponseChange}
                onActionsChange={onActionsChange}
                onDocumentsChange={onDocumentsChange}
              />
            )
          })() : (
            <div className={card('p-8 text-center')}>
              <p className="text-gray-400 text-sm">Sélectionnez un critère pour commencer l&apos;évaluation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Plan d'actions ───────────────────────────────────────────────────────

function ActionsView({ diagnostic, actions, onActionsChange }: { diagnostic: DiagnosticData; actions: Action[]; onActionsChange: (a: Action[]) => void }) {
  const [filterTheme, setFilterTheme] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)

  const filtered = actions.filter(a => {
    const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === a.critere_id))
    if (filterTheme !== 'all' && theme?.id !== filterTheme) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/ecovadis/${diagnostic.id}/actions?action_id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === id ? data : a))
      setEditId(null)
    }
    setSaving(false)
  }

  async function deleteAction(id: string) {
    if (!confirm('Supprimer ?')) return
    await fetch(`/api/ecovadis/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total actions', value: total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'En cours', value: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', value: `${termines} (${total ? Math.round(termines / total * 100) : 0}%)`, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={card('p-4 text-center')}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous les thèmes</option>
          {ECOVADIS_THEMES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Toutes priorités</option>
          <option value="haute">🔴 Haute</option>
          <option value="moyenne">🟡 Moyenne</option>
          <option value="basse">🟢 Basse</option>
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous statuts</option>
          <option value="a_faire">À faire</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
        </select>
        <div className="text-xs text-gray-400 flex items-center">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Liste */}
      {filtered.length === 0 && (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Diagnostic, critère par critère</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map(a => {
          const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === a.critere_id))
          const isEditing = editId === a.id
          return (
            <div key={a.id} className={card('p-4')}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 text-base">{theme?.icon}</div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input className={inputCls()} value={editData.titre ?? a.titre} onChange={e => setEditData(d => ({ ...d, titre: e.target.value }))} />
                      <textarea className={`${inputCls()} resize-none`} rows={2} value={editData.description ?? a.description ?? ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                      <div className="grid grid-cols-3 gap-2">
                        <select className={inputCls()} value={editData.priorite ?? a.priorite} onChange={e => setEditData(d => ({ ...d, priorite: e.target.value as Action['priorite'] }))}>
                          <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                        </select>
                        <select className={inputCls()} value={editData.statut ?? a.statut} onChange={e => setEditData(d => ({ ...d, statut: e.target.value as Action['statut'] }))}>
                          <option value="a_faire">À faire</option><option value="en_cours">En cours</option><option value="termine">Terminé</option>
                        </select>
                        <input type="date" className={inputCls()} value={editData.echeance ?? a.echeance ?? ''} onChange={e => setEditData(d => ({ ...d, echeance: e.target.value }))} />
                      </div>
                      <input className={inputCls()} placeholder="Responsable" value={editData.responsable ?? a.responsable ?? ''} onChange={e => setEditData(d => ({ ...d, responsable: e.target.value }))} />
                      <div className="flex gap-2">
                        <button className={btnS()} onClick={() => setEditId(null)}>Annuler</button>
                        <button className={btnP()} onClick={() => saveEdit(a.id)} disabled={saving}>{saving ? '…' : '✓ Sauvegarder'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`text-sm font-semibold ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                      {a.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.description}</div>}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUT_COLORS[a.statut]}`}>{STATUT_LABELS[a.statut]}</span>
                        <span className="text-[10px] text-gray-400">{critereLabel(a.critere_id)}</span>
                        {a.echeance && <span className="text-[10px] text-gray-400">📅 {a.echeance}</span>}
                        {a.responsable && <span className="text-[10px] text-gray-400">👤 {a.responsable}</span>}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditId(a.id); setEditData({}) }} className="text-xs text-gray-400 hover:text-blue-500 px-1">✏️</button>
                    <button onClick={() => deleteAction(a.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vue Documents ────────────────────────────────────────────────────────────

function DocumentsView({ diagnostic, documents, onDocumentsChange }: { diagnostic: DiagnosticData; documents: EcoDoc[]; onDocumentsChange: (d: EcoDoc[]) => void }) {
  const [docsWithUrls, setDocsWithUrls] = useState<EcoDoc[]>(documents)
  const [loading, setLoading] = useState(false)
  const [filterTheme, setFilterTheme] = useState('all')

  useEffect(() => {
    if (!diagnostic.id) return
    setLoading(true)
    fetch(`/api/ecovadis/${diagnostic.id}/documents`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setDocsWithUrls(data); onDocumentsChange(data ?? []) })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic.id])

  const filtered = docsWithUrls.filter(d => {
    if (filterTheme === 'all') return true
    const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === d.critere_id))
    return theme?.id === filterTheme
  })

  async function deleteDoc(doc: EcoDoc) {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return
    const res = await fetch(`/api/ecovadis/${diagnostic.id}/documents?doc_id=${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      const upd = docsWithUrls.filter(d => d.id !== doc.id)
      setDocsWithUrls(upd)
      onDocumentsChange(upd)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {docsWithUrls.length} document{docsWithUrls.length !== 1 ? 's' : ''} stockés dans SharePoint
        </div>
        <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous les thèmes</option>
          {ECOVADIS_THEMES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
      </div>

      {loading && <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement des URLs SharePoint…</div>}

      {!loading && filtered.length === 0 && (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400 text-sm">Aucun document — uploadez vos preuves depuis chaque critère dans la vue Diagnostic</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(d => {
          const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === d.critere_id))
          const critere = theme?.criteres.find(c => c.id === d.critere_id)
          return (
            <div key={d.id} className={card('p-4 flex items-center gap-3')}>
              <div className="text-2xl flex-shrink-0">📄</div>
              <div className="flex-1 min-w-0">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">{d.nom}</a>
                ) : (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate block">{d.nom}</span>
                )}
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {theme && <span>{theme.icon} {critere?.label ?? d.critere_id}</span>}
                  {d.type_doc && <span className="capitalize">· {d.type_doc}</span>}
                  {d.size && <span>· {formatSize(d.size)}</span>}
                  {d.annexe_index && <span>· A{String(d.annexe_index).padStart(3, '0')}</span>}
                </div>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-blue-500 flex-shrink-0 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors">
                  ⬇ Télécharger
                </a>
              )}
              <button onClick={() => deleteDoc(d)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'presentation', label: 'Présentation',     icon: '📋' },
  { id: 'diagnostic',   label: 'Diagnostic',        icon: '🎯' },
  { id: 'actions',      label: 'Plan d\'actions',   icon: '📝' },
  { id: 'documents',    label: 'Documents & Preuves', icon: '📂' },
]

export default function EcoVadisDiagnosticApp({ ctx }: { ctx: RseContext }) {
  const { org, year } = ctx
  const [view, setView] = useState<View>('presentation')
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [actions, setActions] = useState<Action[]>([])
  const [documents, setDocuments] = useState<EcoDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      // Chercher ou créer le diagnostic
      const res = await fetch(`/api/ecovadis?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/ecovadis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org.id, annee: year }),
        })
        const { data: created } = await createRes.json()
        diagId = created?.id
        if (!diagId) return
        setDiagnostic(created)
        setInitializing(false)
      } else {
        setDiagnostic(existingDiag)
      }

      // Charger réponses + actions + documents
      const [repRes, actRes] = await Promise.all([
        fetch(`/api/ecovadis/${diagId}/reponses`),
        fetch(`/api/ecovadis/${diagId}/actions`),
      ])
      const [{ data: repData }, { data: actData }] = await Promise.all([repRes.json(), actRes.json()])
      const repMap: Record<string, Reponse> = {}
      for (const r of (repData ?? [])) repMap[r.critere_id] = r
      setReponses(repMap)
      setActions(actData ?? [])
    } finally {
      setLoading(false)
    }
  }, [org, year])

  useEffect(() => { load() }, [load])

  async function handleReponseChange(critere_id: string, niveau: number, commentaire: string) {
    if (!diagnostic) return
    // Mise à jour optimiste
    setReponses(prev => ({ ...prev, [critere_id]: { critere_id, niveau, commentaire } }))
    // Sauvegarde
    await fetch(`/api/ecovadis/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    // Recalcul du score global
    const newNiveaux: Record<string, number> = {}
    setReponses(current => {
      for (const [k, v] of Object.entries({ ...current, [critere_id]: { niveau } })) {
        newNiveaux[k] = (v as { niveau: number }).niveau
      }
      return current
    })
    // Légèrement différé pour avoir l'état à jour
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateScore(n2)
        if (diagnostic) {
          fetch(`/api/ecovadis/${diagnostic.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score_global: score }),
          })
          setDiagnostic(prev => prev ? { ...prev, score_global: score } : null)
        }
        return current
      })
    }, 100)
  }

  const lockedTabs = !org || !diagnostic ? ['diagnostic', 'actions', 'documents'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">
      {/* Score dans le header */}
      {diagnostic && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
          <span>Score simulé :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
          {(() => { const b = getBadge(diagnostic.score_global ?? 0); return <span style={{ color: b.color }}>{b.icon} {b.label}</span> })()}
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {VIEWS.map(v => {
          const locked = lockedTabs.includes(v.id)
          return (
            <button
              key={v.id}
              onClick={() => !locked && setView(v.id)}
              disabled={locked}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                view === v.id ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : locked ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span>{v.icon}</span>{v.label}
            </button>
          )
        })}
      </div>

      {/* Contenu des vues */}
      {view === 'presentation' && <PresentationView />}
      {view === 'diagnostic' && org && diagnostic && (
        <DiagnosticView
          diagnostic={diagnostic}
          reponses={reponses}
          actions={actions}
          documents={documents}
          onReponseChange={handleReponseChange}
          onActionsChange={setActions}
          onDocumentsChange={setDocuments}
        />
      )}
      {view === 'actions' && diagnostic && (
        <ActionsView diagnostic={diagnostic} actions={actions} onActionsChange={setActions} />
      )}
      {view === 'documents' && diagnostic && (
        <DocumentsView diagnostic={diagnostic} documents={documents} onDocumentsChange={setDocuments} />
      )}
    </div>
  )
}
