'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnexeItem {
  id: string
  name: string
  url: string
  mime: string | null
  size: number | null
  action_key: string
  annexe_index: number | null
}

// Données minimales pour le groupement (extrait de DOMAINS dans GuidedDiagnostic)
const DOMAIN_META: Record<string, { nom: string; icone: string; phase: number; phaseColor: string; actions: string[] }> = {
  'DA1.1': { nom: 'Gouvernance organisationnelle', icone: '🏛️', phase: 1, phaseColor: '#ef4444',
    actions: ['Définir et formaliser les valeurs, vision et stratégie RSE','Identifier et cartographier les parties prenantes','Mettre en place des mécanismes de décision transparents','Établir un reporting RSE régulier (annuel au minimum)','Intégrer la RSE dans les objectifs stratégiques et la feuille de route','Désigner un responsable RSE ou un comité dédié avec mandat officiel','Promouvoir la diversité dans les instances de décision','Évaluer et améliorer en continu les pratiques de gouvernance','Former les dirigeants et administrateurs aux enjeux de responsabilité sociétale','Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)'] },
  'DA3.4': { nom: 'Santé et sécurité au travail', icone: '👷', phase: 1, phaseColor: '#ef4444',
    actions: ['Évaluer les risques professionnels et mettre à jour le document unique (DUER)','Mettre en place un comité SSCT (Santé, Sécurité et Conditions de Travail)','Former régulièrement les collaborateurs aux gestes et postures et aux risques spécifiques','Définir des indicateurs de suivi : taux de fréquence, taux de gravité des accidents',"Promouvoir la remontée d'incidents et de presqu'accidents (culture de sécurité)",'Intégrer le bien-être mental dans la politique santé (prévention des RPS)','Auditer régulièrement les conditions de travail et agir sur les résultats'] },
  'DA4.3': { nom: 'Atténuation des changements climatiques', icone: '🌱', phase: 1, phaseColor: '#ef4444',
    actions: ['Réaliser un bilan des émissions de gaz à effet de serre (Bilan Carbone® ou GHG Protocol)','Fixer des objectifs de réduction des émissions à court et moyen terme','Optimiser la consommation énergétique des bâtiments et équipements',"Développer l'usage des énergies renouvelables","Intégrer le critère carbone dans les décisions d'achats et d'investissements",'Communiquer transparentement sur les émissions et les progrès réalisés','Étudier les compensations carbone comme levier complémentaire (pas substitutif)'] },
  'DA5.1': { nom: 'Lutte contre la corruption', icone: '⚖️', phase: 1, phaseColor: '#ef4444',
    actions: ['Adopter et diffuser un code de conduite anti-corruption',"Cartographier les risques de corruption et d'atteinte à la probité",'Former les collaborateurs exposés aux risques de corruption',"Mettre en place un dispositif d'alerte interne (whistleblowing)",'Évaluer les tiers (clients, fournisseurs, intermédiaires) sur leur intégrité','Auditer régulièrement les processus à risque (achats, commercial, partenariats)'] },
  'DA3.1': { nom: 'Emploi et relations de travail', icone: '👷', phase: 2, phaseColor: '#f97316',
    actions: ['Établir une politique de rémunération équitable et transparente','Garantir la stabilité des contrats et limiter la précarité','Favoriser le dialogue social et la consultation des représentants du personnel','Mettre en place des entretiens individuels réguliers et des parcours de carrière','Développer la flexibilité du travail (télétravail, aménagement horaires)',"Mesurer et améliorer le taux d'engagement et de satisfaction des collaborateurs"] },
  'DA3.5': { nom: 'Formation et éducation', icone: '👷', phase: 2, phaseColor: '#f97316',
    actions: ['Définir un plan de développement des compétences annuel',"Garantir l'accès à la formation pour tous les niveaux hiérarchiques",'Intégrer la RSE dans les parcours de formation','Développer le mentorat et le transfert de compétences internes',"Mesurer l'impact des formations sur les performances",'Favoriser les certifications professionnelles et la validation des acquis'] },
  'DA3.6': { nom: 'Égalité professionnelle', icone: '👷', phase: 2, phaseColor: '#f97316',
    actions: ["Calculer et publier l'Index d'égalité professionnelle femmes/hommes","Analyser les écarts de rémunération et définir un plan d'action correctif",'Fixer des objectifs de mixité à tous les niveaux hiérarchiques, notamment en direction','Prévenir et traiter les situations de harcèlement moral et sexuel','Faciliter la conciliation vie professionnelle / vie personnelle','Former les managers et recruteurs aux biais inconscients'] },
  'DA5.4': { nom: "Pratiques d'achat responsables", icone: '⚖️', phase: 2, phaseColor: '#f97316',
    actions: ["Définir une politique d'achats responsables intégrant des critères RSE",'Évaluer les fournisseurs sur des critères sociaux, environnementaux et éthiques','Intégrer des clauses RSE dans les contrats fournisseurs',"Privilégier les fournisseurs locaux et les entreprises de l'ESS",'Accompagner les fournisseurs dans leur démarche RSE',"Mesurer et réduire l'empreinte carbone de la chaîne d'approvisionnement"] },
  'DA4.1': { nom: 'Prévention de la pollution', icone: '🌱', phase: 3, phaseColor: '#22c55e',
    actions: ['Cartographier et quantifier les pollutions générées (air, eau, sol, déchets)','Mettre en conformité les installations avec les réglementations environnementales','Réduire à la source les émissions polluantes et les déchets produits','Trier et valoriser les déchets (réemploi, recyclage, compostage)','Former les collaborateurs aux bonnes pratiques environnementales','Travailler avec les fournisseurs pour réduire les emballages et matières dangereuses',"Mesurer l'évolution des indicateurs pollution et fixer des objectifs de réduction"] },
  'DA4.2': { nom: 'Utilisation durable des ressources', icone: '🌱', phase: 3, phaseColor: '#22c55e',
    actions: ["Réaliser un audit des consommations énergétiques et identifier les gisements d'économies","Mettre en oeuvre un plan d'efficacité énergétique (isolation, équipements, process)","Mesurer et réduire les consommations d'eau","Développer l'économie circulaire dans les processus de production","Réduire l'utilisation de matières premières vierges (recyclées, biosourcées)",'Mettre en place un suivi des consommations en temps réel','Fixer des objectifs annuels de réduction des consommations et les suivre'] },
  'DA2.1': { nom: 'Devoir de vigilance', icone: '🤝', phase: 4, phaseColor: '#8b5cf6',
    actions: ["Cartographier les risques d'atteintes aux droits humains dans la chaîne de valeur",'Élaborer et publier un plan de vigilance conforme à la loi',"Mettre en oeuvre des procédures d'évaluation et d'audit fournisseurs sur les droits humains",'Former les acheteurs et responsables commerciaux au devoir de vigilance',"Établir un mécanisme d'alerte pour les victimes de violations","Assurer le suivi et l'amélioration continue du plan de vigilance"] },
  'DA6.5': { nom: 'Protection des données', icone: '🛒', phase: 4, phaseColor: '#8b5cf6',
    actions: ['Désigner un délégué à la protection des données (DPO) ou un référent RGPD','Réaliser un registre des traitements de données personnelles','Mettre en place les mentions légales et les consentements conformes au RGPD','Former les collaborateurs aux bonnes pratiques de protection des données',"Réaliser des analyses d'impact (AIPD) pour les traitements à risque","Gérer les demandes d'exercice des droits des personnes (accès, suppression…)"] },
  'DA7.1': { nom: 'Implication auprès des communautés', icone: '🏘️', phase: 4, phaseColor: '#8b5cf6',
    actions: ['Cartographier et dialoguer régulièrement avec les communautés locales','Soutenir des initiatives locales (emploi, culture, sport, éducation)',"Développer des partenariats avec les associations et acteurs de l'ESS locaux","Favoriser l'emploi local dans les recrutements et sous-traitances","Mesurer l'impact territorial de l'organisation (emplois induits, achats locaux…)",'Participer aux concertations et décisions qui affectent le territoire'] },
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Fondamentaux', 2: 'Piliers sociaux', 3: 'Environnement', 4: 'Enjeux complémentaires',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mimeIcon(mime: string | null): string {
  if (!mime) return '📎'
  if (mime === 'application/pdf') return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📑'
  if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return '🗜️'
  return '📎'
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${bytes} o`
}

function annexePrefix(index: number | null): string {
  if (index == null) return ''
  return `A${String(index).padStart(3, '0')}`
}

// ─── Groupement par domaine → action ─────────────────────────────────────────

interface ActionGroup {
  actionKey: string
  actionIndex: number
  actionLabel: string
  annexes: AnnexeItem[]
}

interface DomainGroup {
  domainId: string
  nom: string
  icone: string
  phase: number
  phaseColor: string
  actions: ActionGroup[]
  total: number
}

function groupByDomain(items: AnnexeItem[]): DomainGroup[] {
  const map = new Map<string, DomainGroup>()

  for (const item of items) {
    // action_key = "DA1.1_0" → domainId="DA1.1", actionIndex=0
    const lastUnderscore = item.action_key.lastIndexOf('_')
    const domainId = lastUnderscore > 0 ? item.action_key.slice(0, lastUnderscore) : item.action_key
    const actionIndex = lastUnderscore > 0 ? parseInt(item.action_key.slice(lastUnderscore + 1), 10) : 0

    const meta = DOMAIN_META[domainId]

    if (!map.has(domainId)) {
      map.set(domainId, {
        domainId,
        nom: meta?.nom ?? domainId,
        icone: meta?.icone ?? '📁',
        phase: meta?.phase ?? 0,
        phaseColor: meta?.phaseColor ?? '#6b7280',
        actions: [],
        total: 0,
      })
    }

    const group = map.get(domainId)!
    let actionGroup = group.actions.find(a => a.actionKey === item.action_key)
    if (!actionGroup) {
      actionGroup = {
        actionKey: item.action_key,
        actionIndex,
        actionLabel: meta?.actions[actionIndex] ?? item.action_key,
      annexes: [],
      }
      group.actions.push(actionGroup)
    }
    actionGroup.annexes.push(item)
    group.total++
  }

  // Trier par phase → domaine → action index
  const groups = Array.from(map.values())
  groups.sort((a, b) => a.phase - b.phase || a.domainId.localeCompare(b.domainId))
  for (const g of groups) {
    g.actions.sort((a, b) => a.actionIndex - b.actionIndex)
  }
  return groups
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GuidedAnnexesModal({
  diagnosticId,
  onClose,
}: {
  diagnosticId: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AnnexeItem[]>([])
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  // Fetch une seule fois à l'ouverture de la modale
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/guided-diagnostic/${diagnosticId}/notes/annexes-urls`)
      .then(r => r.json())
      .then((json: { data?: AnnexeItem[]; error?: string }) => {
        if (cancelled) return
        if (json.error) { setError(json.error); return }
        const data = (json.data ?? []) as AnnexeItem[]
        setItems(data)
        // Ouvrir tous les domaines par défaut si peu d'annexes, sinon fermer
        if (data.length <= 20) {
          const allDomains = new Set(data.map(i => {
            const last = i.action_key.lastIndexOf('_')
            return last > 0 ? i.action_key.slice(0, last) : i.action_key
          }))
          setExpandedDomains(allDomains)
        }
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [diagnosticId])

  const groups = groupByDomain(items)

  const toggleDomain = useCallback((domainId: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domainId)) next.delete(domainId)
      else next.add(domainId)
      return next
    })
  }, [])

  // Télécharger un fichier individuel
  function downloadFile(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Tout télécharger — séquentiel 400 ms, flux direct SharePoint
  async function downloadAll() {
    if (downloading || items.length === 0) return
    // Trier par annexe_index pour un ordre logique
    const sorted = [...items].sort((a, b) => (a.annexe_index ?? 999) - (b.annexe_index ?? 999))
    setDownloading(true)
    setDownloadProgress({ done: 0, total: sorted.length })
    try {
      for (let i = 0; i < sorted.length; i++) {
        downloadFile(sorted[i].url, sorted[i].name)
        setDownloadProgress({ done: i + 1, total: sorted.length })
        if (i < sorted.length - 1) await new Promise(r => setTimeout(r, 400))
      }
    } finally {
      setDownloading(false)
      setTimeout(() => setDownloadProgress(null), 3000)
    }
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Fenêtre modale */}
      <div
        className="relative flex flex-col w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">📎</span>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Pièces jointes</h2>
              {!loading && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {items.length === 0
                    ? 'Aucune annexe'
                    : `${items.length} fichier${items.length > 1 ? 's' : ''} · ${groups.length} domaine${groups.length > 1 ? 's' : ''}`}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:opacity-70"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            ✕
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="text-sm text-red-500 text-center py-8">{error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucune pièce jointe pour ce diagnostic.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-subtle, var(--text-muted))' }}>
                Ajoutez des fichiers via le panneau de notes du questionnaire.
              </p>
            </div>
          )}

          {!loading && !error && groups.map(group => (
            <div key={group.domainId} className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)' }}>
              {/* En-tête domaine */}
              <button
                onClick={() => toggleDomain(group.domainId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80"
                style={{ backgroundColor: `${group.phaseColor}15` }}>
                <span className="text-sm">{group.icone}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {group.domainId} — {group.nom}
                  </div>
                  <div className="text-[10px]" style={{ color: group.phaseColor }}>
                    Phase {group.phase} — {PHASE_LABELS[group.phase]}
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.phaseColor, color: 'white' }}>
                  {group.total}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {expandedDomains.has(group.domainId) ? '▲' : '▼'}
                </span>
              </button>

              {/* Actions + fichiers */}
              {expandedDomains.has(group.domainId) && (
                <div className="divide-y" style={{ borderTop: '1px solid var(--border)', borderColor: 'var(--border)' }}>
                  {group.actions.map(actionGroup => (
                    <div key={actionGroup.actionKey}>
                      {/* Label action */}
                      <div className="px-4 py-2 text-xs font-medium"
                        style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                        ▸ {actionGroup.actionLabel.length > 90
                          ? actionGroup.actionLabel.slice(0, 90) + '…'
                          : actionGroup.actionLabel}
                      </div>
                      {/* Fichiers */}
                      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {actionGroup.annexes.map(annexe => (
                          <button
                            key={annexe.id}
                            onClick={() => downloadFile(annexe.url, annexe.name)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-80 group"
                            style={{ backgroundColor: 'var(--bg-card)' }}
                            title={`Télécharger ${annexe.name} (direct SharePoint)`}
                          >
                            {/* Icône MIME */}
                            <span className="text-lg flex-shrink-0">{mimeIcon(annexe.mime)}</span>
                            {/* Infos fichier */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {annexe.annexe_index != null && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                    style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                                    {annexePrefix(annexe.annexe_index)}
                                  </span>
                                )}
                                <span className="text-xs font-medium truncate group-hover:underline"
                                  style={{ color: 'var(--text)' }}>
                                  {annexe.name}
                                </span>
                              </div>
                              {annexe.size && (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {formatSize(annexe.size)}
                                </span>
                              )}
                            </div>
                            {/* Icône téléchargement */}
                            <span className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: '#6366f1' }}>
                              ↓
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Téléchargement direct depuis SharePoint — zéro transit serveur
            </p>
            <button
              onClick={downloadAll}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#6366f1' }}>
              {downloading ? (
                downloadProgress
                  ? `${downloadProgress.done}/${downloadProgress.total} en cours…`
                  : 'Préparation…'
              ) : (
                <>
                  <span>⬇</span>
                  <span>Tout télécharger ({items.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
