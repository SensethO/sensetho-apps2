'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import ViewTabs from '@/components/rse/ViewTabs'
import type { RseContext } from '@/components/rse/RseAppShell'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type VsmeStatus = 'non_evalue' | 'non_applicable' | 'non_renseigne' | 'en_cours' | 'renseigne'

interface VsmeResponse {
  id?: string
  org_id: string
  year: number
  datapoint_code: string
  status: VsmeStatus
  value_text: string | null
  value_number: number | null
  notes: string | null
}

type DatapointType = 'text' | 'number' | 'boolean'

interface Datapoint {
  code: string
  title: string
  description: string
  mandatory: boolean
  type: DatapointType
  unit?: string
}

interface VsmeSection {
  id: string
  title: string
  icon: string
  datapoints: Datapoint[]
}

// ─── Onglets ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'accueil',         label: 'Présentation',      icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',   icon: '📊' },
  { id: 'module-base',     label: 'Module de Base',    icon: '🌿' },
  { id: 'module-complet',  label: 'Module Complet',    icon: '🏆' },
  { id: 'correspondances', label: 'Correspondances',   icon: '🔗' },
] as const
type View = typeof TABS[number]['id']

// ─── Données Module de Base ───────────────────────────────────────────────────

const BASE_SECTIONS: VsmeSection[] = [
  {
    id: 'B1',
    title: 'B1 — Informations générales',
    icon: '🏢',
    datapoints: [
      { code: 'B1-1', title: 'Description du modèle d\'affaires', description: 'Décrire les activités principales, les marchés servis et la proposition de valeur.', mandatory: true, type: 'text' },
      { code: 'B1-2', title: 'Secteur d\'activité (code NACE)', description: 'Code NACE de l\'activité principale de l\'organisation.', mandatory: true, type: 'text' },
      { code: 'B1-3', title: 'Effectif total (ETP)', description: 'Nombre d\'employés en équivalents temps plein.', mandatory: true, type: 'number', unit: 'ETP' },
      { code: 'B1-4', title: 'Chiffre d\'affaires annuel', description: 'Chiffre d\'affaires total de l\'exercice en euros.', mandatory: true, type: 'number', unit: '€' },
      { code: 'B1-5', title: 'Pays d\'opération principaux', description: 'Liste des pays où l\'organisation exerce ses activités principales.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'B2-E1',
    title: 'B2-E1 — Énergie & Émissions GES',
    icon: '⚡',
    datapoints: [
      { code: 'B2-E1-1', title: 'Consommation d\'énergie totale', description: 'Consommation totale d\'énergie de l\'organisation en MWh.', mandatory: true, type: 'number', unit: 'MWh' },
      { code: 'B2-E1-2', title: 'Part d\'énergies renouvelables', description: 'Pourcentage de l\'énergie provenant de sources renouvelables.', mandatory: false, type: 'number', unit: '%' },
      { code: 'B2-E1-3', title: 'Émissions GES Scope 1', description: 'Émissions directes de gaz à effet de serre (combustion, procédés, fugitives).', mandatory: true, type: 'number', unit: 'tCO2e' },
      { code: 'B2-E1-4', title: 'Émissions GES Scope 2 (market-based)', description: 'Émissions indirectes liées à la consommation d\'énergie achetée.', mandatory: true, type: 'number', unit: 'tCO2e' },
      { code: 'B2-E1-5', title: 'Émissions GES Scope 3 (total estimé)', description: 'Estimation des émissions indirectes dans la chaîne de valeur.', mandatory: false, type: 'number', unit: 'tCO2e' },
      { code: 'B2-E1-6', title: 'Intensité carbone', description: 'Rapport entre les émissions GES totales et le chiffre d\'affaires.', mandatory: false, type: 'number', unit: 'tCO2e/M€ CA' },
    ],
  },
  {
    id: 'B2-E2',
    title: 'B2-E2 — Eau',
    icon: '💧',
    datapoints: [
      { code: 'B2-E2-1', title: 'Consommation d\'eau totale', description: 'Volume total d\'eau prélevé et consommé par l\'organisation.', mandatory: false, type: 'number', unit: 'm³' },
      { code: 'B2-E2-2', title: 'Activités en zones de stress hydrique', description: 'Présence d\'activités dans des zones géographiques exposées au stress hydrique.', mandatory: false, type: 'boolean' },
      { code: 'B2-E2-3', title: 'Volume d\'eau rejeté (traité)', description: 'Volume d\'eau rejetée après traitement dans les milieux naturels.', mandatory: false, type: 'number', unit: 'm³' },
    ],
  },
  {
    id: 'B2-E3',
    title: 'B2-E3 — Biodiversité & Sol',
    icon: '🌿',
    datapoints: [
      { code: 'B2-E3-1', title: 'Surface de terres exploitées', description: 'Surface totale de terres utilisées par les activités de l\'organisation.', mandatory: false, type: 'number', unit: 'ha' },
      { code: 'B2-E3-2', title: 'Sites en zones sensibles (biodiversité)', description: 'Présence de sites d\'exploitation dans ou à proximité de zones de biodiversité sensibles.', mandatory: false, type: 'boolean' },
      { code: 'B2-E3-3', title: 'Actions de préservation de la biodiversité', description: 'Description des mesures prises pour préserver et restaurer la biodiversité.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'B2-E4',
    title: 'B2-E4 — Déchets & Économie circulaire',
    icon: '♻️',
    datapoints: [
      { code: 'B2-E4-1', title: 'Quantité totale de déchets produits', description: 'Masse totale de déchets générés par les activités de l\'organisation.', mandatory: false, type: 'number', unit: 'tonnes' },
      { code: 'B2-E4-2', title: 'Déchets dangereux', description: 'Masse de déchets classifiés comme dangereux selon la réglementation.', mandatory: false, type: 'number', unit: 'tonnes' },
      { code: 'B2-E4-3', title: 'Taux de valorisation / recyclage', description: 'Part des déchets effectivement valorisés ou recyclés.', mandatory: false, type: 'number', unit: '%' },
      { code: 'B2-E4-4', title: 'Initiatives d\'économie circulaire', description: 'Description des actions engagées en matière d\'économie circulaire.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'B3-S1',
    title: 'B3-S1 — Main-d\'œuvre & Conditions de travail',
    icon: '👥',
    datapoints: [
      { code: 'B3-S1-1', title: 'Répartition par genre', description: 'Répartition du personnel par genre (femmes / hommes / autres).', mandatory: true, type: 'text' },
      { code: 'B3-S1-2', title: 'Répartition CDI / CDD / intérim', description: 'Répartition du personnel selon le type de contrat.', mandatory: true, type: 'text' },
      { code: 'B3-S1-3', title: 'Taux d\'accidents du travail (LTIFR)', description: 'Lost Time Injury Frequency Rate — nombre d\'accidents avec arrêt par million d\'heures travaillées.', mandatory: true, type: 'number', unit: 'LTIFR' },
      { code: 'B3-S1-4', title: 'Nombre de décès liés au travail', description: 'Nombre de décès survenus dans le cadre du travail.', mandatory: true, type: 'number', unit: 'décès' },
      { code: 'B3-S1-5', title: 'Heures de formation par salarié', description: 'Nombre moyen d\'heures de formation par salarié et par an.', mandatory: false, type: 'number', unit: 'h/salarié/an' },
      { code: 'B3-S1-6', title: 'Écart de rémunération femmes/hommes', description: 'Différence de rémunération moyenne entre les femmes et les hommes.', mandatory: false, type: 'number', unit: '%' },
      { code: 'B3-S1-7', title: 'Taux de rotation du personnel', description: 'Part des employés ayant quitté l\'organisation sur l\'exercice.', mandatory: false, type: 'number', unit: '%' },
      { code: 'B3-S1-8', title: 'Politique anti-travail forcé et travail des enfants', description: 'Existence d\'une politique formelle interdisant le travail forcé et le travail des enfants.', mandatory: true, type: 'boolean' },
      { code: 'B3-S1-9', title: 'Liberté d\'association et négociation collective', description: 'Respect et promotion de la liberté d\'association syndicale et de la négociation collective.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'B3-S2',
    title: 'B3-S2 — Communautés & Chaîne de valeur',
    icon: '🤝',
    datapoints: [
      { code: 'B3-S2-1', title: 'Évaluation des fournisseurs sur critères sociaux', description: 'Processus d\'évaluation des fournisseurs selon des critères sociaux et droits humains.', mandatory: false, type: 'boolean' },
      { code: 'B3-S2-2', title: 'Impacts sur les communautés locales', description: 'Description des impacts (positifs et négatifs) des activités sur les communautés locales.', mandatory: false, type: 'text' },
      { code: 'B3-S2-3', title: 'Mécanisme de réclamation (stakeholders)', description: 'Existence d\'un mécanisme de réclamation accessible aux parties prenantes.', mandatory: false, type: 'boolean' },
    ],
  },
  {
    id: 'B4',
    title: 'B4 — Gouvernance & Éthique',
    icon: '⚖️',
    datapoints: [
      { code: 'B4-G1-1', title: 'Code de conduite / charte éthique', description: 'Existence d\'un code de conduite ou d\'une charte éthique formalisée.', mandatory: true, type: 'boolean' },
      { code: 'B4-G1-2', title: 'Politique anti-corruption et anti-fraude', description: 'Existence d\'une politique formelle de prévention de la corruption et de la fraude.', mandatory: true, type: 'boolean' },
      { code: 'B4-G1-3', title: 'Cas de corruption identifiés', description: 'Nombre de cas de corruption ou de fraude identifiés durant l\'exercice.', mandatory: false, type: 'number', unit: 'cas' },
      { code: 'B4-G2-1', title: 'Responsable RSE / durabilité désigné', description: 'Existence d\'un responsable RSE ou durabilité formellement désigné.', mandatory: false, type: 'boolean' },
      { code: 'B4-G2-2', title: 'Objectifs RSE définis et suivis', description: 'Existence d\'objectifs RSE formalisés et d\'un suivi régulier.', mandatory: false, type: 'boolean' },
      { code: 'B4-G2-3', title: 'Rapport / déclaration de durabilité publié', description: 'Publication d\'un rapport ou d\'une déclaration de durabilité.', mandatory: false, type: 'boolean' },
      { code: 'B4-G2-4', title: 'Protection des lanceurs d\'alerte', description: 'Existence d\'un dispositif de protection des lanceurs d\'alerte.', mandatory: false, type: 'boolean' },
    ],
  },
]

// ─── Données Module Complet ───────────────────────────────────────────────────

const COMPLET_SECTIONS: VsmeSection[] = [
  {
    id: 'C1',
    title: 'C1 — Analyse de matérialité',
    icon: '🎯',
    datapoints: [
      { code: 'C1-1', title: 'Parties prenantes identifiées', description: 'Liste et description des parties prenantes identifiées dans le processus de matérialité.', mandatory: true, type: 'text' },
      { code: 'C1-2', title: 'Processus de consultation des parties prenantes', description: 'Description du processus d\'engagement et de consultation des parties prenantes.', mandatory: true, type: 'text' },
      { code: 'C1-3', title: 'Enjeux ESG matériels identifiés', description: 'Liste des enjeux environnementaux, sociaux et de gouvernance jugés matériels.', mandatory: true, type: 'text' },
      { code: 'C1-4', title: 'Seuil de matérialité retenu', description: 'Critères et seuils utilisés pour déterminer la matérialité des enjeux.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'C2',
    title: 'C2 — Stratégie & Objectifs ESG',
    icon: '🏆',
    datapoints: [
      { code: 'C2-1', title: 'Stratégie de durabilité globale', description: 'Description de la stratégie de durabilité de l\'organisation et de son intégration dans la stratégie globale.', mandatory: true, type: 'text' },
      { code: 'C2-2', title: 'Objectif de réduction des émissions GES', description: 'Objectifs chiffrés et calendriers de réduction des émissions de gaz à effet de serre.', mandatory: false, type: 'text' },
      { code: 'C2-3', title: 'Plan de transition climatique', description: 'Plan d\'action pour la transition vers une économie bas-carbone.', mandatory: false, type: 'text' },
      { code: 'C2-4', title: 'Objectifs sociaux formalisés', description: 'Objectifs formalisés en matière sociale (emploi, formation, diversité, droits humains, etc.).', mandatory: false, type: 'text' },
      { code: 'C2-5', title: 'Objectifs de gouvernance formalisés', description: 'Objectifs formalisés en matière de gouvernance et d\'éthique des affaires.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'C3',
    title: 'C3 — Environnement approfondi',
    icon: '🌍',
    datapoints: [
      { code: 'C3-1', title: 'Scope 3 détaillé par catégorie', description: 'Émissions Scope 3 détaillées par catégorie selon le GHG Protocol.', mandatory: false, type: 'text' },
      { code: 'C3-2', title: 'Risques climatiques physiques identifiés', description: 'Identification et évaluation des risques climatiques physiques pour l\'organisation.', mandatory: false, type: 'text' },
      { code: 'C3-3', title: 'Politique de gestion de l\'eau', description: 'Politique formalisée de gestion responsable de l\'eau.', mandatory: false, type: 'text' },
      { code: 'C3-4', title: 'Stratégie biodiversité et plan d\'action', description: 'Stratégie et plan d\'action pour la préservation de la biodiversité.', mandatory: false, type: 'text' },
      { code: 'C3-5', title: 'Politique matières premières & Économie circulaire', description: 'Politique d\'approvisionnement responsable en matières premières et stratégie d\'économie circulaire.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'C4',
    title: 'C4 — Social approfondi',
    icon: '🫂',
    datapoints: [
      { code: 'C4-1', title: 'Politique des droits humains', description: 'Politique formalisée sur le respect des droits humains dans les activités et la chaîne de valeur.', mandatory: false, type: 'text' },
      { code: 'C4-2', title: 'Audit social fournisseurs', description: 'Programme d\'audit social des fournisseurs et résultats.', mandatory: false, type: 'text' },
      { code: 'C4-3', title: 'Politique Diversité, Équité & Inclusion (DEI)', description: 'Politique formalisée en matière de diversité, équité et inclusion.', mandatory: false, type: 'text' },
      { code: 'C4-4', title: 'Dialogue social et relations syndicales', description: 'Description des mécanismes de dialogue social et des relations avec les représentants du personnel.', mandatory: false, type: 'text' },
      { code: 'C4-5', title: 'Engagement communautaire et mécénat', description: 'Actions d\'engagement auprès des communautés locales et investissements sociaux.', mandatory: false, type: 'text' },
    ],
  },
  {
    id: 'C5',
    title: 'C5 — Gouvernance approfondie',
    icon: '🏛️',
    datapoints: [
      { code: 'C5-1', title: 'Structure de gouvernance durabilité', description: 'Description de la structure de gouvernance dédiée à la durabilité (comité, responsabilités, etc.).', mandatory: false, type: 'text' },
      { code: 'C5-2', title: 'Rémunération variable liée à la performance ESG', description: 'Lien entre la rémunération variable des dirigeants et les objectifs de performance ESG.', mandatory: false, type: 'text' },
      { code: 'C5-3', title: 'Transparence fiscale', description: 'Informations sur la politique fiscale et les contributions fiscales de l\'organisation.', mandatory: false, type: 'text' },
      { code: 'C5-4', title: 'Cybersécurité et protection des données', description: 'Politique et mesures de cybersécurité et de protection des données personnelles.', mandatory: false, type: 'text' },
    ],
  },
]

// ─── Correspondances ──────────────────────────────────────────────────────────

const CORRESPONDANCES = [
  { section: 'B1', label: 'Informations générales', esrs: 'ESRS 2 BP-1, BP-2', gri: 'GRI 2-1, 2-2, 2-6', iso: '§ 7.5' },
  { section: 'B2-E1', label: 'Énergie & GES', esrs: 'ESRS E1-4, E1-5, E1-6', gri: 'GRI 302, 305', iso: '§ 6.5.5' },
  { section: 'B2-E2', label: 'Eau', esrs: 'ESRS E3-1, E3-4', gri: 'GRI 303', iso: '§ 6.5.4' },
  { section: 'B2-E3', label: 'Biodiversité & Sol', esrs: 'ESRS E4-1, E4-5', gri: 'GRI 304', iso: '§ 6.5.6' },
  { section: 'B2-E4', label: 'Déchets', esrs: 'ESRS E5-1, E5-5', gri: 'GRI 306', iso: '§ 6.5.3' },
  { section: 'B3-S1', label: 'Main-d\'œuvre', esrs: 'ESRS S1-1, S1-7, S1-14, S1-15', gri: 'GRI 401, 403, 405', iso: '§ 6.4' },
  { section: 'B3-S2', label: 'Communautés & Chaîne de valeur', esrs: 'ESRS S2-1, S3-1, S4-1', gri: 'GRI 204, 413', iso: '§ 6.3, § 6.8' },
  { section: 'B4', label: 'Gouvernance & Éthique', esrs: 'ESRS G1-1, G1-3, G1-4', gri: 'GRI 2-9, 205, 206', iso: '§ 6.6.2, § 6.6.3' },
  { section: 'C1', label: 'Matérialité', esrs: 'ESRS 2 IRO-1, SBM-3', gri: 'GRI 3-1, 3-2', iso: '§ 5.3' },
  { section: 'C2', label: 'Stratégie ESG', esrs: 'ESRS 2 SBM-1, SBM-2', gri: 'GRI 2-22, 3-3', iso: '§ 6.2' },
  { section: 'C3', label: 'Environnement approfondi', esrs: 'ESRS E1, E2, E3, E4, E5', gri: 'GRI 302-306', iso: '§ 6.5' },
  { section: 'C4', label: 'Social approfondi', esrs: 'ESRS S1, S2, S3, S4', gri: 'GRI 401-413', iso: '§ 6.3, § 6.4, § 6.8' },
  { section: 'C5', label: 'Gouvernance approfondie', esrs: 'ESRS G1, ESRS 2 GOV-1 à GOV-5', gri: 'GRI 2-9 à 2-29', iso: '§ 6.2, § 6.6' },
]

// ─── Statut labels et styles ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<VsmeStatus, { label: string; bg: string; color: string }> = {
  non_evalue:     { label: 'Non évalué',   bg: 'var(--bg)',              color: 'var(--text-muted)' },
  non_applicable: { label: 'Non applicable', bg: '#f1f5f9',              color: '#64748b' },
  non_renseigne:  { label: 'Non renseigné', bg: '#fef9c3',               color: '#92400e' },
  en_cours:       { label: 'En cours',     bg: '#fef3c7',                color: '#d97706' },
  renseigne:      { label: 'Renseigné',    bg: '#dcfce7',                color: '#16a34a' },
}

// ─── Carte Datapoint ──────────────────────────────────────────────────────────

function DatapointCard({
  dp,
  response,
  onUpdate,
}: {
  dp: Datapoint
  response: VsmeResponse | undefined
  onUpdate: (code: string, patch: Partial<VsmeResponse>) => void
}) {
  const status: VsmeStatus = response?.status ?? 'non_evalue'
  const [notesOpen, setNotesOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sc = STATUS_CONFIG[status]
  const showInput = status === 'en_cours' || status === 'renseigne'

  function setStatus(s: VsmeStatus) {
    onUpdate(dp.code, { status: s })
  }

  function handleTextChange(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate(dp.code, { value_text: val || null })
    }, 600)
  }

  function handleNumberChange(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate(dp.code, { value_number: val ? parseFloat(val) : null })
    }, 600)
  }

  function handleNotesChange(val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate(dp.code, { notes: val || null })
    }, 600)
  }

  const ALL_STATUSES: VsmeStatus[] = ['non_evalue', 'non_applicable', 'non_renseigne', 'en_cours', 'renseigne']

  return (
    <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono" style={{ color: 'var(--accent, #6366f1)' }}>{dp.code}</span>
            {dp.mandatory && (
              <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                Obligatoire
              </span>
            )}
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>{dp.title}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{dp.description}</div>
        </div>
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: sc.bg, color: sc.color }}
        >
          {sc.label}
        </span>
      </div>

      {/* Boutons de statut */}
      <div className="flex flex-wrap gap-1 mb-3">
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="px-2.5 py-1 rounded text-xs font-medium border transition-all"
              style={status === s
                ? s === 'renseigne'
                  ? { backgroundColor: '#16a34a', color: '#fff', borderColor: '#16a34a' }
                  : s === 'en_cours'
                    ? { backgroundColor: '#d97706', color: '#fff', borderColor: '#d97706' }
                    : { backgroundColor: 'var(--accent, #6366f1)', color: '#fff', borderColor: 'var(--accent, #6366f1)' }
                : { backgroundColor: 'var(--bg)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
              }
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Zone de saisie */}
      {showInput && (
        <div className="space-y-2">
          {dp.type === 'text' && (
            <textarea
              defaultValue={response?.value_text ?? ''}
              onChange={e => handleTextChange(e.target.value)}
              rows={2}
              placeholder="Saisir la valeur…"
              className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          )}
          {dp.type === 'number' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={response?.value_number ?? ''}
                onChange={e => handleNumberChange(e.target.value)}
                placeholder="0"
                className="w-36 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              {dp.unit && (
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{dp.unit}</span>
              )}
            </div>
          )}
          {dp.type === 'boolean' && (
            <div className="flex gap-2">
              {['Oui', 'Non', 'En cours'].map(opt => (
                <button
                  key={opt}
                  onClick={() => onUpdate(dp.code, { value_text: opt })}
                  className="px-3 py-1.5 text-xs font-medium border rounded-lg transition-all"
                  style={(response?.value_text ?? '') === opt
                    ? { backgroundColor: 'var(--accent, #6366f1)', color: '#fff', borderColor: 'var(--accent, #6366f1)' }
                    : { backgroundColor: 'var(--bg)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes et documents */}
      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setNotesOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>📄</span>
          <span>Notes et documents</span>
          {response?.notes && !notesOpen && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>✎</span>
          )}
          <span className="ml-0.5">{notesOpen ? '▲' : '▼'}</span>
        </button>
        {notesOpen && (
          <div className="mt-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Notes internes, sources &amp; commentaires
            </div>
            <textarea
              defaultValue={response?.notes ?? ''}
              onChange={e => handleNotesChange(e.target.value)}
              rows={3}
              placeholder="Rédigez vos notes, sources et commentaires sur ce datapoint…"
              className="w-full px-3 py-2 text-xs border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section collapsible ──────────────────────────────────────────────────────

function SectionBlock({
  section,
  responses,
  onUpdate,
}: {
  section: VsmeSection
  responses: Map<string, VsmeResponse>
  onUpdate: (code: string, patch: Partial<VsmeResponse>) => void
}) {
  const [open, setOpen] = useState(true)

  const renseignes = section.datapoints.filter(dp => responses.get(dp.code)?.status === 'renseigne').length
  const total = section.datapoints.length

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{section.icon}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{section.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{renseignes}/{total} renseignés</span>
          <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: 'var(--border)' }}>
          {section.datapoints.map(dp => (
            <DatapointCard
              key={dp.code}
              dp={dp}
              response={responses.get(dp.code)}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Radar Chart ─────────────────────────────────────────────────────────────

function RadarChart({ responses }: { responses: Map<string, VsmeResponse> }) {
  const axes = BASE_SECTIONS.map(s => {
    const total = s.datapoints.length
    const done = s.datapoints.filter(dp => responses.get(dp.code)?.status === 'renseigne').length
    return {
      id: s.id,
      icon: s.icon,
      label: s.title.replace(/^B[\d-\w]+ — /, ''),
      pct: total > 0 ? done / total : 0,
    }
  })

  const N = axes.length
  const cx = 200, cy = 195, r = 130

  function polarToXY(i: number, radius: number) {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2
    return {
      x: +(cx + radius * Math.cos(angle)).toFixed(1),
      y: +(cy + radius * Math.sin(angle)).toFixed(1),
    }
  }

  const levels = [0.25, 0.5, 0.75, 1.0]

  const dataPolygon = axes.map((a, i) => {
    const { x, y } = polarToXY(i, r * Math.max(a.pct, 0.03))
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox="0 0 400 390" className="w-full" style={{ maxHeight: 320 }}>
        {/* Toile */}
        {levels.map(level => {
          const pts = axes.map((_, i) => {
            const { x, y } = polarToXY(i, r * level)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="var(--border)"
              strokeWidth={level === 1 ? '1.5' : '0.8'}
            />
          )
        })}

        {/* Axes */}
        {axes.map((_, i) => {
          const { x, y } = polarToXY(i, r)
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
          )
        })}

        {/* Zone de données */}
        <polygon
          points={dataPolygon}
          fill="#16a34a22"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Points de données */}
        {axes.map((a, i) => {
          const { x, y } = polarToXY(i, r * Math.max(a.pct, 0.03))
          return (
            <circle key={i} cx={x} cy={y} r="4.5"
              fill="#16a34a" stroke="white" strokeWidth="1.5" />
          )
        })}

        {/* Labels % sur le premier axe */}
        {levels.map(level => {
          const { x, y } = polarToXY(0, r * level)
          return (
            <text key={level} x={x} y={y - 5} textAnchor="middle"
              fontSize="9" fill="var(--text-muted)" fontWeight="500">
              {Math.round(level * 100)}%
            </text>
          )
        })}

        {/* Labels axes */}
        {axes.map((a, i) => {
          const { x, y } = polarToXY(i, r + 28)
          const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'
          return (
            <text key={i} x={x} y={y} textAnchor={anchor}
              dominantBaseline="middle" fontSize="11"
              fill="var(--text-muted)" fontWeight="600">
              {a.icon} {a.id}
            </text>
          )
        })}
      </svg>

      {/* Légende */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
        {axes.map(a => (
          <div key={a.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{a.icon}</span>
            <span className="font-mono font-bold text-xs" style={{ color: 'var(--accent, #6366f1)' }}>{a.id}</span>
            <span className="truncate flex-1">{a.label}</span>
            <span className="font-semibold shrink-0" style={{ color: '#16a34a' }}>
              {Math.round(a.pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tutoriel ─────────────────────────────────────────────────────────────────

const TUTORIAL_KEY = 'vsme_tutorial_seen'

const TUTORIAL_STEPS = [
  {
    icon: '🌱',
    title: 'Bienvenue sur VSME EFRAG',
    content: "Le VSME (Voluntary Sustainability Reporting Standard) est un standard de reporting de durabilité développé par l'EFRAG pour les PME non cotées. Il vous permet de structurer et valoriser votre démarche RSE de façon alignée avec les exigences européennes CSRD.",
  },
  {
    icon: '🌿',
    title: 'Module de Base — 40 datapoints',
    content: "Le module de base est le point de départ recommandé. Il couvre les 8 sections essentielles : informations générales, énergie & GES, eau, biodiversité & sol, déchets & économie circulaire, main-d'œuvre, communautés et gouvernance.",
  },
  {
    icon: '🏆',
    title: 'Module Complet — 23 datapoints',
    content: "Le module complet est optionnel. Il approfondit l'analyse avec : l'analyse de matérialité, la stratégie ESG, l'environnement approfondi, le volet social approfondi et la gouvernance avancée. Idéal pour les PME souhaitant aller au-delà du socle.",
  },
  {
    icon: '🏷️',
    title: 'Les 5 statuts de saisie',
    content: "• Non évalué — État initial, pas encore traité.\n• Non applicable — Ce datapoint ne concerne pas votre activité.\n• Non renseigné — Applicable mais donnée non disponible.\n• En cours — Collecte en cours, valeur partielle saisie.\n• Renseigné — Donnée complète et validée ✅",
  },
  {
    icon: '📈',
    title: 'Tableau de bord & Radar',
    content: "Le tableau de bord vous donne une vue d'ensemble : un radar de maturité par section, des barres de progression et la répartition des statuts. Revenez-y régulièrement pour suivre votre avancée et identifier les zones à compléter en priorité.",
  },
  {
    icon: '📄',
    title: 'Notes et documents',
    content: "Chaque datapoint dispose d'un module \"Notes et documents\" (📄) dans lequel vous pouvez consigner vos sources, commentaires internes et observations. Ces notes sont sauvegardées automatiquement et restent visibles à votre prochaine visite.",
  },
]

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const total = TUTORIAL_STEPS.length
  const current = TUTORIAL_STEPS[step]

  function close() {
    try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="relative rounded-2xl border shadow-2xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Close */}
        <button
          onClick={close}
          className="absolute right-4 top-4 text-xl hover:opacity-60 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          ×
        </button>

        {/* Contenu */}
        <div className="p-8 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <div className="text-sm font-bold mb-1" style={{ color: 'var(--accent, #6366f1)' }}>
            Étape {step + 1} / {total}
          </div>
          <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text)' }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
            {current.content}
          </p>
        </div>

        {/* Pastilles progression */}
        <div className="flex justify-center gap-1.5 pb-2">
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                backgroundColor: i === step ? 'var(--accent, #6366f1)' : 'var(--border)',
              }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2 gap-3">
          <button
            onClick={() => setStep(v => Math.max(0, v - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-medium border rounded-lg disabled:opacity-30 transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}
          >
            ← Précédent
          </button>
          {step < total - 1 ? (
            <button
              onClick={() => setStep(v => v + 1)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent, #6366f1)' }}
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={close}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#16a34a' }}
            >
              🚀 {"C'est parti !"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function AccueilView({
  hasOrg,
  onNavigate,
  onOpenTutorial,
}: {
  hasOrg: boolean
  onNavigate: (v: View) => void
  onOpenTutorial: () => void
}) {
  const stats = [
    { label: 'Datapoints Module de Base', value: '40', icon: '📋', color: '#16a34a' },
    { label: 'Datapoints Module Complet', value: '23', icon: '🏆', color: '#7c3aed' },
    { label: 'Standards alignés', value: '3', icon: '🔗', color: '#2563eb' },
    { label: 'Piliers E·S·G', value: '3', icon: '⚖️', color: '#059669' },
  ]

  const modules = [
    {
      icon: '🌿', title: 'Module de Base', subtitle: '40 datapoints · Énergie, eau, déchets, social, gouvernance',
      desc: 'Le module socle VSME couvrant les informations de durabilité essentielles pour toute PME. Adapté aux premières démarches de reporting.',
      action: () => onNavigate('module-base'), color: '#16a34a',
    },
    {
      icon: '🏆', title: 'Module Complet', subtitle: '23 datapoints · Matérialité, stratégie ESG, politiques approfondies',
      desc: 'Extension optionnelle pour les PME souhaitant aller plus loin : analyse de matérialité, stratégie ESG et politiques sectorielles détaillées.',
      action: () => onNavigate('module-complet'), color: '#7c3aed',
    },
    {
      icon: '🔗', title: 'Correspondances', subtitle: 'Alignements CSRD/ESRS, GRI 2021 et ISO 26000',
      desc: 'Tableau de correspondance entre les datapoints VSME et les référentiels CSRD/ESRS, GRI 2021 et ISO 26000.',
      action: () => onNavigate('correspondances'), color: '#2563eb',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #16a34a 0%, #2563eb 50%, #7c3aed 100%)' }}
      >
        <div className="text-5xl mb-3">🌱</div>
        <h1 className="text-2xl font-bold mb-2">VSME EFRAG — Standard PME</h1>
        <p className="text-sm opacity-90 max-w-2xl mb-4">
          Voluntary Sustainability Reporting Standard — module de base et module complet pour PME non cotées.
          Aligné CSRD/ESRS, GRI 2021 et ISO 26000.
        </p>
        <button
          onClick={onOpenTutorial}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}
        >
          <span>?</span> Guide d&apos;utilisation
        </button>
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

      {/* Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {modules.map(m => (
          <div key={m.title} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl mb-2">{m.icon}</div>
            <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--text)' }}>{m.title}</div>
            <div className="text-xs mb-2" style={{ color: m.color }}>{m.subtitle}</div>
            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{m.desc}</div>
            {hasOrg && (
              <button
                onClick={m.action}
                className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: m.color }}
              >
                {m.icon} Accéder
              </button>
            )}
          </div>
        ))}
      </div>

      {/* CTA ou message */}
      {hasOrg ? (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => onNavigate('module-base')}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#16a34a' }}
          >
            🌿 Module de Base
          </button>
          <button
            onClick={() => onNavigate('module-complet')}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#7c3aed' }}
          >
            🏆 Module Complet
          </button>
        </div>
      ) : (
        <div className="rounded-xl border p-5 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Sélectionnez une organisation pour commencer votre reporting VSME EFRAG.
        </div>
      )}

      {/* Liens apps */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Applications RSE associées</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/rse/iso26000"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            ♻️ Diagnostic ISO 26000
          </Link>
          <Link href="/rse/diagnostic-initial"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            🧭 Diagnostic RSE initial guidé
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Vue Tableau de bord ──────────────────────────────────────────────────────

function DashboardView({ responses }: { responses: Map<string, VsmeResponse> }) {
  const allBaseCodes = BASE_SECTIONS.flatMap(s => s.datapoints.map(dp => dp.code))
  const allCompletCodes = COMPLET_SECTIONS.flatMap(s => s.datapoints.map(dp => dp.code))
  const allCodes = [...allBaseCodes, ...allCompletCodes]

  function countStatus(codes: string[], s: VsmeStatus) {
    return codes.filter(c => (responses.get(c)?.status ?? 'non_evalue') === s).length
  }

  const baseRenseigne = countStatus(allBaseCodes, 'renseigne')
  const completRenseigne = countStatus(allCompletCodes, 'renseigne')
  const globalRenseigne = baseRenseigne + completRenseigne
  const globalTotal = allCodes.length

  const statusCounts: { status: VsmeStatus; count: number }[] = [
    { status: 'non_evalue', count: countStatus(allCodes, 'non_evalue') },
    { status: 'non_applicable', count: countStatus(allCodes, 'non_applicable') },
    { status: 'non_renseigne', count: countStatus(allCodes, 'non_renseigne') },
    { status: 'en_cours', count: countStatus(allCodes, 'en_cours') },
    { status: 'renseigne', count: countStatus(allCodes, 'renseigne') },
  ]

  const globalPct = globalTotal > 0 ? Math.round((globalRenseigne / globalTotal) * 100) : 0
  const basePct = allBaseCodes.length > 0 ? Math.round((baseRenseigne / allBaseCodes.length) * 100) : 0
  const completPct = allCompletCodes.length > 0 ? Math.round((completRenseigne / allCompletCodes.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Radar */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Radar de maturité — Module de Base</h3>
        <RadarChart responses={responses} />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Progression globale', pct: globalPct, color: '#2563eb' },
          { label: 'Module de Base', pct: basePct, color: '#16a34a' },
          { label: 'Module Complet', pct: completPct, color: '#7c3aed' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-3xl font-bold mb-1" style={{ color: item.color }}>{item.pct}%</div>
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>{item.label}</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Barres de progression détaillées */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Progression par module</h3>
        <div className="space-y-3">
          {[
            { label: '🌿 Module de Base', done: baseRenseigne, total: allBaseCodes.length, color: '#16a34a' },
            { label: '🏆 Module Complet', done: completRenseigne, total: allCompletCodes.length, color: '#7c3aed' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>{item.label}</span>
                <span>{item.done}/{item.total} renseignés</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${item.total > 0 ? (item.done / item.total) * 100 : 0}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Répartition des statuts */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Répartition des statuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statusCounts.map(sc => {
            const cfg = STATUS_CONFIG[sc.status]
            return (
              <div key={sc.status} className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)', backgroundColor: cfg.bg }}>
                <div className="text-xl font-bold" style={{ color: cfg.color }}>{sc.count}</div>
                <div className="text-xs mt-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Module (Base ou Complet) ─────────────────────────────────────────────

function ModuleView({
  sections,
  responses,
  onUpdate,
}: {
  sections: VsmeSection[]
  responses: Map<string, VsmeResponse>
  onUpdate: (code: string, patch: Partial<VsmeResponse>) => void
}) {
  return (
    <div className="space-y-4">
      {sections.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          responses={responses}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

function CorrespondancesView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Correspondances VSME ↔ Standards</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Alignement des datapoints VSME EFRAG avec les référentiels CSRD/ESRS, GRI Standards 2021 et ISO 26000.
        </p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div
          className="grid grid-cols-4 gap-0 text-xs font-semibold px-4 py-3"
          style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <div>Section VSME</div>
          <div>CSRD / ESRS</div>
          <div>GRI Standards 2021</div>
          <div>ISO 26000</div>
        </div>
        {CORRESPONDANCES.map((row, i) => (
          <div
            key={row.section}
            className="grid grid-cols-4 gap-0 px-4 py-3 text-xs"
            style={{
              backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg)',
              borderBottom: i < CORRESPONDANCES.length - 1 ? '1px solid var(--border)' : undefined,
              color: 'var(--text)',
            }}
          >
            <div>
              <span className="font-mono font-bold text-xs" style={{ color: 'var(--accent, #6366f1)' }}>{row.section}</span>
              <div style={{ color: 'var(--text-muted)' }}>{row.label}</div>
            </div>
            <div style={{ color: 'var(--text)' }}>{row.esrs}</div>
            <div style={{ color: 'var(--text)' }}>{row.gri}</div>
            <div style={{ color: 'var(--text)' }}>{row.iso}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: '📐', title: 'CSRD / ESRS', desc: 'Corporate Sustainability Reporting Directive — standards européens obligatoires pour les grandes entreprises à partir de 2024.', color: '#2563eb' },
          { icon: '🌍', title: 'GRI Standards 2021', desc: 'Global Reporting Initiative — référentiel mondial pour le reporting de durabilité. Mis à jour en 2021.', color: '#059669' },
          { icon: '♻️', title: 'ISO 26000', desc: 'Norme internationale de responsabilité sociétale — lignes directrices pour les organisations de toutes tailles.', color: '#d97706' },
        ].map(item => (
          <div key={item.title} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="text-sm font-bold mb-1" style={{ color: item.color }}>{item.title}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function VsmeEfragApp({ ctx }: { ctx: RseContext }) {
  const [view, setView] = useState<View>('accueil')
  const [responses, setResponses] = useState<Map<string, VsmeResponse>>(new Map())
  const [loading, setLoading] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const supabase = createClient()

  // Auto-ouvrir le tutoriel à la première visite
  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true)
    } catch {}
  }, [])

  const disabledTabs = !ctx.org
    ? TABS.filter(t => t.id !== 'accueil').map(t => t.id)
    : []

  const loadResponses = useCallback(async () => {
    if (!ctx.org) { setResponses(new Map()); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('vsme_responses')
        .select('*')
        .eq('org_id', ctx.org.id)
        .eq('year', ctx.year)
      const map = new Map<string, VsmeResponse>()
      for (const row of (data ?? [])) {
        map.set(row.datapoint_code, row as VsmeResponse)
      }
      setResponses(map)
    } finally {
      setLoading(false)
    }
  }, [ctx.org, ctx.year, supabase])

  useEffect(() => { loadResponses() }, [loadResponses])

  const handleUpdate = useCallback(async (code: string, patch: Partial<VsmeResponse>) => {
    if (!ctx.org) return
    const existing = responses.get(code)
    const merged: VsmeResponse = {
      org_id: ctx.org.id,
      year: ctx.year,
      datapoint_code: code,
      status: 'non_evalue',
      value_text: null,
      value_number: null,
      notes: null,
      ...existing,
      ...patch,
    }
    // Optimistic update
    setResponses(prev => {
      const next = new Map(prev)
      next.set(code, merged)
      return next
    })
    // Persist
    await supabase
      .from('vsme_responses')
      .upsert({
        org_id: ctx.org.id,
        year: ctx.year,
        datapoint_code: code,
        status: merged.status,
        value_text: merged.value_text,
        value_number: merged.value_number,
        notes: merged.notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,year,datapoint_code' })
  }, [ctx.org, ctx.year, responses, supabase])

  return (
    <div>
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <ViewTabs
        tabs={TABS}
        active={view}
        onChange={setView}
        disabledIds={disabledTabs}
      />

      {view === 'accueil' && (
        <AccueilView
          hasOrg={!!ctx.org}
          onNavigate={setView}
          onOpenTutorial={() => setShowTutorial(true)}
        />
      )}

      {view === 'dashboard' && ctx.org && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          </div>
        ) : (
          <DashboardView responses={responses} />
        )
      )}

      {view === 'module-base' && ctx.org && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          </div>
        ) : (
          <ModuleView
            sections={BASE_SECTIONS}
            responses={responses}
            onUpdate={handleUpdate}
          />
        )
      )}

      {view === 'module-complet' && ctx.org && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          </div>
        ) : (
          <ModuleView
            sections={COMPLET_SECTIONS}
            responses={responses}
            onUpdate={handleUpdate}
          />
        )
      )}

      {view === 'correspondances' && ctx.org && (
        <CorrespondancesView />
      )}
    </div>
  )
}
