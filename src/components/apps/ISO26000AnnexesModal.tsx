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

// Données minimales pour le groupement — 37 domaines ISO 26000 (7 QC)
const DOMAIN_META: Record<string, { nom: string; icone: string; qcId: string; qcColor: string; actions: string[] }> = {
  // QC1 — Gouvernance
  'DA1.1': { nom: 'Gouvernance organisationnelle', icone: '🏛️', qcId: 'QC1', qcColor: '#60a5fa',
    actions: ["Définir et formaliser les valeurs, vision et stratégie RSE","Identifier et cartographier les parties prenantes","Mettre en place des mécanismes de décision transparents","Établir un reporting RSE régulier (annuel au minimum)","Intégrer la RSE dans les objectifs stratégiques et la feuille de route","Désigner un responsable RSE ou un comité dédié avec mandat officiel","Promouvoir la diversité dans les instances de décision","Évaluer et améliorer en continu les pratiques de gouvernance","Former les dirigeants et administrateurs aux enjeux de responsabilité sociétale","Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)"] },
  // QC2 — Droits de l'Homme
  'DA2.1': { nom: 'Devoir de vigilance', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Cartographier les risques droits de l'Homme dans les activités et la chaîne d'approvisionnement","Mettre en place un plan de vigilance selon la loi Sapin 2 et les Principes directeurs ONU","Évaluer régulièrement les fournisseurs et partenaires sur le respect des droits de l'Homme","Définir des procédures de remédiation en cas d'atteinte identifiée","Former les équipes à la vigilance et à la détection des violations","Intégrer les droits de l'Homme dans les due diligences lors d'acquisitions"] },
  'DA2.2': { nom: "Situations à risque pour les droits de l'Homme", icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Analyser le contexte géographique et politique des activités dans les pays à risque","Éviter d'opérer dans des zones à très haut risque ou prendre des mesures renforcées","Collaborer avec des ONG locales et des experts en droits de l'Homme","Établir des mécanismes de signalement locaux accessibles aux communautés","Adapter les politiques RH aux contextes locaux tout en respectant les standards internationaux"] },
  'DA2.3': { nom: 'Prévention de la complicité', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Adopter une politique tolérance zéro sur la complicité avec les violations des droits","Auditer régulièrement la chaîne de valeur pour détecter les risques de complicité","Intégrer des clauses contractuelles droits de l'Homme dans tous les contrats importants","Définir des critères droits de l'Homme dans les appels d'offres et la sélection des fournisseurs","Mettre fin aux partenariats en cas de violations graves non corrigées"] },
  'DA2.4': { nom: "Remédier aux atteintes aux droits de l'Homme", icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Créer un mécanisme de réclamations accessible à toutes les parties prenantes affectées","Garantir la confidentialité et la protection des lanceurs d'alerte","Documenter et suivre systématiquement chaque réclamation reçue","Publier des rapports annuels sur le traitement des réclamations","Former les équipes à l'utilisation et à la gestion du mécanisme"] },
  'DA2.5': { nom: 'Discrimination et groupes vulnérables', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Adopter une politique de non-discrimination couvrant tous les critères légaux et éthiques","Mettre en place des actions positives pour les groupes sous-représentés","Former l'ensemble des managers à la lutte contre les discriminations et les biais inconscients","Réaliser des audits de rémunération réguliers pour détecter les inégalités","Mettre en place des aménagements raisonnables pour les personnes handicapées","Mesurer la diversité dans les recrutements, promotions et rémunérations"] },
  'DA2.6': { nom: 'Droits civils et politiques', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Garantir la liberté d'expression au travail, y compris la possibilité de critiquer les pratiques","Protéger et promouvoir le droit d'association syndicale","Ne pas exercer de pression politique sur les employés ou parties prenantes","Protéger la vie privée des salariés dans le cadre du travail","Respecter la liberté de conscience et de religion dans le cadre du travail"] },
  'DA2.7': { nom: 'Droits économiques, sociaux et culturels', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Assurer des rémunérations permettant un niveau de vie décent (au-delà du SMIC)","Favoriser la formation continue et le développement des compétences","Respecter et promouvoir le droit à la santé au travail et en dehors","Soutenir l'accès aux services essentiels pour les travailleurs et leurs familles","Respecter les traditions culturelles des communautés dans lesquelles l'organisation opère"] },
  'DA2.8': { nom: 'Principes fondamentaux et droits au travail', icone: '🤝', qcId: 'QC2', qcColor: '#f87171',
    actions: ["Garantir l'absence totale de travail forcé ou obligatoire dans l'organisation et sa chaîne","Interdire formellement le travail des enfants dans toute la chaîne de valeur","Promouvoir activement la liberté syndicale et la négociation collective","Assurer l'égalité de rémunération entre les femmes et les hommes pour un travail de valeur égale","Intégrer les conventions OIT dans les exigences contractuelles fournisseurs"] },
  // QC3 — Relations et conditions de travail
  'DA3.1': { nom: 'Emploi et relations employeur/employé', icone: '👷', qcId: 'QC3', qcColor: '#34d399',
    actions: ["Établir des contrats de travail clairs conformes à la législation et aux conventions collectives","Assurer des rémunérations justes, équitables et en lien avec les qualifications","Mettre en place un processus de recrutement non discriminatoire et transparent","Définir des procédures de licenciement justes respectant les droits des travailleurs","Favoriser la stabilité de l'emploi en limitant le recours aux contrats précaires","Privilégier l'emploi local dans les zones où l'organisation opère"] },
  'DA3.2': { nom: 'Conditions de travail et protection sociale', icone: '👷', qcId: 'QC3', qcColor: '#34d399',
    actions: ["Respecter strictement les temps de travail légaux et conventionnels","Assurer une protection sociale complète (retraite, santé, prévoyance) pour tous","Proposer une politique de congés flexible adaptée aux besoins des salariés","Mettre en place une charte du droit à la déconnexion numérique","Faciliter le télétravail et les modes de travail flexibles","Accompagner le retour au travail post-congé maternité/paternité/parental"] },
  'DA3.3': { nom: 'Dialogue social', icone: '👷', qcId: 'QC3', qcColor: '#34d399',
    actions: ["Encourager activement la représentation syndicale et protéger les représentants élus","Tenir des réunions régulières et substantielles avec les représentants du personnel","Informer et consulter les salariés sur les décisions ayant un impact sur leur travail","Conclure des accords d'entreprise sur des sujets stratégiques","Réaliser des enquêtes régulières d'engagement et de satisfaction des employés"] },
  'DA3.4': { nom: 'Santé et sécurité au travail', icone: '👷', qcId: 'QC3', qcColor: '#34d399',
    actions: ["Réaliser et mettre à jour régulièrement le Document Unique d'Évaluation des Risques (DUER)","Former l'ensemble des salariés aux gestes de premiers secours (SST)","Déployer une politique de prévention des risques psychosociaux (RPS) efficace","Assurer un suivi médical régulier et une médecine du travail de qualité","Viser la certification ISO 45001 (Santé et sécurité au travail)","Analyser systématiquement tous les accidents du travail et presqu'accidents","Réaliser des aménagements ergonomiques des postes de travail"] },
  'DA3.5': { nom: 'Développement du capital humain', icone: '👷', qcId: 'QC3', qcColor: '#34d399',
    actions: ["Mener des entretiens annuels et des entretiens professionnels de qualité","Élaborer et exécuter un plan de développement des compétences ambitieux","Encourager et faciliter la mobilité interne","Garantir l'accès à la formation continue et au CPF pour tous","Mettre en place un programme de mentorat et/ou de coaching","Évaluer en continu les besoins en compétences futures (GPEC/GEPP)"] },
  // QC4 — Environnement
  'DA4.1': { nom: 'Prévention de la pollution', icone: '🌱', qcId: 'QC4', qcColor: '#4ade80',
    actions: ["Réaliser un bilan complet des émissions polluantes (air, eau, sol, déchets)","Mettre en place et investir dans des technologies propres et moins polluantes","Réduire progressivement l'utilisation des substances dangereuses","Gérer et valoriser les déchets selon la hiérarchie de gestion des déchets","Traiter les effluents avant tout rejet dans l'environnement","Viser et maintenir la certification ISO 14001 (Management environnemental)","Former l'ensemble des collaborateurs aux bonnes pratiques environnementales"] },
  'DA4.2': { nom: 'Utilisation durable des ressources', icone: '🌱', qcId: 'QC4', qcColor: '#4ade80',
    actions: ["Réaliser un bilan énergétique complet et définir un plan de réduction","Améliorer l'efficacité énergétique des bâtiments, équipements et processus","Installer des sources d'énergie renouvelable sur les sites","Mesurer et réduire la consommation d'eau et gérer les eaux usées","Intégrer l'éco-conception dans le développement des produits et services","Optimiser les achats en favorisant les circuits courts et les produits durables","Déployer une démarche d'économie circulaire (réparation, réemploi, recyclage)","Viser la certification ISO 50001 (Management de l'énergie)"] },
  'DA4.3': { nom: 'Atténuation des changements climatiques et adaptation', icone: '🌱', qcId: 'QC4', qcColor: '#4ade80',
    actions: ["Réaliser un Bilan Carbone® complet couvrant les scopes 1, 2 et 3","Définir une trajectoire de réduction ambitieuse alignée sur les Accords de Paris","Élaborer et mettre en œuvre un plan de transition bas-carbone","Compenser les émissions résiduelles par des projets de séquestration carbone vérifiés","Analyser les risques et opportunités climatiques selon le cadre TCFD","Réduire les déplacements professionnels et développer les alternatives","Adopter une politique d'achats bas-carbone sur toute la chaîne de valeur"] },
  'DA4.4': { nom: "Protection de l'environnement, biodiversité et habitats naturels", icone: '🌱', qcId: 'QC4', qcColor: '#4ade80',
    actions: ["Réaliser un diagnostic de biodiversité sur tous les sites d'activité","Appliquer systématiquement la séquence ERC (Éviter-Réduire-Compenser)","Adopter une politique zéro déforestation dans les achats","Végétaliser les sites et favoriser la biodiversité locale","Engager des programmes de restauration écologique","Évaluer les dépendances écosystémiques selon le cadre TNFD"] },
  // QC5 — Loyauté des pratiques
  'DA5.1': { nom: 'Lutte contre la corruption', icone: '⚖️', qcId: 'QC5', qcColor: '#fbbf24',
    actions: ["Adopter et diffuser un code éthique et une politique anti-corruption clairs","Déployer un programme de conformité anti-corruption (mapping risques, contrôles, procédures)","Former régulièrement les collaborateurs exposés aux risques de corruption","Mettre en place un dispositif de signalement des alertes éthiques protégé","Réaliser des audits internes anti-corruption périodiques","Évaluer les risques de corruption chez les tiers (fournisseurs, agents, intermédiaires)"] },
  'DA5.2': { nom: 'Engagement politique responsable', icone: '⚖️', qcId: 'QC5', qcColor: '#fbbf24',
    actions: ["Adopter une politique de transparence dans les relations avec les institutions publiques","Déclarer les représentants d'intérêts dans les registres officiels","Éviter tout financement politique opaque ou contraire à l'éthique","Participer aux consultations publiques de manière transparente et constructive"] },
  'DA5.3': { nom: 'Concurrence loyale', icone: '⚖️', qcId: 'QC5', qcColor: '#fbbf24',
    actions: ["Former régulièrement les équipes commerciales et achats au droit de la concurrence","Déployer un programme de conformité antitrust avec des procédures claires","Refuser systématiquement les accords de fixation de prix ou de partage de marchés","Éviter tout abus de position dominante vis-à-vis des clients et fournisseurs","Mettre en place un système de veille et de détection des comportements anticoncurrentiels"] },
  'DA5.4': { nom: 'Promotion de la RSE dans la chaîne de valeur', icone: '⚖️', qcId: 'QC5', qcColor: '#fbbf24',
    actions: ["Intégrer des critères RSE formels dans les appels d'offres et la sélection des fournisseurs","Évaluer régulièrement les fournisseurs stratégiques sur leurs pratiques RSE","Accompagner concrètement les fournisseurs dans le développement de leur démarche RSE","Favoriser les achats locaux, équitables et durables","Publier et diffuser une politique d'achats responsables ambitieuse"] },
  'DA5.5': { nom: 'Respect des droits de propriété', icone: '⚖️', qcId: 'QC5', qcColor: '#fbbf24',
    actions: ["Adopter une politique formelle de respect de la propriété intellectuelle","Former les équipes R&D, marketing et achats aux droits de propriété intellectuelle","Respecter strictement les licences logicielles et les droits d'auteur","Mettre en place des procédures pour éviter l'usage non autorisé de brevets tiers"] },
  // QC6 — Questions relatives aux consommateurs
  'DA6.1': { nom: "Pratiques loyales en matière de commercialisation, d'informations et de contrats", icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Garantir la véracité, la clarté et l'objectivité des allégations publicitaires","Éviter d'inclure des clauses contractuelles abusives dans les contrats","Fournir des informations complètes et transparentes sur les produits et services","Lutter activement contre le greenwashing et les allégations environnementales trompeuses","Informer clairement sur les prix, les conditions et les engagements"] },
  'DA6.2': { nom: 'Protection de la santé et de la sécurité des consommateurs', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Mettre en place et certifier un système de management de la qualité (ISO 9001)","Réaliser des analyses de risques complètes sur tous les produits et services","Définir et tester des procédures de retrait et de rappel de produits","Communiquer clairement sur les risques d'utilisation et les précautions à prendre","Suivre et analyser systématiquement les incidents consommateurs liés à la sécurité"] },
  'DA6.3': { nom: 'Consommation durable', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Développer et promouvoir des alternatives éco-responsables dans l'offre","Intégrer l'éco-conception dès le début du développement des produits","Informer les consommateurs sur l'impact environnemental et social des produits","Faciliter et encourager la réparation, le réemploi et le recyclage","Mettre en place un affichage environnemental des produits"] },
  'DA6.4': { nom: 'Service après-vente, assistance et résolution des réclamations', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Offrir un service client accessible, réactif et multicanal (téléphone, email, chat, boutique)","Définir et appliquer des procédures claires de gestion des réclamations","Former régulièrement les équipes à l'excellence de la relation client","Mesurer et améliorer en continu la satisfaction (NPS, CSAT, CES)","Proposer et promouvoir des modes alternatifs de résolution des litiges (médiation)"] },
  'DA6.5': { nom: 'Protection des données et de la vie privée des consommateurs', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Assurer la pleine conformité au RGPD et aux réglementations applicables","Nommer un Délégué à la Protection des Données (DPO) qualifié","Réaliser des Analyses d'Impact sur la Protection des Données (AIPD/DPIA) pour les traitements à risque","Mettre en place des mesures de sécurité informatique robustes (chiffrement, accès, audits)","Informer clairement et simplement les consommateurs sur l'utilisation de leurs données","Permettre et faciliter l'exercice effectif des droits RGPD"] },
  'DA6.6': { nom: 'Accès aux services essentiels', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Proposer des tarifs accessibles ou des dispositifs spécifiques pour les publics vulnérables","Assurer l'accessibilité physique et numérique pour les personnes handicapées (RGAA)","Participer aux programmes d'accès universel aux services essentiels","Adapter les conditions de paiement pour faciliter l'accès"] },
  'DA6.7': { nom: 'Éducation et sensibilisation', icone: '🛒', qcId: 'QC6', qcColor: '#c084fc',
    actions: ["Produire et diffuser des contenus éducatifs sur l'utilisation responsable des produits","Développer des programmes d'éducation à la consommation durable","Communiquer activement sur les enjeux environnementaux et sociaux liés à l'offre"] },
  // QC7 — Communautés et développement local
  'DA7.1': { nom: 'Implication auprès des communautés', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Organiser des consultations régulières avec les riverains et parties prenantes locales","Participer activement aux instances de concertation et de gouvernance locale","Mettre en place un mécanisme accessible de traitement des plaintes communautaires","Communiquer de manière transparente et régulière sur les impacts locaux de l'activité"] },
  'DA7.2': { nom: 'Éducation et culture', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Financer ou co-financer des programmes d'éducation locale","Proposer des stages, apprentissages et alternances en priorité aux jeunes locaux","Soutenir des projets culturels, artistiques et patrimoniaux locaux","Développer des partenariats durables avec les établissements scolaires locaux"] },
  'DA7.3': { nom: "Création d'emplois et développement des compétences", icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Favoriser systématiquement le recrutement local pour tous les postes","Travailler en partenariat avec France Travail, missions locales et acteurs de l'emploi","Soutenir des initiatives d'insertion professionnelle pour les publics éloignés de l'emploi","Intégrer des clauses d'insertion dans les marchés publics et privés","Contribuer aux GPEC territoriales"] },
  'DA7.4': { nom: 'Développement des technologies et accès à la technologie', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Partager les technologies, savoir-faire et innovations avec les acteurs locaux","Soutenir l'innovation sociale et technologique locale","Contribuer à réduire la fracture numérique (formation, équipements, accès)","Participer à des clusters locaux et à des écosystèmes d'innovation"] },
  'DA7.5': { nom: 'Création de richesses et de revenus', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Privilégier les fournisseurs et sous-traitants locaux dans les achats","Mesurer et communiquer la valeur économique créée et distribuée localement","Soutenir activement les TPE/PME locales par des partenariats durables"] },
  'DA7.6': { nom: 'La santé', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Soutenir des associations et initiatives de santé locales","Développer des programmes de mécénat social liés à la santé","Participer à des campagnes de santé publique (prévention, dépistage…)","Contribuer au développement ou au maintien des infrastructures de santé locales"] },
  'DA7.7': { nom: 'Investissement à impact social', icone: '🏘️', qcId: 'QC7', qcColor: '#22d3ee',
    actions: ["Mesurer et communiquer l'impact social de l'organisation (méthode SROI ou équivalent)","Développer des partenariats stratégiques avec des acteurs de l'ESS","Intégrer des critères d'impact social dans la stratégie d'investissement","Soutenir des initiatives de développement communautaire à fort impact"] },
}

const QC_LABELS: Record<string, string> = {
  QC1: "Gouvernance de l'organisation",
  QC2: "Droits de l'Homme",
  QC3: 'Relations et conditions de travail',
  QC4: 'Environnement',
  QC5: 'Loyauté des pratiques',
  QC6: 'Questions relatives aux consommateurs',
  QC7: 'Communautés et développement local',
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

// ─── Groupement par QC → domaine → action ─────────────────────────────────────

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
  qcId: string
  qcColor: string
  actions: ActionGroup[]
  total: number
}

interface QcGroup {
  qcId: string
  label: string
  color: string
  domains: DomainGroup[]
  total: number
}

function groupByQc(items: AnnexeItem[]): QcGroup[] {
  const domainMap = new Map<string, DomainGroup>()

  for (const item of items) {
    const lastUnderscore = item.action_key.lastIndexOf('_')
    const domainId = lastUnderscore > 0 ? item.action_key.slice(0, lastUnderscore) : item.action_key
    const actionIndex = lastUnderscore > 0 ? parseInt(item.action_key.slice(lastUnderscore + 1), 10) : 0

    const meta = DOMAIN_META[domainId]

    if (!domainMap.has(domainId)) {
      domainMap.set(domainId, {
        domainId,
        nom: meta?.nom ?? domainId,
        icone: meta?.icone ?? '📁',
        qcId: meta?.qcId ?? 'QC?',
        qcColor: meta?.qcColor ?? '#6b7280',
        actions: [],
        total: 0,
      })
    }

    const group = domainMap.get(domainId)!
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

  // Regrouper par QC
  const qcMap = new Map<string, QcGroup>()
  for (const domain of domainMap.values()) {
    if (!qcMap.has(domain.qcId)) {
      qcMap.set(domain.qcId, {
        qcId: domain.qcId,
        label: QC_LABELS[domain.qcId] ?? domain.qcId,
        color: domain.qcColor,
        domains: [],
        total: 0,
      })
    }
    const qcGroup = qcMap.get(domain.qcId)!
    domain.actions.sort((a, b) => a.actionIndex - b.actionIndex)
    qcGroup.domains.push(domain)
    qcGroup.total += domain.total
  }

  const groups = Array.from(qcMap.values())
  groups.sort((a, b) => a.qcId.localeCompare(b.qcId))
  for (const g of groups) {
    g.domains.sort((a, b) => a.domainId.localeCompare(b.domainId))
  }
  return groups
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ISO26000AnnexesModal({
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
  const [expandedQcs, setExpandedQcs] = useState<Set<string>>(new Set())
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/iso26000-diagnostic/${diagnosticId}/notes/annexes-urls`)
      .then(r => r.json())
      .then((json: { data?: AnnexeItem[]; error?: string }) => {
        if (cancelled) return
        if (json.error) { setError(json.error); return }
        const data = (json.data ?? []) as AnnexeItem[]
        setItems(data)
        if (data.length <= 30) {
          const allQcs = new Set(data.map(i => {
            const last = i.action_key.lastIndexOf('_')
            const domainId = last > 0 ? i.action_key.slice(0, last) : i.action_key
            return DOMAIN_META[domainId]?.qcId ?? 'QC?'
          }))
          const allDomains = new Set(data.map(i => {
            const last = i.action_key.lastIndexOf('_')
            return last > 0 ? i.action_key.slice(0, last) : i.action_key
          }))
          setExpandedQcs(allQcs)
          setExpandedDomains(allDomains)
        }
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [diagnosticId])

  const groups = groupByQc(items)

  const toggleQc = useCallback((qcId: string) => {
    setExpandedQcs(prev => {
      const next = new Set(prev)
      if (next.has(qcId)) next.delete(qcId)
      else next.add(qcId)
      return next
    })
  }, [])

  const toggleDomain = useCallback((domainId: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domainId)) next.delete(domainId)
      else next.add(domainId)
      return next
    })
  }, [])

  function downloadFile(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function downloadAll() {
    if (downloading || items.length === 0) return
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
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
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Pièces jointes — ISO 26000</h2>
              {!loading && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {items.length === 0
                    ? 'Aucune annexe'
                    : `${items.length} fichier${items.length > 1 ? 's' : ''} · ${groups.length} question${groups.length > 1 ? 's' : ''} centrale${groups.length > 1 ? 's' : ''}`}
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
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Ajoutez des fichiers via le panneau de notes du questionnaire.
              </p>
            </div>
          )}

          {!loading && !error && groups.map(qcGroup => (
            <div key={qcGroup.qcId} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${qcGroup.color}40` }}>
              {/* En-tête QC */}
              <button
                onClick={() => toggleQc(qcGroup.qcId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-80"
                style={{ backgroundColor: `${qcGroup.color}15` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold" style={{ color: qcGroup.color }}>
                    {qcGroup.qcId}
                  </div>
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {qcGroup.label}
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: qcGroup.color, color: 'white' }}>
                  {qcGroup.total}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {expandedQcs.has(qcGroup.qcId) ? '▲' : '▼'}
                </span>
              </button>

              {/* Domaines */}
              {expandedQcs.has(qcGroup.qcId) && (
                <div className="divide-y" style={{ borderTop: '1px solid var(--border)' }}>
                  {qcGroup.domains.map(domain => (
                    <div key={domain.domainId}>
                      {/* En-tête domaine */}
                      <button
                        onClick={() => toggleDomain(domain.domainId)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-80"
                        style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="text-sm">{domain.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {domain.domainId} — {domain.nom}
                          </div>
                        </div>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: `${domain.qcColor}20`, color: domain.qcColor }}>
                          {domain.total}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {expandedDomains.has(domain.domainId) ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Actions + fichiers */}
                      {expandedDomains.has(domain.domainId) && (
                        <div className="divide-y" style={{ borderTop: '1px solid var(--border)' }}>
                          {domain.actions.map(actionGroup => (
                            <div key={actionGroup.actionKey}>
                              <div className="px-4 py-2 text-xs font-medium"
                                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                                ▸ {actionGroup.actionLabel.length > 90
                                  ? actionGroup.actionLabel.slice(0, 90) + '…'
                                  : actionGroup.actionLabel}
                              </div>
                              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {actionGroup.annexes.map(annexe => (
                                  <button
                                    key={annexe.id}
                                    onClick={() => downloadFile(annexe.url, annexe.name)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-80 group"
                                    style={{ backgroundColor: 'var(--bg-card)' }}
                                    title={`Télécharger ${annexe.name}`}
                                  >
                                    <span className="text-lg flex-shrink-0">{mimeIcon(annexe.mime)}</span>
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
