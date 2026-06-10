/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { RseContext } from '@/components/rse/RseAppShell'

// ─── Données statiques ────────────────────────────────────────────────────────

const TEMPLATES = {
  iirc: {
    label: 'Cadre <IR> IIRC',
    icon: '📐',
    color: '#1e3a5f',
    colorLight: '#eff6ff',
    badge: 'International Integrated Reporting Framework',
    description: "Structure votre communication extra-financière autour des 8 éléments de contenu du cadre <IR> de l'IIRC (VRF) et des 6 capitaux.",
    sections: [
      { id: 'contexte',     label: "Présentation de l'organisation",   icon: '🏢', guidance: "Décrivez la mission, la vision, les valeurs, les activités principales, les marchés, les produits et services, et l'environnement externe (réglementaire, macroéconomique, social, environnemental)." },
      { id: 'gouvernance',  label: 'Gouvernance',                       icon: '🏛️', guidance: "Expliquez comment la structure de gouvernance de l'organisation soutient sa capacité à créer de la valeur à court, moyen et long terme : composition du CA, comités, rémunération, culture." },
      { id: 'modele',       label: "Modèle d'affaires",                  icon: '⚙️', guidance: "Décrivez les intrants (capitaux utilisés), les activités clés, les extrants (produits/services) et les résultats (impacts sur les capitaux). Illustrez la chaîne de valeur." },
      { id: 'risques',      label: 'Risques et opportunités',           icon: '⚠️', guidance: "Identifiez les risques et opportunités spécifiques pouvant affecter la création de valeur. Précisez l'horizon temporel, la probabilité, l'impact et les mesures de réponse." },
      { id: 'strategie',    label: 'Stratégie et allocation des ressources', icon: '🎯', guidance: "Définissez les objectifs stratégiques, la feuille de route pour les atteindre, l'allocation des ressources entre les capitaux, et les avantages concurrentiels." },
      { id: 'performance',  label: 'Performance',                       icon: '📊', guidance: "Présentez les résultats par rapport aux objectifs stratégiques : KPI financiers et non-financiers, impacts sur les capitaux, comparaison avec les exercices précédents." },
      { id: 'perspectives', label: 'Perspectives',                      icon: '🔭', guidance: "Anticipez les défis et opportunités futurs, les incertitudes, et comment l'organisation se positionne pour créer de la valeur dans le temps." },
      { id: 'base',         label: 'Base de préparation',               icon: '📋', guidance: "Expliquez le périmètre de reporting, les principes de matérialité appliqués, les hypothèses et estimations, le cadre de référence utilisé, et les assurances obtenues." },
    ],
  },
  csrd: {
    label: 'CSRD / ESRS',
    icon: '🇪🇺',
    color: '#1d4ed8',
    colorLight: '#eff6ff',
    badge: 'Corporate Sustainability Reporting Directive',
    description: "Structure votre rapport de durabilité selon la directive européenne CSRD et les standards ESRS : Environnement (E1-E5), Social (S1-S4), Gouvernance (G1).",
    sections: [
      { id: 'csrd_general',  label: 'Déclaration de durabilité',        icon: '📜', guidance: "Présentez le périmètre de la déclaration, la double matérialité, les politiques de durabilité générales et les cibles à long terme." },
      { id: 'esrs_g1',       label: 'G1 — Gouvernance & Éthique',       icon: '🏛️', guidance: "Gouvernance d'entreprise, culture, gestion des risques, anticorruption (GRI 205), paiements politiques, concurrence loyale, relations fournisseurs (ESRS G1)." },
      { id: 'esrs_e1',       label: 'E1 — Changement climatique',       icon: '🌡️', guidance: "Émissions GES (Scopes 1, 2, 3), plan de transition, objectifs Net Zero, adaptation et résilience climatique, financement de la transition (ESRS E1)." },
      { id: 'esrs_e2',       label: 'E2 — Pollution',                   icon: '🏭', guidance: "Pollution de l'air, de l'eau, des sols, substances préoccupantes, microplastiques (ESRS E2)." },
      { id: 'esrs_e3',       label: 'E3 — Eau et ressources marines',   icon: '💧', guidance: "Consommation d'eau, stress hydrique, ressources marines, écosystèmes aquatiques (ESRS E3)." },
      { id: 'esrs_e4',       label: 'E4 — Biodiversité',                icon: '🌿', guidance: "Impacts sur la biodiversité et les écosystèmes, TNFD, espèces, surfaces (ESRS E4). Lien avec EUDR si applicable." },
      { id: 'esrs_e5',       label: 'E5 — Économie circulaire',         icon: '♻️', guidance: "Ressources et déchets, écoconception, circularité des flux, plastiques (ESRS E5)." },
      { id: 'esrs_s1',       label: 'S1 — Effectifs propres',           icon: '👥', guidance: "Conditions de travail, salaires équitables, temps de travail, santé-sécurité, formation, égalité, dialogue social (ESRS S1)." },
      { id: 'esrs_s2',       label: 'S2 — Chaîne de valeur',            icon: '🔗', guidance: "Travailleurs dans la chaîne de valeur : conditions, droits humains, travail des enfants (ESRS S2). Lien avec Devoir de Vigilance." },
      { id: 'esrs_s3',       label: 'S3 — Communautés affectées',       icon: '🏘️', guidance: "Impacts sur les communautés locales, peuples autochtones, accès aux ressources essentielles (ESRS S3)." },
      { id: 'esrs_s4',       label: 'S4 — Consommateurs & utilisateurs', icon: '🛒', guidance: "Sécurité des produits, information, vie privée, accès inclusif, pratiques commerciales responsables (ESRS S4)." },
    ],
  },
  gri: {
    label: 'GRI Standards',
    icon: '🌍',
    color: '#15803d',
    colorLight: '#f0fdf4',
    badge: 'Global Reporting Initiative Standards 2021',
    description: "Structure votre rapport de durabilité selon les GRI Standards 2021 : GRI 2 (Informations générales), GRI 200 Économique, GRI 300 Environnemental, GRI 400 Social.",
    sections: [
      { id: 'gri_2',   label: 'GRI 2 — Informations générales',    icon: '📋', guidance: "Activités et travailleurs, gouvernance, stratégie et politiques, pratiques et engagements, parties prenantes et matérialité (GRI 2 : General Disclosures 2021)." },
      { id: 'gri_205', label: 'GRI 205 — Anti-corruption',         icon: '⚖️', guidance: "Opérations évaluées pour risques de corruption, formation et communication, incidents confirmés (GRI 205). Compléter avec le diagnostic Sapin II." },
      { id: 'gri_206', label: 'GRI 206 — Concurrence déloyale',    icon: '🏆', guidance: "Procédures judiciaires liées à la concurrence déloyale, pratiques anticoncurrentielles (GRI 206)." },
      { id: 'gri_301', label: 'GRI 301 — Matières',                icon: '🪨', guidance: "Matières consommées (renouvelables et non-renouvelables), intrants recyclés, emballages (GRI 301)." },
      { id: 'gri_302', label: 'GRI 302 — Énergie',                 icon: '⚡', guidance: "Consommation énergétique, intensité énergétique, réductions, sources renouvelables (GRI 302)." },
      { id: 'gri_303', label: 'GRI 303 — Eau',                     icon: '💧', guidance: "Interactions avec l'eau, gestion de l'eau, prélèvements et rejets, consommation (GRI 303)." },
      { id: 'gri_304', label: 'GRI 304 — Biodiversité',            icon: '🌿', guidance: "Sites protégés impactés, impacts significatifs, habitats protégés, espèces menacées (GRI 304)." },
      { id: 'gri_305', label: 'GRI 305 — Émissions',               icon: '🌡️', guidance: "Émissions GES Scope 1, 2, 3, intensité, réductions, émissions de substances appauvrissant l'ozone (GRI 305)." },
      { id: 'gri_401', label: 'GRI 401 — Emploi',                  icon: '👷', guidance: "Embauches, turnover, congés parentaux (GRI 401). Conditions d'emploi, CDI/CDD, temps partiel." },
      { id: 'gri_403', label: 'GRI 403 — Santé et sécurité',       icon: '🦺', guidance: "Système de management S&ST, identification des dangers, accidents, maladies professionnelles, formation (GRI 403)." },
      { id: 'gri_404', label: 'GRI 404 — Formation',               icon: '🎓', guidance: "Programme de formation et développement professionnel, heures de formation par an, transitions de carrière (GRI 404)." },
    ],
  },
} as const

type TemplateKey = keyof typeof TEMPLATES

interface Rapport {
  id: string; titre: string; template: TemplateKey; statut: string
  sources: string[]; score_completion: number; created_at: string; updated_at: string
}

interface Section { id?: string; rapport_id: string; element_id: string; titre?: string; content?: string; data_imports?: ImportItem[]; ordre?: number }
interface ImportItem { source: string; label: string; score: number | null; route: string; color: string }
interface AvailableSource { score: number | null; statut: string | null; label: string; route: string; color: string }

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const STATUT_STYLES: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  finalise:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  publie:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}
const STATUT_LABELS: Record<string, string> = { brouillon: '📝 Brouillon', finalise: '✅ Finalisé', publie: '📢 Publié' }

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className={card('p-6 space-y-4')}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">📄</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rapport Intégré</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Construisez votre communication extra-financière selon les standards internationaux</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le <strong>Rapport Intégré</strong> regroupe vos informations financières et extra-financières dans un document unique et structuré.
          Il permet aux parties prenantes de comprendre comment votre organisation crée de la valeur sur le court, moyen et long terme.
          Importez directement les données de vos diagnostics RSE Sens&apos;ethO (ISO 26000, CSRD, EUDR, Sapin II…) dans chaque section.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: '📐', label: '3 modèles' },
            { icon: '🔗', label: 'Import CSRD / ISO / GRI' },
            { icon: '📄', label: 'Export Excel' },
          ].map(b => (
            <span key={b.label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* 3 Templates */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 3 modèles disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([key, tpl]) => (
            <div key={key} className={card('p-5')} style={{ borderLeft: `4px solid ${tpl.color}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{tpl.icon}</span>
                <span className="font-bold text-sm" style={{ color: tpl.color }}>{tpl.label}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{tpl.description}</p>
              <div className="text-xs font-medium" style={{ color: tpl.color }}>{tpl.sections.length} sections</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cadre <IR> IIRC — les 6 capitaux */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">💎 Les 6 capitaux du cadre &lt;IR&gt;</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: '💰', label: 'Financier',         desc: 'Fonds propres, dettes, flux de trésorerie' },
            { icon: '🏭', label: 'Manufacturier',     desc: 'Infrastructures, équipements, technologie' },
            { icon: '💡', label: 'Intellectuel',      desc: 'Brevets, marques, R&D, systèmes' },
            { icon: '👥', label: 'Humain',            desc: 'Compétences, motivation, loyauté, culture' },
            { icon: '🤝', label: 'Social & Relationnel', desc: 'Relations, communautés, réseaux, marque' },
            { icon: '🌿', label: 'Naturel',           desc: 'Eau, air, biodiversité, ressources naturelles' },
          ].map(c => (
            <div key={c.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{c.icon}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{c.label}</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Créer un rapport', 'Choisissez un modèle (IIRC, CSRD ou GRI) et nommez votre rapport. Chaque modèle génère automatiquement les sections structurées.'],
            ['2', 'Rédiger par section', 'Pour chaque section, rédigez le contenu narratif et importez les données chiffrées depuis vos diagnostics RSE réalisés sur Sens\'ethO.'],
            ['3', 'Importer les diagnostics', 'Le panneau "Sources RSE" affiche les scores disponibles pour votre organisation et l\'exercice sélectionné.'],
            ['4', 'Exporter', 'Exportez en Excel structuré (4 onglets) prêt pour votre rapport annuel ou votre commissaire aux comptes.'],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold">{n}</div>
              <div><span className="font-medium">{t}</span> — {d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Liste des rapports ───────────────────────────────────────────────────

function RapportsListView({
  org, year, rapports, loading, onCreate, onOpen, onDelete,
}: {
  org: { id: string; denomination: string } | null
  year: number
  rapports: Rapport[]
  loading: boolean
  onCreate: (titre: string, template: TemplateKey) => Promise<void>
  onOpen: (r: Rapport) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [titre, setTitre] = useState(`Rapport Intégré ${year}`)
  const [template, setTemplate] = useState<TemplateKey>('iirc')
  const [creating, setCreating] = useState(false)
  const [rapportToDelete, setRapportToDelete] = useState<Rapport | null>(null)

  useEffect(() => { setTitre(`Rapport Intégré ${year}`) }, [year])

  async function handleCreate() {
    if (!titre.trim()) return
    setCreating(true)
    await onCreate(titre, template)
    setCreating(false)
    setShowForm(false)
    setTitre(`Rapport Intégré ${year}`)
  }

  if (!org) {
    return (
      <div className={card('p-10 text-center')}>
        <div className="text-4xl mb-3">📂</div>
        <p className="text-gray-500 dark:text-gray-400">Sélectionnez une organisation pour accéder à vos rapports</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">{rapports.length} rapport{rapports.length > 1 ? 's' : ''}</span> — {org.denomination} · {year}
        </div>
        <button onClick={() => setShowForm(v => !v)} className={btnP('flex items-center gap-1.5')}>
          <span>+</span> Nouveau rapport
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className={card('p-5 space-y-4')}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Nouveau rapport</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Titre du rapport *</label>
              <input className={inputCls()} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Rapport Intégré 2025 — Contoso" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Modèle</label>
              <select className={inputCls()} value={template} onChange={e => setTemplate(e.target.value as TemplateKey)}>
                {(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([k, t]) => (
                  <option key={k} value={k}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Aperçu du template */}
          <div className="rounded-lg p-3 text-xs" style={{ background: TEMPLATES[template].colorLight, borderLeft: `3px solid ${TEMPLATES[template].color}` }}>
            <span className="font-medium" style={{ color: TEMPLATES[template].color }}>{TEMPLATES[template].badge}</span>
            <span className="text-gray-500 ml-2">— {TEMPLATES[template].sections.length} sections</span>
            <p className="text-gray-600 mt-0.5">{TEMPLATES[template].description}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button className={btnS()} onClick={() => setShowForm(false)}>Annuler</button>
            <button className={btnP()} onClick={handleCreate} disabled={creating || !titre.trim()}>
              {creating ? '…' : '✓ Créer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rapports.length === 0 ? (
        <div className={card('p-12 text-center')}>
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun rapport pour {org.denomination} en {year}</p>
          <p className="text-gray-400 text-xs mt-1">Cliquez sur &quot;Nouveau rapport&quot; pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rapports.map(r => {
            const tpl = TEMPLATES[r.template] ?? TEMPLATES.iirc
            return (
              <div key={r.id} className={card('p-5 hover:shadow-md transition-shadow cursor-pointer group')}
                onClick={() => onOpen(r)}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tpl.icon}</span>
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{r.titre}</div>
                      <div className="text-xs text-gray-500">{tpl.label} · {tpl.sections.length} sections</div>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setRapportToDelete(r) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm transition-all px-1">✕</button>
                </div>
                {/* Sources */}
                {(r.sources ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {r.sources.map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">{s.toUpperCase()}</span>
                    ))}
                  </div>
                )}
                {/* Complétion */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Complétion</span>
                    <span className="font-bold" style={{ color: tpl.color }}>{r.score_completion ?? 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${r.score_completion ?? 0}%`, background: tpl.color }} />
                  </div>
                </div>
                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLES[r.statut] ?? STATUT_STYLES.brouillon}`}>
                    {STATUT_LABELS[r.statut] ?? r.statut}
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(r.updated_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmModal
        open={!!rapportToDelete}
        title="Supprimer ce rapport ?"
        message={rapportToDelete ? `"${rapportToDelete.titre}" sera définitivement supprimé.` : undefined}
        onConfirm={() => { if (rapportToDelete) onDelete(rapportToDelete.id); setRapportToDelete(null) }}
        onCancel={() => setRapportToDelete(null)}
      />
    </div>
  )
}

// ─── Panneau d'import ─────────────────────────────────────────────────────────

function ImportPanel({
  sources, loadingSources, imported, onImport,
}: {
  sources: Record<string, AvailableSource>
  loadingSources: boolean
  imported: ImportItem[]
  onImport: (item: ImportItem) => void
}) {
  const available = Object.entries(sources).filter(([, s]) => s.score !== null)

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sources RSE disponibles</div>
      {loadingSources ? (
        <div className="text-xs text-gray-400 animate-pulse">Chargement des diagnostics…</div>
      ) : available.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">Aucun diagnostic réalisé pour {new Date().getFullYear()}. Complétez vos diagnostics RSE pour importer des données.</div>
      ) : (
        <div className="space-y-1.5">
          {available.map(([key, src]) => {
            const alreadyImported = imported.some(i => i.source === key)
            return (
              <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: src.color }} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{src.label}</div>
                    <div className="text-[10px] text-gray-400">Score : <span className="font-bold" style={{ color: src.color }}>{src.score}/100</span></div>
                  </div>
                </div>
                {alreadyImported ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 flex-shrink-0">✓ Importé</span>
                ) : (
                  <button onClick={() => onImport({ source: key, label: src.label, score: src.score, route: src.route, color: src.color })}
                    className="text-[10px] px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 font-medium flex-shrink-0 transition-colors">
                    Importer
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {imported.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-400 mb-1">Données intégrées dans cette section :</div>
          {imported.map(i => (
            <div key={i.source} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.color }} />
              {i.label} : <strong style={{ color: i.color }}>{i.score}/100</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Vue Éditeur de rapport ───────────────────────────────────────────────────

function EditeurView({
  rapport, sections, sources, loadingSources,
  onSectionSave, onUpdateStatut, onClose,
}: {
  rapport: Rapport
  sections: Record<string, Section>
  sources: Record<string, AvailableSource>
  loadingSources: boolean
  onSectionSave: (elementId: string, titre: string, content: string, dataImports: ImportItem[]) => Promise<void>
  onUpdateStatut: (statut: string) => void
  onClose: () => void
}) {
  const tpl = TEMPLATES[rapport.template] ?? TEMPLATES.iirc
  const [activeSection, setActiveSection] = useState(tpl.sections[0].id)
  const [sectionData, setSectionData] = useState<Record<string, { titre: string; content: string; dataImports: ImportItem[] }>>(() => {
    const init: Record<string, { titre: string; content: string; dataImports: ImportItem[] }> = {}
    tpl.sections.forEach(s => {
      init[s.id] = {
        titre: sections[s.id]?.titre ?? s.label,
        content: sections[s.id]?.content ?? '',
        dataImports: (sections[s.id]?.data_imports ?? []) as ImportItem[],
      }
    })
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentSectionDef = tpl.sections.find(s => s.id === activeSection)!
  const currentData = sectionData[activeSection] ?? { titre: currentSectionDef.label, content: '', dataImports: [] }

  function updateCurrentSection(patch: Partial<typeof currentData>) {
    setSectionData(prev => ({
      ...prev,
      [activeSection]: { ...prev[activeSection], ...patch }
    }))
    // Autosave after 1.2s
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(activeSection)
      const d = { ...sectionData[activeSection], ...patch }
      await onSectionSave(activeSection, d.titre, d.content, d.dataImports)
      setSaving(null)
      setSavedOk(activeSection)
      setTimeout(() => setSavedOk(null), 2000)
    }, 1200)
  }

  function handleImport(item: ImportItem) {
    const current = sectionData[activeSection]
    const alreadyIn = current.dataImports.some(i => i.source === item.source)
    if (alreadyIn) return
    const newImports = [...current.dataImports, item]
    // Append snippet to content
    const snippet = `\n\n📊 ${item.label} — Score : ${item.score}/100`
    updateCurrentSection({ dataImports: newImports, content: (current.content ?? '') + snippet })
  }

  function removeImport(source: string) {
    const current = sectionData[activeSection]
    updateCurrentSection({ dataImports: current.dataImports.filter(i => i.source !== source) })
  }

  const filledCount = tpl.sections.filter(s => (sectionData[s.id]?.content ?? '').trim().length > 0).length
  const totalCount = tpl.sections.length
  const completionPct = Math.round((filledCount / totalCount) * 100)

  return (
    <div className="space-y-4">
      {/* Header éditeur */}
      <div className={card('p-4')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">‹ Retour</button>
            <div>
              <div className="font-bold text-gray-900 dark:text-white">{rapport.titre}</div>
              <div className="text-xs text-gray-400">{tpl.icon} {tpl.label} · {filledCount}/{totalCount} sections rédigées · {completionPct}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              value={rapport.statut} onChange={e => onUpdateStatut(e.target.value)}>
              <option value="brouillon">📝 Brouillon</option>
              <option value="finalise">✅ Finalisé</option>
              <option value="publie">📢 Publié</option>
            </select>
          </div>
        </div>
        {/* Progress bar globale */}
        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, background: tpl.color }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-4">
        {/* Colonne gauche — navigation sections */}
        <div className={card('overflow-hidden')}>
          <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3">Sections</div>
          <div className="p-2 space-y-0.5">
            {tpl.sections.map((s, idx) => {
              const isActive = activeSection === s.id
              const isFilled = (sectionData[s.id]?.content ?? '').trim().length > 0
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${isActive ? 'bg-blue-700 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: isActive ? 'rgba(255,255,255,0.25)' : isFilled ? tpl.color + '22' : '#E5E7EB', color: isActive ? 'white' : isFilled ? tpl.color : '#9CA3AF' }}>
                    {isFilled ? '✓' : idx + 1}
                  </span>
                  <span className="truncate font-medium">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Colonne centrale — éditeur */}
        <div className="space-y-4">
          <div className={card('p-5 space-y-4')}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentSectionDef.icon}</span>
                <div>
                  <input
                    className="font-bold text-base text-gray-900 dark:text-white bg-transparent border-0 focus:outline-none focus:ring-0 w-full"
                    value={currentData.titre}
                    onChange={e => updateCurrentSection({ titre: e.target.value })}
                    placeholder={currentSectionDef.label}
                  />
                  <div className="text-xs text-gray-400">Section {tpl.sections.findIndex(s => s.id === activeSection) + 1} / {tpl.sections.length}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {saving === activeSection && <span className="animate-pulse">Enregistrement…</span>}
                {savedOk === activeSection && saving !== activeSection && <span className="text-green-600">✓ Sauvegardé</span>}
              </div>
            </div>

            {/* Guidance */}
            <div className="rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed" style={{ background: tpl.colorLight }}>
              <span className="font-medium" style={{ color: tpl.color }}>💡 Guide de rédaction — </span>
              {currentSectionDef.guidance}
            </div>

            <textarea
              value={currentData.content}
              onChange={e => updateCurrentSection({ content: e.target.value })}
              rows={14}
              placeholder={`Rédigez le contenu de la section "${currentSectionDef.label}"…\n\nConseils :\n• Soyez concis et factuel\n• Appuyez-vous sur des données chiffrées\n• Utilisez le panneau "Sources RSE" à droite pour importer vos scores de diagnostics`}
              className="w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 resize-y leading-relaxed"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{(currentData.content ?? '').split(/\s+/).filter(Boolean).length} mots</span>
              <span>{(currentData.content ?? '').length} caractères</span>
            </div>
          </div>

          {/* Données importées dans cette section */}
          {currentData.dataImports.length > 0 && (
            <div className={card('p-4')}>
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Données RSE intégrées</div>
              <div className="space-y-1.5">
                {currentData.dataImports.map(imp => (
                  <div key={imp.source} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: imp.color }} />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{imp.label}</span>
                      <span className="text-xs font-bold" style={{ color: imp.color }}>{imp.score}/100</span>
                    </div>
                    <button onClick={() => removeImport(imp.source)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite — import */}
        <div className={card('p-4')}>
          <ImportPanel
            sources={sources}
            loadingSources={loadingSources}
            imported={currentData.dataImports}
            onImport={handleImport}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Le Rapport Intégré s&apos;articule avec l&apos;ensemble des référentiels RSE. Mutualiser vos démarches permet de produire
          un rapport unique couvrant les exigences de l&apos;IIRC, de la CSRD et des GRI Standards.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: '📐', title: 'IIRC / VRF', sub: 'International Integrated Reporting Framework', route: null,
            desc: 'Cadre fondateur du Rapport Intégré — 6 capitaux, 8 éléments de contenu, matérialité et création de valeur à long terme.',
            links: ['Modèle IIRC disponible dans l\'éditeur', '8 sections pré-structurées', 'Guide de rédaction par section'] },
          { icon: '🇪🇺', title: 'CSRD / ESRS', sub: 'Corporate Sustainability Reporting Directive', route: null,
            desc: 'Directive européenne obligatoire pour les grandes entreprises. Le modèle CSRD de cette application couvre les 11 ESRS matériels.',
            links: ['Modèle CSRD disponible dans l\'éditeur', 'Import du diagnostic CSRD / ISO 26000', 'ESRS E1 à E5, S1 à S4, G1'] },
          { icon: '🌍', title: 'GRI Standards', sub: 'Global Reporting Initiative 2021', route: null,
            desc: 'Standards mondiaux de référence pour le reporting RSE. Le modèle GRI couvre GRI 2, 205, 301-305, 401, 403, 404.',
            links: ['Modèle GRI disponible dans l\'éditeur', 'Import des diagnostics ISO 26000 et Sapin II (GRI 205)'] },
          { icon: '🔍', title: 'ISO 26000', sub: 'Responsabilité Sociétale', route: '/rse/iso26000',
            desc: 'Les 7 questions centrales ISO 26000 alimentent directement les sections Gouvernance, Modèle d\'affaires et Performance.',
            links: ['Import du score global et par domaine', 'Correspondance avec les éléments IIRC'] },
          { icon: '⚖️', title: 'Loi Sapin II', sub: 'Anti-corruption', route: '/rse/sapin2',
            desc: 'Le programme anti-corruption Sapin II alimente la section GRI 205 et l\'élément Gouvernance du cadre IIRC.',
            links: ['Import du score Sapin II dans Gouvernance', 'Correspondance GRI 205 — ESRS G1'] },
          { icon: '🌳', title: 'EUDR', sub: 'Sans déforestation', route: '/rse/eudr',
            desc: 'Le diagnostic EUDR alimente les sections Environnement (ESRS E4, GRI 304) et Chaîne de valeur (ESRS S2).',
            links: ['Import du score EUDR dans E4 Biodiversité', 'GRI 304 — Biodiversité'] },
          { icon: '👁️', title: 'Devoir de Vigilance', sub: 'Loi n°2017-399', route: '/rse/vigilance',
            desc: 'Complémentaire à la CSRD (ESRS S2), le plan de vigilance alimente les sections Risques et Chaîne de valeur.',
            links: ['Import dans ESRS S2 — Chaîne de valeur', 'Section Risques et opportunités IIRC'] },
          { icon: '⭐', title: 'EcoVadis', sub: 'Notation RSE', route: '/rse/ecovadis',
            desc: 'La note EcoVadis (Environnement, Social, Éthique, Achats) est un indicateur synthétique utilisable dans la section Performance.',
            links: ['Import de la note globale EcoVadis', 'Section Performance — indicateurs ESG'] },
        ].map(item => (
          <div key={item.title} className={card('p-4')}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{item.title}</span>
                  {item.route && (
                    <a href={item.route} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 font-medium">↗ Ouvrir</a>
                  )}
                </div>
                <div className="text-xs text-gray-400 mb-1">{item.sub}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.desc}</p>
                <div className="space-y-0.5">
                  {item.links.map((l, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="text-blue-400 flex-shrink-0">▸</span>{l}
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

type MainView = 'presentation' | 'rapports' | 'editeur' | 'correspondances'

const VIEWS: { id: MainView; label: string; icon: string }[] = [
  { id: 'presentation',   label: 'Présentation',   icon: '📖' },
  { id: 'rapports',       label: 'Mes rapports',   icon: '📋' },
  { id: 'editeur',        label: 'Éditeur',         icon: '✏️' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function RapportIntegre({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions: setHeaderActions } = ctx

  const [view, setView] = useState<MainView>('presentation')
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [loadingRapports, setLoadingRapports] = useState(false)
  const [currentRapport, setCurrentRapport] = useState<Rapport | null>(null)
  const [sections, setSections] = useState<Record<string, Section>>({})
  const [sources, setSources] = useState<Record<string, AvailableSource>>({})
  const [loadingSources, setLoadingSources] = useState(false)

  // Charger la liste des rapports
  useEffect(() => {
    if (!org) { setRapports([]); return }
    setLoadingRapports(true)
    fetch(`/api/rapport-integre?org_id=${org.id}&annee=${year}`)
      .then(r => r.json())
      .then(({ data }) => setRapports(data ?? []))
      .finally(() => setLoadingRapports(false))
  }, [org, year])

  // Charger les sections et sources quand un rapport est ouvert
  useEffect(() => {
    if (!currentRapport) return
    // Sections
    fetch(`/api/rapport-integre/${currentRapport.id}`)
      .then(r => r.json())
      .then(({ data }) => {
        const map: Record<string, Section> = {}
        for (const s of (data?.sections ?? [])) map[s.element_id] = s
        setSections(map)
      })
    // Sources RSE
    setLoadingSources(true)
    fetch(`/api/rapport-integre/${currentRapport.id}/import`)
      .then(r => r.json())
      .then(({ data }) => setSources(data ?? {}))
      .finally(() => setLoadingSources(false))
  }, [currentRapport?.id])

  const handleCreate = useCallback(async (titre: string, template: TemplateKey) => {
    if (!org) return
    const res = await fetch('/api/rapport-integre', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: org.id, annee: year, titre, template }),
    })
    const { data } = await res.json()
    if (data) {
      setRapports(prev => [data, ...prev])
      openRapport(data)
    }
  }, [org, year])

  function openRapport(r: Rapport) {
    setCurrentRapport(r)
    setSections({})
    setSources({})
    setView('editeur')
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rapport-integre/${id}`, { method: 'DELETE' })
    setRapports(prev => prev.filter(r => r.id !== id))
    if (currentRapport?.id === id) { setCurrentRapport(null); setView('rapports') }
  }

  const handleSectionSave = useCallback(async (elementId: string, titre: string, content: string, dataImports: ImportItem[]) => {
    if (!currentRapport) return
    const res = await fetch(`/api/rapport-integre/${currentRapport.id}/sections`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        element_id: elementId, titre, content, data_imports: dataImports,
        ordre: (TEMPLATES[currentRapport.template]?.sections ?? []).findIndex(s => s.id === elementId),
      }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setSections(prev => ({ ...prev, [elementId]: data }))
      // Mettre à jour score_completion dans la liste
      const tpl = TEMPLATES[currentRapport.template]
      const allSectionIds = tpl?.sections.map(s => s.id) ?? []
      const updatedSections = { ...sections, [elementId]: data }
      const filled = allSectionIds.filter(id => (updatedSections[id]?.content ?? '').trim().length > 0).length
      const score = Math.round((filled / allSectionIds.length) * 100)
      setCurrentRapport(prev => prev ? { ...prev, score_completion: score } : null)
      setRapports(prev => prev.map(r => r.id === currentRapport.id ? { ...r, score_completion: score } : r))
    }
  }, [currentRapport, sections])

  async function handleUpdateStatut(statut: string) {
    if (!currentRapport) return
    const res = await fetch(`/api/rapport-integre/${currentRapport.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setCurrentRapport(data)
      setRapports(prev => prev.map(r => r.id === currentRapport.id ? data : r))
    }
  }

  const handleExportExcel = useCallback(async () => {
    if (!currentRapport) return
    const res = await fetch(`/api/rapport-integre/${currentRapport.id}/export-excel`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `RapportIntegre_${currentRapport.titre.replace(/\s+/g, '_')}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }, [currentRapport])

  // Header actions
  useEffect(() => {
    if (view !== 'editeur' || !currentRapport) { setHeaderActions(null); return }
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium transition-colors">
          ⬇ Excel
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors">
          📄 PDF
        </button>
      </div>
    )
    return () => setHeaderActions(null)
  }, [view, currentRapport, setHeaderActions, handleExportExcel])

  // Si on change d'org/year, fermer l'éditeur
  useEffect(() => {
    setCurrentRapport(null)
    if (view === 'editeur') setView('rapports')
  }, [org?.id, year])

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex overflow-x-auto gap-1 pb-1 border-b border-gray-200 dark:border-gray-700">
        {VIEWS.filter(v => v.id !== 'editeur' || currentRapport !== null).map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              view === v.id
                ? 'text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            <span>{v.icon}</span>
            <span>{v.id === 'editeur' && currentRapport ? currentRapport.titre : v.label}</span>
            {v.id === 'rapports' && rapports.length > 0 && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 rounded-full">{rapports.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {view === 'presentation' && <PresentationView />}

      {view === 'rapports' && (
        <RapportsListView
          org={org}
          year={year}
          rapports={rapports}
          loading={loadingRapports}
          onCreate={handleCreate}
          onOpen={openRapport}
          onDelete={handleDelete}
        />
      )}

      {view === 'editeur' && currentRapport && (
        <EditeurView
          rapport={currentRapport}
          sections={sections}
          sources={sources}
          loadingSources={loadingSources}
          onSectionSave={handleSectionSave}
          onUpdateStatut={handleUpdateStatut}
          onClose={() => setView('rapports')}
        />
      )}

      {view === 'correspondances' && <CorrespondancesView />}
    </div>
  )
}
