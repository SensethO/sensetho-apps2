/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { RseContext } from '@/components/rse/RseAppShell'

// ─── Données statiques ────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { v: 'explicite',          l: 'Explicite',         icon: '🎯', desc: '« Réduit les émissions de 30% »' },
  { v: 'generique',          l: 'Générique',          icon: '🌿', desc: '« Écologique », « vert », « durable »' },
  { v: 'comparative',        l: 'Comparative',        icon: '📊', desc: '« Plus respectueux que le produit X »' },
  { v: 'label-certification', l: 'Label/Certification', icon: '⭐', desc: 'Ecolabel EU, NF Environnement…' },
]

const DOMAIN_OPTIONS = [
  { v: 'general',      l: 'Général' },
  { v: 'carbone',      l: 'Carbone / Climat' },
  { v: 'energie',      l: 'Énergie' },
  { v: 'eau',          l: 'Eau' },
  { v: 'biodiversite', l: 'Biodiversité' },
  { v: 'dechets',      l: 'Déchets / Économie circulaire' },
]

const SCOPE_OPTIONS = [
  { v: 'produit-entier',    l: 'Produit entier' },
  { v: 'composant',         l: 'Composant' },
  { v: 'service',           l: 'Service' },
  { v: 'entreprise-entiere', l: 'Entreprise entière' },
]

const EVIDENCE_OPTIONS = [
  { v: 'acv-complete',           l: 'ACV complète',              score: 30 },
  { v: 'mesure-directe',         l: 'Mesure directe vérifiée',   score: 25 },
  { v: 'certification-reconnue', l: 'Certification reconnue',     score: 20 },
  { v: 'declaration-fournisseur', l: 'Déclaration fournisseur',  score: 10 },
  { v: 'aucune',                 l: 'Aucune',                     score: 0 },
]

const ARTICLES = [
  { code: 'Art. 3',     label: 'Substantiation des allégations', color: '#15803d' },
  { code: 'Art. 4',     label: 'Vérification tierce',            color: '#1d4ed8' },
  { code: 'Art. 5',     label: 'Comparaisons',                   color: '#7c3aed' },
  { code: 'Art. 6',     label: 'Labels',                         color: '#b45309' },
  { code: 'Annexe I',   label: 'Pratiques interdites',           color: '#dc2626' },
]

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Diagnostic {
  id: string; titre: string; statut: string
  score_global: number; nb_conformes: number; nb_risque: number; nb_non_conformes: number; nb_total: number
  org_id: string; annee: number; created_at: string; updated_at: string
}

interface Allegation {
  id: string; diagnostic_id: string; allegation_text: string
  type: string; domain: string; scope: string; evidence_method: string
  third_party_verified: string; scope_clear: string; no_compensation_only: string; no_hidden_impact: string
  is_comparative: boolean; notes: string | null; created_at: string
}

// ─── Helpers score ────────────────────────────────────────────────────────────

function computeScore(a: Partial<Allegation>): number {
  let s = 0
  const ev: Record<string, number> = { 'acv-complete': 30, 'mesure-directe': 25, 'certification-reconnue': 20, 'declaration-fournisseur': 10, aucune: 0 }
  s += ev[a.evidence_method ?? 'aucune'] ?? 0
  if (a.third_party_verified === 'oui') s += 20; else if (a.third_party_verified === 'nsp') s += 5
  if (a.scope_clear === 'claire') s += 20; else if (a.scope_clear === 'nsp') s += 5
  if (a.no_compensation_only === 'correct') s += 20; else if (a.no_compensation_only === 'nsp') s += 5
  if (a.no_hidden_impact === 'transparent') s += 10; else if (a.no_hidden_impact === 'nsp') s += 3
  if (a.type === 'generique') s = Math.max(0, s - 20)
  if (a.type === 'label-certification' && a.evidence_method === 'certification-reconnue') s = Math.min(100, s + 10)
  return Math.min(100, s)
}

function getStatut(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: 'Conforme',      color: '#15803d', bg: '#dcfce7' }
  if (score >= 40) return { label: 'À risque',       color: '#b45309', bg: '#fef3c7' }
  return              { label: 'Non conforme',  color: '#dc2626', bg: '#fee2e2' }
}

// ─── Composant score circulaire SVG ─────────────────────────────────────────

function CircularScore({ score, size = 60 }: { score: number; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const { color } = getStatut(score)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

// ─── Formulaire d'allégation ──────────────────────────────────────────────────

const EMPTY_DRAFT: Partial<Allegation> = {
  allegation_text: '', type: 'explicite', domain: 'general', scope: 'produit-entier',
  evidence_method: 'aucune', third_party_verified: 'nsp', scope_clear: 'nsp',
  no_compensation_only: 'nsp', no_hidden_impact: 'nsp', is_comparative: false, notes: null,
}

function ToggleBtn({ options, value, onChange }: { options: {v:string,l:string}[], value: string, onChange: (v:string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${value === o.v ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function AllegationForm({
  initial, onSubmit, onCancel, saving,
}: {
  initial: Partial<Allegation>
  onSubmit: (d: Partial<Allegation>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<Partial<Allegation>>(initial)
  const set = (k: keyof Allegation, v: any) => setDraft(d => ({ ...d, [k]: v }))
  const liveScore = computeScore(draft)
  const liveStatut = getStatut(liveScore)

  return (
    <form onSubmit={async e => { e.preventDefault(); await onSubmit(draft) }} className="space-y-4">
      {/* Texte */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Texte de l&apos;allégation *</label>
        <textarea required rows={3} value={draft.allegation_text ?? ''} onChange={e => set('allegation_text', e.target.value)}
          placeholder='Ex : « Notre emballage est 100% recyclable »'
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
      </div>

      {/* Type + Domaine */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type d&apos;allégation</label>
          <select className={inputCls()} value={draft.type} onChange={e => set('type', e.target.value)}>
            {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.icon} {o.l}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-0.5">{TYPE_OPTIONS.find(o => o.v === draft.type)?.desc}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Domaine environnemental</label>
          <select className={inputCls()} value={draft.domain} onChange={e => set('domain', e.target.value)}>
            {DOMAIN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>

      {/* Portée + Méthode de preuve */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Portée</label>
          <select className={inputCls()} value={draft.scope} onChange={e => set('scope', e.target.value)}>
            {SCOPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Méthode de preuve (Art. 3.1)</label>
          <select className={inputCls()} value={draft.evidence_method} onChange={e => set('evidence_method', e.target.value)}>
            {EVIDENCE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l} (+{o.score}pts)</option>)}
          </select>
        </div>
      </div>

      {/* Critères binaires */}
      <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Critères de conformité</div>
        {[
          { k: 'third_party_verified' as keyof Allegation, label: 'Art. 4 — Vérification tierce indépendante', opts: [{v:'oui',l:'Oui ✅'},{v:'non',l:'Non ❌'},{v:'nsp',l:'NSP'}] },
          { k: 'scope_clear' as keyof Allegation, label: 'Art. 3.2 — Portée précisément délimitée', opts: [{v:'claire',l:'Claire ✅'},{v:'vague',l:'Vague ⚠️'},{v:'nsp',l:'NSP'}] },
          { k: 'no_compensation_only' as keyof Allegation, label: 'Art. 3.3 — Pas uniquement basée sur des compensations carbone', opts: [{v:'correct',l:'Correct ✅'},{v:'offsets-seuls',l:'Offsets seuls ❌'},{v:'nsp',l:'NSP'}] },
          { k: 'no_hidden_impact' as keyof Allegation, label: 'Annexe I — Aucun impact négatif dissimulé', opts: [{v:'transparent',l:'Transparent ✅'},{v:'impacts-caches',l:'Impacts cachés ❌'},{v:'nsp',l:'NSP'}] },
        ].map(({ k, label, opts }) => (
          <div key={String(k)}>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
            <ToggleBtn options={opts} value={String(draft[k] ?? 'nsp')} onChange={v => set(k, v)} />
          </div>
        ))}
        {/* Comparative */}
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={!!draft.is_comparative} onChange={e => set('is_comparative', e.target.checked)}
            className="w-4 h-4 rounded accent-green-600" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Art. 5 — Allégation comparative (avec un autre produit/entreprise)</span>
        </label>
      </div>

      {/* Score live */}
      <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: liveStatut.color + '44', background: liveStatut.bg }}>
        <CircularScore score={liveScore} size={48} />
        <div>
          <div className="text-xs font-semibold" style={{ color: liveStatut.color }}>Score de conformité estimé : {liveScore}/100</div>
          <div className="text-xs" style={{ color: liveStatut.color }}>{liveStatut.label}</div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes internes / sources</label>
        <textarea rows={2} value={draft.notes ?? ''} onChange={e => set('notes', e.target.value || null)}
          placeholder="Références, sources, commentaires..."
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !draft.allegation_text?.trim()} className={btnP()}>
          {saving ? '…' : '✓ Enregistrer'}
        </button>
        <button type="button" onClick={onCancel} className={btnS()}>Annuler</button>
      </div>
    </form>
  )
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #15803d 0%, #059669 50%, #0d9488 100%)' }}>
        <div className="text-5xl mb-3">🌿</div>
        <h1 className="text-2xl font-bold mb-2">Directive Green Claims</h1>
        <p className="text-sm opacity-90 max-w-xl">
          Directive UE 2024/825/EU — entrée en vigueur progressive 2026–2028.
          Évaluez la conformité de vos allégations environnementales : preuve scientifique, vérification tierce, portée précise, absence de compensation-only.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {ARTICLES.map(a => (
            <span key={a.code} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.2)' }}>
              {a.code} — {a.label}
            </span>
          ))}
        </div>
      </div>

      {/* Articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { code: 'Art. 3', icon: '🔬', title: 'Substantiation', color: '#15803d',
            desc: "Toute allégation doit être étayée par des preuves scientifiques reconnues, des méthodes d'évaluation standardisées et inclure une analyse du cycle de vie." },
          { code: 'Art. 4', icon: '✅', title: 'Vérification tierce', color: '#1d4ed8',
            desc: "Les allégations explicites doivent être vérifiées par un organisme d'évaluation de la conformité accrédité avant leur communication sur le marché." },
          { code: 'Art. 5', icon: '📊', title: 'Comparaisons', color: '#7c3aed',
            desc: "Les allégations comparatives doivent reposer sur des critères équivalents, des données mises à jour, et porter sur des produits comparables." },
          { code: 'Art. 6', icon: '⭐', title: 'Labels environnementaux', color: '#b45309',
            desc: "Seuls les labels reconnus officiellement par la Commission européenne ou fondés sur des systèmes nationaux officiels sont autorisés. Aucun nouveau label privé." },
          { code: 'Annexe I', icon: '🚫', title: 'Pratiques interdites', color: '#dc2626',
            desc: "Greenwashing, allégations vagues (« vert », « éco »), neutralité climatique basée uniquement sur des compensations, labels non officiels, impacts cachés." },
          { code: 'Sanctions', icon: '⚖️', title: 'Entrée en vigueur', color: '#374151',
            desc: "Mise en œuvre progressive : 2026 pour les grandes entreprises, 2028 pour les PME. Sanctions pouvant atteindre 4% du chiffre d'affaires annuel." },
        ].map(item => (
          <div key={item.code} className={card('p-4')} style={{ borderLeft: `3px solid ${item.color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: item.color }}>{item.code}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className={card('p-5 flex items-center justify-between gap-4 flex-wrap')}>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">Commencer votre diagnostic</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Créez un diagnostic par produit, campagne ou exercice</div>
        </div>
        <button onClick={onNavigate} className={btnP('flex items-center gap-1.5')}>
          📋 Mes diagnostics →
        </button>
      </div>
    </div>
  )
}

// ─── Vue liste des diagnostics ────────────────────────────────────────────────

function DiagnosticsListView({
  org, year, diagnostics, loading, onCreate, onOpen, onDelete,
}: {
  org: { id: string; denomination: string } | null
  year: number
  diagnostics: Diagnostic[]
  loading: boolean
  onCreate: (titre: string) => Promise<void>
  onOpen: (d: Diagnostic) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [titre, setTitre] = useState('')
  const [creating, setCreating] = useState(false)
  const [diagToDelete, setDiagToDelete] = useState<Diagnostic | null>(null)

  useEffect(() => { setTitre(`Diagnostic Green Claims ${year}`) }, [year])

  async function handleCreate() {
    if (!titre.trim()) return
    setCreating(true)
    await onCreate(titre)
    setCreating(false)
    setShowForm(false)
  }

  if (!org) {
    return (
      <div className={card('p-10 text-center')}>
        <div className="text-4xl mb-3">🌿</div>
        <p className="text-gray-500 dark:text-gray-400">Sélectionnez une organisation pour accéder à vos diagnostics</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Bannière Directive */}
      <div className="rounded-xl p-4 text-white text-sm" style={{ background: 'linear-gradient(90deg, #15803d, #059669)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">📋</span>
          <span className="font-bold text-sm">Directive Green Claims — UE 2024/825/EU</span>
        </div>
        <p className="text-xs opacity-90 mb-2">Évaluez la conformité de vos allégations environnementales : preuve scientifique, vérification tierce, portée précise, absence de compensation-only. Entrée en vigueur progressive 2026–2028.</p>
        <div className="flex flex-wrap gap-1.5">
          {ARTICLES.map(a => (
            <span key={a.code} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.2)' }}>
              {a.code} — {a.label}
            </span>
          ))}
        </div>
      </div>

      {/* Header liste */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-bold text-gray-900 dark:text-white">Mes diagnostics ({diagnostics.length})</span>
          <span className="ml-2">— {org.denomination} · {year}</span>
        </div>
        <button onClick={() => setShowForm(v => !v)} className={btnP('flex items-center gap-1.5')}>
          <span>+</span> Nouveau diagnostic
        </button>
      </div>

      {/* Formulaire nouveau */}
      {showForm && (
        <div className={card('p-5 space-y-4')}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Nouveau diagnostic</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Titre *</label>
            <input className={inputCls()} value={titre} onChange={e => setTitre(e.target.value)}
              placeholder={`Allégations produits ${year} — ${org.denomination}`} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !titre.trim()} className={btnP()}>
              {creating ? '…' : '✓ Créer'}
            </button>
            <button onClick={() => setShowForm(false)} className={btnS()}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : diagnostics.length === 0 ? (
        <div className={card('p-12 text-center')}>
          <div className="text-5xl mb-4">🌿</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun diagnostic pour {org.denomination} en {year}</p>
          <p className="text-gray-400 text-xs mt-1">Cliquez sur &quot;Nouveau diagnostic&quot; pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {diagnostics.map(d => (
            <div key={d.id} className={card('p-4 hover:shadow-md transition-shadow cursor-pointer group')} onClick={() => onOpen(d)}>
              <div className="flex items-start gap-3 mb-3">
                <CircularScore score={d.score_global} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors leading-tight">
                    {d.titre}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{d.nb_total} allégation{d.nb_total !== 1 ? 's' : ''}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setDiagToDelete(d) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm transition-all px-1 flex-shrink-0">✕</button>
              </div>
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {d.nb_non_conformes > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500" />{d.nb_non_conformes} non conforme{d.nb_non_conformes > 1 ? 's' : ''}
                  </span>
                )}
                {d.nb_risque > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />{d.nb_risque} à risque
                  </span>
                )}
                {d.nb_conformes > 0 && d.nb_non_conformes === 0 && d.nb_risque === 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" />{d.nb_conformes} conforme{d.nb_conformes > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>{d.nb_total} allégation{d.nb_total !== 1 ? 's' : ''}</span>
                <span>Màj {new Date(d.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal
        open={!!diagToDelete}
        title="Supprimer ce diagnostic ?"
        message={diagToDelete ? `"${diagToDelete.titre}" et ses allégations seront définitivement supprimés.` : undefined}
        onConfirm={() => { if (diagToDelete) onDelete(diagToDelete.id); setDiagToDelete(null) }}
        onCancel={() => setDiagToDelete(null)}
      />
    </div>
  )
}

// ─── Vue éditeur d'allégations ────────────────────────────────────────────────

function EditeurView({
  diag, allegations, onBack,
  onAddAllegation, onUpdateAllegation, onDeleteAllegation, onExport, onUpdateTitre,
}: {
  diag: Diagnostic
  allegations: Allegation[]
  onBack: () => void
  onAddAllegation: (d: Partial<Allegation>) => Promise<void>
  onUpdateAllegation: (id: string, d: Partial<Allegation>) => Promise<void>
  onDeleteAllegation: (id: string) => Promise<void>
  onExport: () => void
  onUpdateTitre: (titre: string) => void
}) {
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [editTitre, setEditTitre] = useState(false)
  const [titreVal, setTitreVal] = useState(diag.titre)
  const [allegToDelete, setAllegToDelete] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const scores = allegations.map(a => computeScore(a))
  const nbConformes = scores.filter(s => s >= 75).length
  const nbRisque = scores.filter(s => s >= 40 && s < 75).length
  const nbNonConformes = scores.filter(s => s < 40).length
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  async function handleSubmitNew(d: Partial<Allegation>) {
    setSaving(true)
    await onAddAllegation(d)
    setSaving(false)
    setSelected(null)
  }

  async function handleSubmitUpdate(id: string, d: Partial<Allegation>) {
    setSaving(true)
    await onUpdateAllegation(id, d)
    setSaving(false)
    setSelected(null)
  }

  const selectedAllegation = selected && selected !== 'new' ? allegations.find(a => a.id === selected) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={card('p-4')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">‹ Retour</button>
            {editTitre ? (
              <form onSubmit={e => { e.preventDefault(); onUpdateTitre(titreVal); setEditTitre(false) }} className="flex items-center gap-2">
                <input ref={titleRef} className="border border-green-400 rounded px-2 py-1 text-sm font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                  value={titreVal} onChange={e => setTitreVal(e.target.value)} autoFocus />
                <button type="submit" className="text-xs text-green-600 hover:text-green-700 font-medium">✓</button>
                <button type="button" onClick={() => { setEditTitre(false); setTitreVal(diag.titre) }} className="text-xs text-gray-400">✕</button>
              </form>
            ) : (
              <div>
                <button onClick={() => setEditTitre(true)} className="font-bold text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1">
                  {diag.titre} <span className="text-gray-300 text-xs">✏️</span>
                </button>
                <div className="text-xs text-gray-400">{allegations.length} allégation{allegations.length !== 1 ? 's' : ''} · Score moyen : {avgScore}/100</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mini stats */}
            {nbNonConformes > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">{nbNonConformes} NC</span>}
            {nbRisque > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 font-medium">{nbRisque} risque</span>}
            {nbConformes > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 font-medium">{nbConformes} ✓</span>}
            <button onClick={onExport} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">⬇ Excel</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Panneau gauche — liste allégations */}
        <div className={card('overflow-hidden')}>
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Allégations</span>
            <button onClick={() => setSelected('new')}
              className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 font-medium">+ Ajouter</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[60vh] overflow-y-auto">
            {allegations.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-400">
                Aucune allégation.<br />Cliquez sur &quot;+ Ajouter&quot; pour commencer.
              </div>
            )}
            {allegations.map(a => {
              const score = computeScore(a)
              const statut = getStatut(score)
              const isActive = selected === a.id
              return (
                <button key={a.id} onClick={() => setSelected(a.id === selected ? null : a.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors ${isActive ? 'bg-green-50 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                  <CircularScore score={score} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 dark:text-white font-medium truncate leading-tight text-[11px]">
                      &ldquo;{a.allegation_text}&rdquo;
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ color: statut.color, background: statut.bg }}>{statut.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panneau droit — formulaire */}
        <div className={card('p-5')}>
          {selected === null && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <div className="text-4xl mb-3">🏷️</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sélectionnez une allégation<br />ou cliquez sur &quot;+ Ajouter&quot;</p>
            </div>
          )}

          {selected === 'new' && (
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-4">Nouvelle allégation</div>
              <AllegationForm initial={EMPTY_DRAFT} onSubmit={handleSubmitNew} onCancel={() => setSelected(null)} saving={saving} />
            </div>
          )}

          {selected && selected !== 'new' && selectedAllegation && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-gray-900 dark:text-white">Modifier l&apos;allégation</div>
                <button onClick={() => setAllegToDelete(selectedAllegation.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">🗑 Supprimer</button>
              </div>
              <AllegationForm
                initial={selectedAllegation}
                onSubmit={d => handleSubmitUpdate(selectedAllegation.id, d)}
                onCancel={() => setSelected(null)}
                saving={saving}
              />
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={!!allegToDelete}
        title="Supprimer cette allégation ?"
        message="Cette action est irréversible."
        onConfirm={() => { if (allegToDelete) onDeleteAllegation(allegToDelete).then(() => setSelected(null)); setAllegToDelete(null) }}
        onCancel={() => setAllegToDelete(null)}
      />
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La Directive Green Claims s&apos;articule avec les référentiels RSE existants.
          Vos diagnostics Green Claims alimentent directement votre Rapport Intégré (sections E2, E4, E5) et votre diagnostic CSRD.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: '🇪🇺', title: 'CSRD / ESRS', sub: 'E1 Climat · E2 Pollution · E4 Biodiversité · E5 Économie circulaire', route: null, color: '#1d4ed8',
            links: ['Les allégations climatiques → ESRS E1', 'Les allégations biodiversité → ESRS E4', 'Économie circulaire → ESRS E5', 'Pratiques commerciales → ESRS S4 consommateurs'] },
          { icon: '🌿', title: 'ISO 26000', sub: 'Q3 Environnement · Q6 Loyauté pratiques', route: '/rse/iso26000', color: '#0ea5e9',
            links: ['DA3.1 à DA3.6 — Pratiques environnementales', 'DA6.4 — Concurrence loyale', 'DA6.5 — Pratiques commerciales responsables'] },
          { icon: '🌳', title: 'EUDR', sub: 'Déforestation — Allégations durabilité forêts', route: '/rse/eudr', color: '#16a34a',
            links: ['Import du score EUDR dans allégations biodiversité', 'Art. 3 Green Claims ↔ due diligence EUDR'] },
          { icon: '📄', title: 'Rapport Intégré', sub: 'IIRC / CSRD / GRI', route: '/rse/rapport-integre', color: '#374151',
            links: ['Export des scores Green Claims dans "Performance"', 'Section E2 Pollution', 'Section E4 Biodiversité', 'Section E5 Économie circulaire'] },
          { icon: '⭐', title: 'EcoVadis', sub: 'Thème Environnement', route: '/rse/ecovadis', color: '#ea580c',
            links: ['Les allégations substantiées améliorent le score EcoVadis', 'Méthode ACV → critères EcoVadis Environnement'] },
          { icon: '🔍', title: 'ISO 14001 / 14064', sub: 'Management environnemental & GES', route: null, color: '#15803d',
            links: ['ISO 14001 → système de management pour Art. 3', 'ISO 14064 → quantification GES (compensation)', 'ISO 14044 → méthodologie ACV pour la substantiation'] },
          { icon: '🏷️', title: 'Labels approuvés (Art. 6)', sub: 'Ecolabel EU · NF Environnement · Nordic Swan · PEFC · FSC', route: null, color: '#b45309',
            links: ['Ecolabel Européen (décision CE)', 'NF Environnement — AFNOR', 'PEFC / FSC pour les produits bois et forêt', 'EU Organic (agriculture biologique)'] },
          { icon: '🔗', title: 'GRI 301–305', sub: 'Matières · Énergie · Eau · Biodiversité · Émissions', route: '/rse/rapport-integre', color: '#6b7280',
            links: ['GRI 301 Matières → allégations économie circulaire', 'GRI 305 Émissions → allégations climatiques', 'GRI 304 Biodiversité → allégations biodiversité'] },
        ].map(item => (
          <div key={item.title} className={card('p-4')} style={{ borderLeft: `3px solid ${item.color}` }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{item.title}</span>
                  {item.route && (
                    <a href={item.route} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 font-medium">↗ Ouvrir</a>
                  )}
                </div>
                <div className="text-xs text-gray-400 mb-2">{item.sub}</div>
                <div className="space-y-0.5">
                  {item.links.map((l, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="text-green-400 flex-shrink-0">▸</span>{l}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

type View = 'presentation' | 'diagnostics' | 'editeur' | 'correspondances'

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'presentation',   label: 'Présentation',   icon: '📋' },
  { id: 'diagnostics',    label: 'Mes diagnostics', icon: '🏷️' },
  { id: 'editeur',        label: 'Éditeur',         icon: '✏️' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function GreenClaimsApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions: setHeaderActions } = ctx

  const [view, setView] = useState<View>('presentation')
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [loadingDiag, setLoadingDiag] = useState(false)
  const [currentDiag, setCurrentDiag] = useState<Diagnostic | null>(null)
  const [allegations, setAllegations] = useState<Allegation[]>([])
  const [loadingAlleg, setLoadingAlleg] = useState(false)

  // Charger diagnostics
  useEffect(() => {
    if (!org) { setDiagnostics([]); return }
    setLoadingDiag(true)
    fetch(`/api/green-claims?org_id=${org.id}&annee=${year}`)
      .then(r => r.json())
      .then(({ data }) => setDiagnostics(data ?? []))
      .finally(() => setLoadingDiag(false))
  }, [org, year])

  // Charger allégations quand un diagnostic est ouvert
  useEffect(() => {
    if (!currentDiag) { setAllegations([]); return }
    setLoadingAlleg(true)
    fetch(`/api/green-claims/${currentDiag.id}/allegations`)
      .then(r => r.json())
      .then(({ data }) => setAllegations(data ?? []))
      .finally(() => setLoadingAlleg(false))
  }, [currentDiag?.id])

  // Quand org/year change, fermer l'éditeur
  useEffect(() => {
    setCurrentDiag(null)
    if (view === 'editeur') setView('diagnostics')
  }, [org?.id, year])

  const handleCreate = useCallback(async (titre: string) => {
    if (!org) return
    const res = await fetch('/api/green-claims', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: org.id, annee: year, titre }),
    })
    const { data } = await res.json()
    if (data) {
      setDiagnostics(prev => [data, ...prev])
      setCurrentDiag(data)
      setView('editeur')
    }
  }, [org, year])

  function openDiag(d: Diagnostic) {
    setCurrentDiag(d)
    setView('editeur')
  }

  async function handleDelete(id: string) {
    await fetch(`/api/green-claims/${id}`, { method: 'DELETE' })
    setDiagnostics(prev => prev.filter(d => d.id !== id))
    if (currentDiag?.id === id) { setCurrentDiag(null); setView('diagnostics') }
  }

  const handleAddAllegation = useCallback(async (d: Partial<Allegation>) => {
    if (!currentDiag) return
    const res = await fetch(`/api/green-claims/${currentDiag.id}/allegations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    })
    const { data } = await res.json()
    if (data) {
      setAllegations(prev => [...prev, data])
      // Refresh diag stats
      const diagRes = await fetch(`/api/green-claims/${currentDiag.id}`)
      const { data: diagData } = await diagRes.json()
      if (diagData?.diag) {
        setCurrentDiag(diagData.diag)
        setDiagnostics(prev => prev.map(d => d.id === currentDiag.id ? diagData.diag : d))
      }
    }
  }, [currentDiag])

  const handleUpdateAllegation = useCallback(async (id: string, d: Partial<Allegation>) => {
    if (!currentDiag) return
    const res = await fetch(`/api/green-claims/${currentDiag.id}/allegations`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allegation_id: id, ...d }),
    })
    const { data } = await res.json()
    if (data) {
      setAllegations(prev => prev.map(a => a.id === id ? data : a))
      const diagRes = await fetch(`/api/green-claims/${currentDiag.id}`)
      const { data: diagData } = await diagRes.json()
      if (diagData?.diag) {
        setCurrentDiag(diagData.diag)
        setDiagnostics(prev => prev.map(d => d.id === currentDiag.id ? diagData.diag : d))
      }
    }
  }, [currentDiag])

  const handleDeleteAllegation = useCallback(async (id: string) => {
    if (!currentDiag) return
    await fetch(`/api/green-claims/${currentDiag.id}/allegations?allegation_id=${id}`, { method: 'DELETE' })
    setAllegations(prev => prev.filter(a => a.id !== id))
    const diagRes = await fetch(`/api/green-claims/${currentDiag.id}`)
    const { data: diagData } = await diagRes.json()
    if (diagData?.diag) {
      setCurrentDiag(diagData.diag)
      setDiagnostics(prev => prev.map(d => d.id === currentDiag.id ? diagData.diag : d))
    }
  }, [currentDiag])

  async function handleUpdateTitre(titre: string) {
    if (!currentDiag) return
    const res = await fetch(`/api/green-claims/${currentDiag.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titre }),
    })
    const { data } = await res.json()
    if (data) {
      setCurrentDiag(data)
      setDiagnostics(prev => prev.map(d => d.id === currentDiag.id ? data : d))
    }
  }

  function handleExport() {
    if (!currentDiag) return
    window.open(`/api/green-claims/${currentDiag.id}/export-excel`, '_blank')
  }

  // Header actions
  useEffect(() => {
    setHeaderActions(null)
    return () => setHeaderActions(null)
  }, [view, setHeaderActions])

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex overflow-x-auto gap-1 pb-1 border-b border-gray-200 dark:border-gray-700">
        {VIEWS.filter(v => v.id !== 'editeur' || currentDiag !== null).map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              view === v.id
                ? 'text-green-700 dark:text-green-400 border-b-2 border-green-700 dark:border-green-400 bg-green-50 dark:bg-green-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            <span>{v.icon}</span>
            <span>{v.id === 'editeur' && currentDiag ? currentDiag.titre : v.label}</span>
            {v.id === 'diagnostics' && diagnostics.length > 0 && (
              <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1 rounded-full">{diagnostics.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {view === 'presentation' && <PresentationView onNavigate={() => setView('diagnostics')} />}

      {view === 'diagnostics' && (
        <DiagnosticsListView
          org={org}
          year={year}
          diagnostics={diagnostics}
          loading={loadingDiag}
          onCreate={handleCreate}
          onOpen={openDiag}
          onDelete={handleDelete}
        />
      )}

      {view === 'editeur' && currentDiag && (
        loadingAlleg ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <EditeurView
            diag={currentDiag}
            allegations={allegations}
            onBack={() => setView('diagnostics')}
            onAddAllegation={handleAddAllegation}
            onUpdateAllegation={handleUpdateAllegation}
            onDeleteAllegation={handleDeleteAllegation}
            onExport={handleExport}
            onUpdateTitre={handleUpdateTitre}
          />
        )
      )}

      {view === 'correspondances' && <CorrespondancesView />}
    </div>
  )
}
