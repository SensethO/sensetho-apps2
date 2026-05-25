'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ViewTabs from '@/components/rse/ViewTabs'
import type { RseContext } from '@/components/rse/RseAppShell'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GreenClaimsAllegation {
  id: string
  org_id: string
  year: number
  allegation_text: string
  type: 'explicite' | 'generique' | 'comparative' | 'label-certification'
  domain: 'general' | 'energie' | 'biodiversite' | 'dechets' | 'carbone' | 'eau'
  scope: 'produit-entier' | 'composant' | 'service' | 'entreprise-entiere'
  evidence_method: 'acv-complete' | 'mesure-directe' | 'certification-reconnue' | 'declaration-fournisseur' | 'aucune'
  third_party_verified: 'oui' | 'non' | 'nsp'
  scope_clear: 'claire' | 'vague' | 'nsp'
  no_compensation_only: 'correct' | 'offsets-seuls' | 'nsp'
  no_hidden_impact: 'transparent' | 'impacts-caches' | 'nsp'
  is_comparative: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

type AllegationDraft = Omit<GreenClaimsAllegation, 'id' | 'org_id' | 'year' | 'created_at' | 'updated_at'>

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'accueil',    label: 'Présentation', icon: '📋' },
  { id: 'allegations', label: 'Allégations',  icon: '🏷️' },
  { id: 'analyse',    label: 'Analyse IA',   icon: '🤖' },
] as const
type View = typeof TABS[number]['id']

// ─── Score & statut ───────────────────────────────────────────────────────────

function computeScore(a: GreenClaimsAllegation): number {
  let score = 0
  const ev: Record<string, number> = {
    'acv-complete': 30,
    'mesure-directe': 25,
    'certification-reconnue': 20,
    'declaration-fournisseur': 10,
    'aucune': 0,
  }
  score += ev[a.evidence_method] ?? 0
  if (a.third_party_verified === 'oui') score += 20
  else if (a.third_party_verified === 'nsp') score += 5
  if (a.scope_clear === 'claire') score += 20
  else if (a.scope_clear === 'nsp') score += 5
  if (a.no_compensation_only === 'correct') score += 20
  else if (a.no_compensation_only === 'nsp') score += 5
  if (a.no_hidden_impact === 'transparent') score += 10
  else if (a.no_hidden_impact === 'nsp') score += 3
  if (a.type === 'generique') score = Math.max(0, score - 20)
  if (a.type === 'label-certification' && a.evidence_method === 'certification-reconnue') score = Math.min(100, score + 10)
  return Math.min(100, score)
}

function getStatus(score: number): 'conforme' | 'risque' | 'non-conforme' {
  if (score >= 75) return 'conforme'
  if (score >= 40) return 'risque'
  return 'non-conforme'
}

const STATUS_COLORS = {
  conforme: { bg: '#16a34a', text: '#fff', label: 'Conforme' },
  risque: { bg: '#d97706', text: '#fff', label: 'À risque' },
  'non-conforme': { bg: '#dc2626', text: '#fff', label: 'Non conforme' },
}

// ─── Libellés ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  explicite: 'Explicite',
  generique: 'Générique',
  comparative: 'Comparative',
  'label-certification': 'Label/Certification',
}

const DOMAIN_LABELS: Record<string, string> = {
  general: 'Général',
  energie: 'Énergie',
  biodiversite: 'Biodiversité',
  dechets: 'Déchets',
  carbone: 'Carbone',
  eau: 'Eau',
}

const SCOPE_LABELS: Record<string, string> = {
  'produit-entier': 'Produit entier',
  composant: 'Composant',
  service: 'Service',
  'entreprise-entiere': 'Entreprise entière',
}

const EVIDENCE_LABELS: Record<string, string> = {
  'acv-complete': 'ACV complète',
  'mesure-directe': 'Mesure directe',
  'certification-reconnue': 'Certification reconnue',
  'declaration-fournisseur': 'Déclaration fournisseur',
  aucune: 'Aucune',
}

// ─── Brouillon vide ───────────────────────────────────────────────────────────

const EMPTY_DRAFT: AllegationDraft = {
  allegation_text: '',
  type: 'explicite',
  domain: 'general',
  scope: 'produit-entier',
  evidence_method: 'aucune',
  third_party_verified: 'nsp',
  scope_clear: 'nsp',
  no_compensation_only: 'nsp',
  no_hidden_impact: 'nsp',
  is_comparative: false,
  notes: null,
}

// ─── Aperçu du score (dans le formulaire) ────────────────────────────────────

function ScorePreview({ draft }: { draft: AllegationDraft }) {
  const fake = { ...draft, id: '', org_id: '', year: 0, created_at: '', updated_at: '' } as GreenClaimsAllegation
  const score = computeScore(fake)
  const status = getStatus(score)
  const c = STATUS_COLORS[status]
  return (
    <div className="mt-4 flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
        style={{ backgroundColor: c.bg }}>
        {score}
      </div>
      <div>
        <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Score de conformité prévisible</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Statut : <span className="font-medium" style={{ color: c.bg }}>{c.label}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Formulaire d'allégation ──────────────────────────────────────────────────

function AllegationForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: AllegationDraft
  onSubmit: (d: AllegationDraft) => void
  onCancel: () => void
  loading: boolean
}) {
  const [draft, setDraft] = useState<AllegationDraft>(initial)
  const set = <K extends keyof AllegationDraft>(k: K, v: AllegationDraft[K]) =>
    setDraft(d => ({ ...d, [k]: v }))

  const ToggleGroup = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string
    options: { v: string; l: string }[]
    value: string
    onChange: (v: string) => void
  }) => (
    <div>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="flex gap-1 flex-wrap">
        {options.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="px-2.5 py-1 rounded text-xs font-medium border transition-all"
            style={value === o.v
              ? { backgroundColor: 'var(--accent, #6366f1)', color: '#fff', borderColor: 'var(--accent, #6366f1)' }
              : { backgroundColor: 'var(--bg)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
            }
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(draft) }}
      className="space-y-4"
    >
      {/* Texte */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
          Texte de l&apos;allégation <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={draft.allegation_text}
          onChange={e => set('allegation_text', e.target.value)}
          rows={3}
          placeholder="Ex : « Notre emballage est 100% recyclable »"
          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Type + Domaine */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type d&apos;allégation</label>
          <select
            value={draft.type}
            onChange={e => set('type', e.target.value as AllegationDraft['type'])}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Domaine environnemental</label>
          <select
            value={draft.domain}
            onChange={e => set('domain', e.target.value as AllegationDraft['domain'])}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {Object.entries(DOMAIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Portée + Méthode de preuve */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Portée</label>
          <select
            value={draft.scope}
            onChange={e => set('scope', e.target.value as AllegationDraft['scope'])}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {Object.entries(SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Méthode de preuve</label>
          <select
            value={draft.evidence_method}
            onChange={e => set('evidence_method', e.target.value as AllegationDraft['evidence_method'])}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {Object.entries(EVIDENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Boutons toggle */}
      <ToggleGroup
        label="Vérification tierce indépendante"
        options={[{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'nsp', l: 'NSP' }]}
        value={draft.third_party_verified}
        onChange={v => set('third_party_verified', v as AllegationDraft['third_party_verified'])}
      />
      <ToggleGroup
        label="Portée de l'allégation précisément délimitée"
        options={[{ v: 'claire', l: 'Claire' }, { v: 'vague', l: 'Vague' }, { v: 'nsp', l: 'NSP' }]}
        value={draft.scope_clear}
        onChange={v => set('scope_clear', v as AllegationDraft['scope_clear'])}
      />
      <ToggleGroup
        label="Pas basée uniquement sur des compensations carbone"
        options={[{ v: 'correct', l: 'Correct' }, { v: 'offsets-seuls', l: 'Offsets seuls' }, { v: 'nsp', l: 'NSP' }]}
        value={draft.no_compensation_only}
        onChange={v => set('no_compensation_only', v as AllegationDraft['no_compensation_only'])}
      />
      <ToggleGroup
        label="Aucun impact négatif dissimulé"
        options={[{ v: 'transparent', l: 'Transparent' }, { v: 'impacts-caches', l: 'Impacts cachés' }, { v: 'nsp', l: 'NSP' }]}
        value={draft.no_hidden_impact}
        onChange={v => set('no_hidden_impact', v as AllegationDraft['no_hidden_impact'])}
      />

      {/* Comparative */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.is_comparative}
          onChange={e => set('is_comparative', e.target.checked)}
          className="w-4 h-4 rounded accent-green-600"
        />
        <span className="text-sm" style={{ color: 'var(--text)' }}>Allégation comparative (implique un article 5)</span>
      </label>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes internes</label>
        <textarea
          value={draft.notes ?? ''}
          onChange={e => set('notes', e.target.value || null)}
          rows={2}
          placeholder="Commentaires, sources, références..."
          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Aperçu score */}
      <ScorePreview draft={draft} />

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || !draft.allegation_text.trim()}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#16a34a' }}
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg transition-opacity hover:opacity-70"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

// ─── Carte allégation ─────────────────────────────────────────────────────────

function AllegationCard({
  allegation,
  onEdit,
  onDelete,
}: {
  allegation: GreenClaimsAllegation
  onEdit: (a: GreenClaimsAllegation) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const score = computeScore(allegation)
  const status = getStatus(score)
  const c = STATUS_COLORS[status]

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-start gap-3 p-4">
        {/* Score circle */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: c.bg }}
        >
          {score}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium italic" style={{ color: 'var(--text)' }}>
            &ldquo;{allegation.allegation_text}&rdquo;
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {TYPE_LABELS[allegation.type]}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {DOMAIN_LABELS[allegation.domain]}
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: c.bg, color: c.text }}
            >
              {c.label}
            </span>
          </div>
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 p-1.5 rounded-lg hover:opacity-70 transition-opacity text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Portée</div>
              <div style={{ color: 'var(--text)' }}>{SCOPE_LABELS[allegation.scope]}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Méthode de preuve</div>
              <div style={{ color: 'var(--text)' }}>{EVIDENCE_LABELS[allegation.evidence_method]}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Vérification tierce</div>
              <div style={{ color: 'var(--text)' }}>{allegation.third_party_verified === 'oui' ? '✅ Oui' : allegation.third_party_verified === 'non' ? '❌ Non' : '❓ NSP'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Portée délimitée</div>
              <div style={{ color: 'var(--text)' }}>{allegation.scope_clear === 'claire' ? '✅ Claire' : allegation.scope_clear === 'vague' ? '⚠️ Vague' : '❓ NSP'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Sans offsets seuls</div>
              <div style={{ color: 'var(--text)' }}>{allegation.no_compensation_only === 'correct' ? '✅ Correct' : allegation.no_compensation_only === 'offsets-seuls' ? '❌ Offsets seuls' : '❓ NSP'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Sans impact caché</div>
              <div style={{ color: 'var(--text)' }}>{allegation.no_hidden_impact === 'transparent' ? '✅ Transparent' : allegation.no_hidden_impact === 'impacts-caches' ? '❌ Impacts cachés' : '❓ NSP'}</div>
            </div>
          </div>
          {allegation.notes && (
            <div className="text-xs p-2 rounded" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <span className="font-medium">Notes :</span> {allegation.notes}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit(allegation)}
              className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:opacity-70 transition-opacity"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              ✏️ Modifier
            </button>
            <button
              onClick={() => onDelete(allegation.id)}
              className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:opacity-70 transition-opacity text-red-500"
              style={{ borderColor: '#fca5a5' }}
            >
              🗑️ Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function AccueilView({
  allegations,
  hasOrg,
  onNavigateToAllegations,
}: {
  allegations: GreenClaimsAllegation[]
  hasOrg: boolean
  onNavigateToAllegations: () => void
}) {
  const total = allegations.length
  const conformes = allegations.filter(a => getStatus(computeScore(a)) === 'conforme').length
  const risque = allegations.filter(a => getStatus(computeScore(a)) === 'risque').length
  const nonConformes = allegations.filter(a => getStatus(computeScore(a)) === 'non-conforme').length

  const stats = [
    { label: 'Allégations analysées', value: total.toString(), icon: '🏷️', color: 'var(--text)' },
    { label: 'Conformes', value: conformes.toString(), icon: '✅', color: '#16a34a' },
    { label: 'À risque', value: risque.toString(), icon: '⚠️', color: '#d97706' },
    { label: 'Non conformes', value: nonConformes.toString(), icon: '❌', color: '#dc2626' },
  ]

  const articles = [
    { code: 'Art. 3', title: 'Substantiation des allégations', desc: "Toute allégation doit être étayée par des preuves scientifiques reconnues avant d'être communiquée." },
    { code: 'Art. 4', title: 'Vérification tierce indépendante', desc: "Les allégations explicites doivent faire l'objet d'une vérification par un organisme accrédité." },
    { code: 'Art. 5', title: 'Allégations comparatives', desc: "Les comparaisons doivent être équitables, porter sur des produits similaires et s'appuyer sur des données vérifiables." },
    { code: 'Art. 6', title: 'Labels environnementaux', desc: 'Seuls les labels reconnus par la Commission européenne ou fondés sur des systèmes officiels sont autorisés.' },
    { code: 'Annexe I', title: 'Pratiques commerciales déloyales', desc: 'Liste des pratiques interdites : greenwashing, allégations vagues, compensations seules, impacts cachés.' },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 50%, #0d9488 100%)' }}
      >
        <div className="text-5xl mb-3">🌿</div>
        <h1 className="text-2xl font-bold mb-2">Directive Green Claims</h1>
        <p className="text-sm opacity-90 max-w-2xl">
          Directive UE 2024/825/EU sur les allégations environnementales — entrée en vigueur progressive 2026–2028.
          Analysez la conformité de vos allégations vertes et identifiez les risques de greenwashing.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Articles clés */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Articles clés de la Directive</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {articles.map(a => (
            <div key={a.code} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-bold text-green-600 mb-1">{a.code}</div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{a.title}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA ou message */}
      {hasOrg ? (
        <div className="flex">
          <button
            onClick={onNavigateToAllegations}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#16a34a' }}
          >
            📋 Gérer les allégations
          </button>
        </div>
      ) : (
        <div className="rounded-xl border p-5 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Sélectionnez une organisation pour commencer l&apos;analyse de vos allégations environnementales.
        </div>
      )}

      {/* Liens apps */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Applications RSE associées</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/rse/diagnostic-initial"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            🧭 Diagnostic RSE initial guidé
          </Link>
          <Link href="/rse/iso26000"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            ♻️ Diagnostic ISO 26000
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Vue Allégations ──────────────────────────────────────────────────────────

function AllegationsView({
  allegations,
  onRefresh,
  orgId,
  year,
}: {
  allegations: GreenClaimsAllegation[]
  onRefresh: () => void
  orgId: string
  year: number
}) {
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<GreenClaimsAllegation | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const scores = allegations.map(computeScore)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const conformes = allegations.filter(a => getStatus(computeScore(a)) === 'conforme').length
  const risque = allegations.filter(a => getStatus(computeScore(a)) === 'risque').length
  const nonConformes = allegations.filter(a => getStatus(computeScore(a)) === 'non-conforme').length

  async function handleSubmit(draft: AllegationDraft) {
    setSaving(true)
    try {
      if (editTarget) {
        await supabase
          .from('green_claims_allegations')
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq('id', editTarget.id)
      } else {
        await supabase
          .from('green_claims_allegations')
          .insert({ ...draft, org_id: orgId, year })
      }
      setShowForm(false)
      setEditTarget(null)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette allégation ?')) return
    await supabase.from('green_claims_allegations').delete().eq('id', id)
    onRefresh()
  }

  function handleEdit(a: GreenClaimsAllegation) {
    setEditTarget(a)
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditTarget(null)
  }

  const editDraft: AllegationDraft = editTarget
    ? {
        allegation_text: editTarget.allegation_text,
        type: editTarget.type,
        domain: editTarget.domain,
        scope: editTarget.scope,
        evidence_method: editTarget.evidence_method,
        third_party_verified: editTarget.third_party_verified,
        scope_clear: editTarget.scope_clear,
        no_compensation_only: editTarget.no_compensation_only,
        no_hidden_impact: editTarget.no_hidden_impact,
        is_comparative: editTarget.is_comparative,
        notes: editTarget.notes,
      }
    : EMPTY_DRAFT

  return (
    <div className="space-y-6">
      {/* Stats résumé */}
      {allegations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{avgScore}/100</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Score global moyen</div>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xl font-bold" style={{ color: '#16a34a' }}>{conformes}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Conformes</div>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xl font-bold" style={{ color: '#d97706' }}>{risque}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>À risque</div>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xl font-bold" style={{ color: '#dc2626' }}>{nonConformes}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Non conformes</div>
          </div>
        </div>
      )}

      {/* Bouton + formulaire */}
      {!showForm ? (
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#16a34a' }}
        >
          + Ajouter une allégation
        </button>
      ) : (
        <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
            {editTarget ? "Modifier l'allégation" : 'Nouvelle allégation'}
          </h3>
          <AllegationForm
            initial={editDraft}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={saving}
          />
        </div>
      )}

      {/* Liste */}
      {allegations.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-3">🏷️</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucune allégation pour cette organisation et cette année.<br />
            Commencez par ajouter vos premières allégations environnementales.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allegations.map(a => (
            <AllegationCard
              key={a.id}
              allegation={a}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Vue Analyse IA ───────────────────────────────────────────────────────────

function AnalyseView({ allegations }: { allegations: GreenClaimsAllegation[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Analyse IA — Recommandations</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Obtenez des recommandations concrètes basées sur la Directive Green Claims et les risques identifiés dans vos allégations.
        </p>
      </div>

      {allegations.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Ajoutez des allégations pour obtenir une analyse personnalisée.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-4">
            <div className="text-3xl">🤖</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Analyse de {allegations.length} allégation{allegations.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                L&apos;IA analysera chaque allégation au regard des articles 3, 4, 5, 6 et de l&apos;Annexe I de la Directive Green Claims UE 2024/825/EU
                et fournira des recommandations priorisées pour améliorer votre conformité.
              </p>
              <button
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl opacity-60 cursor-not-allowed"
                style={{ backgroundColor: '#6366f1' }}
                disabled
                title="Fonctionnalité à venir"
              >
                ✨ Analyser avec l&apos;IA
              </button>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Fonctionnalité disponible prochainement.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GreenClaimsApp({ ctx }: { ctx: RseContext }) {
  const [view, setView] = useState<View>('accueil')
  const [allegations, setAllegations] = useState<GreenClaimsAllegation[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const disabledTabs = !ctx.org
    ? TABS.filter(t => t.id !== 'accueil').map(t => t.id)
    : []

  const loadAllegations = useCallback(async () => {
    if (!ctx.org) { setAllegations([]); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('green_claims_allegations')
        .select('*')
        .eq('org_id', ctx.org.id)
        .eq('year', ctx.year)
        .order('created_at', { ascending: false })
      setAllegations(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [ctx.org, ctx.year, supabase])

  useEffect(() => { loadAllegations() }, [loadAllegations])

  return (
    <div>
      <ViewTabs
        tabs={TABS}
        active={view}
        onChange={setView}
        disabledIds={disabledTabs}
      />

      {view === 'accueil' && (
        <AccueilView
          allegations={allegations}
          hasOrg={!!ctx.org}
          onNavigateToAllegations={() => setView('allegations')}
        />
      )}

      {view === 'allegations' && ctx.org && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          </div>
        ) : (
          <AllegationsView
            allegations={allegations}
            onRefresh={loadAllegations}
            orgId={ctx.org.id}
            year={ctx.year}
          />
        )
      )}

      {view === 'analyse' && ctx.org && (
        <AnalyseView allegations={allegations} />
      )}
    </div>
  )
}
