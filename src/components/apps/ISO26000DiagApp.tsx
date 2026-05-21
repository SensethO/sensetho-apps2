'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { RseContext } from '@/components/rse/RseAppShell'
import ViewTabs from '@/components/rse/ViewTabs'

// ── Lazy annexes modal
const ISO26000AnnexesModal = dynamic(
  () => import('./ISO26000AnnexesModal'),
  { ssr: false, loading: () => null },
)

// ── Lazy note panel
const ISO26000NotePanel = dynamic(
  () => import('./GuidedActionNotePanel'),
  { ssr: false, loading: () => null },
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiagnosticRecord {
  id: string
  user_id: string
  organisation_id: string
  year: number
  scores: Record<string, number>
  action_progress: Record<string, number>
  action_na: Record<string, boolean>
  ai_analysis: string | null
  ai_scores: Record<string, number> | null
  ai_generated_at: string | null
  attachment_counter: number
}

interface ShareEntry {
  id: string
  permission: 'read' | 'edit'
  created_at: string
  profiles: { email: string; full_name: string | null } | null
}


interface ActionDomain {
  id: string
  isoRef: string
  nom: string
  description: string
  actions: string[]
  kpis: string[]
  ods: string[]
}

interface CoreSubject {
  id: string
  isoRef: string
  nom: string
  icone: string
  pilier: 'G' | 'E' | 'S'
  couleur: string
  description: string
  domaines: ActionDomain[]
}

// ─── Données ISO 26000 ────────────────────────────────────────────────────────

const SCORE_LABELS = ['Non évalué', 'Inexistant', 'Initié', 'En développement', 'Maîtrisé', 'Exemplaire']

const QC_PILIER_COLORS: Record<'G' | 'E' | 'S', string> = {
  G: '#60a5fa',
  E: '#4ade80',
  S: '#f87171',
}

const QC_LIST: CoreSubject[] = [
  {
    id: 'QC1', isoRef: '6.2', nom: "Gouvernance de l'organisation", icone: '🏛️', pilier: 'G', couleur: '#60a5fa',
    description: "Système par lequel une organisation prend ses décisions. Question centrale transversale — elle conditionne l'efficacité de toutes les autres.",
    domaines: [
      { id: 'DA1.1', isoRef: '6.2', nom: 'Gouvernance organisationnelle', description: "Mise en place de structures, processus et mécanismes permettant d'agir de façon responsable et transparente.", actions: ["Définir et formaliser les valeurs, vision et stratégie RSE","Identifier et cartographier les parties prenantes","Mettre en place des mécanismes de décision transparents","Établir un reporting RSE régulier (annuel au minimum)","Intégrer la RSE dans les objectifs stratégiques","Désigner un responsable RSE avec mandat officiel","Promouvoir la diversité dans les instances de décision","Évaluer et améliorer en continu les pratiques de gouvernance","Former les dirigeants aux enjeux de responsabilité sociétale","Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)"], kpis: ["Politique RSE formalisée (oui/non)","Score d'intégration RSE dans les objectifs (0-100%)","Fréquence du reporting RSE (nombre/an)","Part des administrateurs formés à la RSE (%)","Existence d'un comité RSE au niveau direction (oui/non)"], ods: ['ODD16', 'ODD17'] },
    ],
  },
  {
    id: 'QC2', isoRef: '6.3', nom: "Droits de l'Homme", icone: '🤝', pilier: 'S', couleur: '#f87171',
    description: "Obligation de respecter les droits de l'Homme universellement reconnus et d'éviter d'être complice de violations.",
    domaines: [
      { id: 'DA2.1', isoRef: '6.3.3', nom: 'Devoir de vigilance', description: "Identification et prévention des risques d'atteinte aux droits de l'Homme dans les activités et la chaîne d'approvisionnement.", actions: ["Cartographier les risques droits de l'Homme dans les activités et la chaîne d'approvisionnement","Mettre en place un plan de vigilance selon la loi Sapin 2 et les Principes directeurs ONU","Évaluer régulièrement les fournisseurs et partenaires sur le respect des droits de l'Homme","Définir des procédures de remédiation en cas d'atteinte identifiée","Former les équipes à la vigilance et à la détection des violations","Intégrer les droits de l'Homme dans les due diligences lors d'acquisitions"], kpis: ["Existence d'un plan de vigilance formalisé (oui/non)","Taux de fournisseurs stratégiques évalués sur les droits de l'Homme (%)","Nombre d'incidents droits de l'Homme identifiés et traités","Délai moyen de traitement des remontées (jours)"], ods: ['ODD16'] },
      { id: 'DA2.2', isoRef: '6.3.4', nom: "Situations à risque pour les droits de l'Homme", description: "Attention particulière aux zones de conflit, discrimination systémique ou absence d'État de droit.", actions: ["Analyser le contexte géographique et politique des activités dans les pays à risque","Éviter d'opérer dans des zones à très haut risque ou prendre des mesures renforcées","Collaborer avec des ONG locales et des experts en droits de l'Homme","Établir des mécanismes de signalement locaux accessibles aux communautés","Adapter les politiques RH aux contextes locaux tout en respectant les standards internationaux"], kpis: ["Cartographie des zones à risque (mise à jour annuellement)","Mesures de mitigation déployées par zone à risque","Incidents spécifiques aux zones à risque recensés"], ods: ['ODD16'] },
      { id: 'DA2.3', isoRef: '6.3.5', nom: 'Prévention de la complicité', description: "Éviter d'être directement ou indirectement complice de violations des droits de l'Homme.", actions: ["Adopter une politique tolérance zéro sur la complicité avec les violations des droits","Auditer régulièrement la chaîne de valeur pour détecter les risques de complicité","Intégrer des clauses contractuelles droits de l'Homme dans tous les contrats importants","Définir des critères droits de l'Homme dans les appels d'offres et la sélection des fournisseurs","Mettre fin aux partenariats en cas de violations graves non corrigées"], kpis: ["Taux de contrats avec clauses droits de l'Homme (%)","Nombre d'audits fournisseurs réalisés","Nombre de partenariats résiliés pour violations"], ods: ['ODD16'] },
      { id: 'DA2.4', isoRef: '6.3.6', nom: "Remédier aux atteintes aux droits de l'Homme", description: "Mécanismes permettant aux personnes affectées de signaler leurs préoccupations et d'obtenir réparation.", actions: ["Créer un mécanisme de réclamations accessible à toutes les parties prenantes affectées","Garantir la confidentialité et la protection des lanceurs d'alerte","Documenter et suivre systématiquement chaque réclamation reçue","Publier des rapports annuels sur le traitement des réclamations","Former les équipes à l'utilisation et à la gestion du mécanisme"], kpis: ["Existence d'un mécanisme de réclamations accessible (oui/non)","Délai moyen de traitement des réclamations (jours)","Taux de satisfaction des plaignants après résolution (%)","Nombre de réclamations reçues et résolues"], ods: ['ODD16'] },
      { id: 'DA2.5', isoRef: '6.3.7', nom: 'Discrimination et groupes vulnérables', description: "Prévention de toute forme de discrimination et protection spécifique des personnes appartenant à des groupes vulnérables.", actions: ["Adopter une politique de non-discrimination couvrant tous les critères légaux et éthiques","Mettre en place des actions positives pour les groupes sous-représentés","Former l'ensemble des managers à la lutte contre les discriminations et les biais inconscients","Réaliser des audits de rémunération réguliers pour détecter les inégalités","Mettre en place des aménagements raisonnables pour les personnes handicapées","Mesurer la diversité dans les recrutements, promotions et rémunérations"], kpis: ["Index égalité professionnelle Femmes/Hommes (score /100)","Taux d'emploi des personnes handicapées (%)","Actions disciplinaires pour discrimination (nombre)","Part des femmes dans les postes de direction (%)"], ods: ['ODD5', 'ODD10'] },
      { id: 'DA2.6', isoRef: '6.3.8', nom: 'Droits civils et politiques', description: "Respect de la liberté d'expression, de conscience, de réunion et d'association.", actions: ["Garantir la liberté d'expression au travail, y compris la possibilité de critiquer les pratiques","Protéger et promouvoir le droit d'association syndicale","Ne pas exercer de pression politique sur les employés ou parties prenantes","Protéger la vie privée des salariés dans le cadre du travail","Respecter la liberté de conscience et de religion dans le cadre du travail"], kpis: ["Liberté syndicale formellement reconnue (oui/non)","Charte de protection des données personnelles des salariés (oui/non)","Incidents de restriction de libertés civiles recensés"], ods: ['ODD16'] },
      { id: 'DA2.7', isoRef: '6.3.9', nom: 'Droits économiques, sociaux et culturels', description: "Droit au travail, à l'éducation, à la santé et à un niveau de vie suffisant.", actions: ["Assurer des rémunérations permettant un niveau de vie décent (au-delà du SMIC)","Favoriser la formation continue et le développement des compétences","Respecter et promouvoir le droit à la santé au travail et en dehors","Soutenir l'accès aux services essentiels pour les travailleurs et leurs familles","Respecter les traditions culturelles des communautés dans lesquelles l'organisation opère"], kpis: ["Rapport entre le salaire minimum interne et le salaire vital local","Budget de formation par salarié (€/an)","Taux d'accès à la protection sociale complète (%)"], ods: ['ODD1', 'ODD3', 'ODD4', 'ODD8'] },
      { id: 'DA2.8', isoRef: '6.3.10', nom: 'Principes fondamentaux et droits au travail', description: "Respect des conventions fondamentales de l'OIT.", actions: ["Garantir l'absence totale de travail forcé ou obligatoire dans l'organisation et sa chaîne","Interdire formellement le travail des enfants dans toute la chaîne de valeur","Promouvoir activement la liberté syndicale et la négociation collective","Assurer l'égalité de rémunération entre les femmes et les hommes pour un travail de valeur égale","Intégrer les conventions OIT dans les exigences contractuelles fournisseurs"], kpis: ["Zéro cas de travail forcé ou infantile constaté (objectif zéro)","Conformité déclarée aux conventions fondamentales de l'OIT","Écart de rémunération Femmes/Hommes à poste équivalent (%)"], ods: ['ODD8'] },
    ],
  },
  {
    id: 'QC3', isoRef: '6.4', nom: 'Relations et conditions de travail', icone: '👷', pilier: 'S', couleur: '#34d399',
    description: "Les relations et conditions de travail s'étendent au-delà des relations directes avec les propres employés pour inclure les sous-traitants et travailleurs indépendants.",
    domaines: [
      { id: 'DA3.1', isoRef: '6.4.3', nom: 'Emploi et relations employeur/employé', description: "Conditions d'embauche, de travail, de rémunération et de licenciement équitables.", actions: ["Établir des contrats de travail clairs conformes à la législation et aux conventions collectives","Assurer des rémunérations justes, équitables et en lien avec les qualifications","Mettre en place un processus de recrutement non discriminatoire et transparent","Définir des procédures de licenciement justes respectant les droits des travailleurs","Favoriser la stabilité de l'emploi en limitant le recours aux contrats précaires","Privilégier l'emploi local dans les zones où l'organisation opère"], kpis: ["Taux d'emplois stables (CDI en % de l'effectif total)","Ratio salaire médian interne / salaire minimum légal","Taux de turnover volontaire (%)","Délai moyen de pourvoi des postes (jours)"], ods: ['ODD8'] },
      { id: 'DA3.2', isoRef: '6.4.4', nom: 'Conditions de travail et protection sociale', description: "Temps de travail réglementaire, politiques de congés, protection sociale complète et équilibre vie professionnelle/vie personnelle.", actions: ["Respecter strictement les temps de travail légaux et conventionnels","Assurer une protection sociale complète (retraite, santé, prévoyance) pour tous","Proposer une politique de congés flexible adaptée aux besoins des salariés","Mettre en place une charte du droit à la déconnexion numérique","Faciliter le télétravail et les modes de travail flexibles","Accompagner le retour au travail post-congé maternité/paternité/parental"], kpis: ["Taux de couverture de la protection sociale complète (%)","Heures supplémentaires non compensées (objectif zéro)","Existence d'une charte de déconnexion numérique (oui/non)","Taux de recours au télétravail (%)"], ods: ['ODD3', 'ODD8'] },
      { id: 'DA3.3', isoRef: '6.4.5', nom: 'Dialogue social', description: "Consultation et négociation entre la direction et les représentants des travailleurs.", actions: ["Encourager activement la représentation syndicale et protéger les représentants élus","Tenir des réunions régulières et substantielles avec les représentants du personnel","Informer et consulter les salariés sur les décisions ayant un impact sur leur travail","Conclure des accords d'entreprise sur des sujets stratégiques","Réaliser des enquêtes régulières d'engagement et de satisfaction des employés"], kpis: ["Nombre d'accords d'entreprise signés dans l'année","Taux de participation aux élections professionnelles (%)","Score d'engagement salarié (enquête annuelle, /100)","Nombre de réunions CSE/représentants du personnel par an"], ods: ['ODD8'] },
      { id: 'DA3.4', isoRef: '6.4.6', nom: 'Santé et sécurité au travail', description: "Prévention des risques professionnels et promotion de la santé physique et mentale des travailleurs.", actions: ["Réaliser et mettre à jour régulièrement le Document Unique d'Évaluation des Risques (DUER)","Former l'ensemble des salariés aux gestes de premiers secours (SST)","Déployer une politique de prévention des risques psychosociaux (RPS) efficace","Assurer un suivi médical régulier et une médecine du travail de qualité","Viser la certification ISO 45001 (Santé et sécurité au travail)","Analyser systématiquement tous les accidents du travail et presqu'accidents","Réaliser des aménagements ergonomiques des postes de travail"], kpis: ["Taux de fréquence des accidents du travail (TF = accidents × 10⁶ / heures travaillées)","Taux de gravité des accidents du travail (TG)","Taux d'absentéisme maladie (%)","Jours de formation SST par salarié et par an","Score de bien-être au travail (enquête annuelle)"], ods: ['ODD3'] },
      { id: 'DA3.5', isoRef: '6.4.7', nom: 'Développement du capital humain', description: "Formation, développement des compétences, gestion des talents et évolution professionnelle.", actions: ["Mener des entretiens annuels et des entretiens professionnels de qualité","Élaborer et exécuter un plan de développement des compétences ambitieux","Encourager et faciliter la mobilité interne","Garantir l'accès à la formation continue et au CPF pour tous","Mettre en place un programme de mentorat et/ou de coaching","Évaluer en continu les besoins en compétences futures (GPEC/GEPP)"], kpis: ["Heures de formation par salarié par an","Budget formation en % de la masse salariale","Taux de réalisation des entretiens professionnels (%)","Taux de promotion interne (% des postes pourvus en interne)"], ods: ['ODD4', 'ODD8'] },
    ],
  },
  {
    id: 'QC4', isoRef: '6.5', nom: 'Environnement', icone: '🌱', pilier: 'E', couleur: '#4ade80',
    description: "L'ISO 26000 reconnaît que les organisations ont une responsabilité envers l'environnement qui va au-delà des obligations réglementaires.",
    domaines: [
      { id: 'DA4.1', isoRef: '6.5.3', nom: 'Prévention de la pollution', description: "Identification et réduction des émissions polluantes dans l'air, l'eau et les sols.", actions: ["Réaliser un bilan complet des émissions polluantes (air, eau, sol, déchets)","Mettre en place et investir dans des technologies propres et moins polluantes","Réduire progressivement l'utilisation des substances dangereuses","Gérer et valoriser les déchets selon la hiérarchie de gestion des déchets","Traiter les effluents avant tout rejet dans l'environnement","Viser et maintenir la certification ISO 14001 (Management environnemental)","Former l'ensemble des collaborateurs aux bonnes pratiques environnementales"], kpis: ["Quantité totale de déchets produits (tonnes/an)","Taux de valorisation des déchets (recyclage + compostage + valorisation énergétique, %)","Émissions polluantes mesurées (NOx, SOx, COV, etc.)","Nombre d'incidents environnementaux (déversements, pollutions…)"], ods: ['ODD6', 'ODD14', 'ODD15'] },
      { id: 'DA4.2', isoRef: '6.5.4', nom: 'Utilisation durable des ressources', description: "Réduction de la consommation de ressources naturelles non renouvelables et promotion de l'économie circulaire.", actions: ["Réaliser un bilan énergétique complet et définir un plan de réduction","Améliorer l'efficacité énergétique des bâtiments, équipements et processus","Installer des sources d'énergie renouvelable sur les sites","Mesurer et réduire la consommation d'eau et gérer les eaux usées","Intégrer l'éco-conception dans le développement des produits et services","Optimiser les achats en favorisant les circuits courts et les produits durables","Déployer une démarche d'économie circulaire (réparation, réemploi, recyclage)","Viser la certification ISO 50001 (Management de l'énergie)"], kpis: ["Consommation d'énergie totale (MWh/an et MWh/unité produite)","Part des énergies renouvelables dans la consommation totale (%)","Consommation d'eau (m³/an et m³/unité produite)","Taux de matières recyclées ou issues du recyclage (%)","Intensité énergétique (énergie/chiffre d'affaires)"], ods: ['ODD6', 'ODD7', 'ODD12'] },
      { id: 'DA4.3', isoRef: '6.5.5', nom: 'Atténuation des changements climatiques et adaptation', description: "Réduction des émissions de GES et adaptation aux impacts inévitables du changement climatique.", actions: ["Réaliser un Bilan Carbone® complet couvrant les scopes 1, 2 et 3","Définir une trajectoire de réduction ambitieuse alignée sur les Accords de Paris","Élaborer et mettre en œuvre un plan de transition bas-carbone","Compenser les émissions résiduelles par des projets de séquestration carbone vérifiés","Analyser les risques et opportunités climatiques selon le cadre TCFD","Réduire les déplacements professionnels et développer les alternatives","Adopter une politique d'achats bas-carbone sur toute la chaîne de valeur"], kpis: ["Empreinte carbone totale (tCO₂e/an, scopes 1+2+3)","Taux de réduction des émissions vs année de référence (%)","Budget annuel dédié à la transition énergétique (€)","Score d'alignement SBTi (Science Based Targets initiative)","Part des émissions scope 3 mesurées (%)"], ods: ['ODD13'] },
      { id: 'DA4.4', isoRef: '6.5.6', nom: "Protection de l'environnement, biodiversité et habitats naturels", description: "Préservation et restauration de la biodiversité et des écosystèmes naturels.", actions: ["Réaliser un diagnostic de biodiversité sur tous les sites d'activité","Appliquer systématiquement la séquence ERC (Éviter-Réduire-Compenser)","Adopter une politique zéro déforestation dans les achats","Végétaliser les sites et favoriser la biodiversité locale","Engager des programmes de restauration écologique","Évaluer les dépendances écosystémiques selon le cadre TNFD"], kpis: ["Superficie d'habitats impactés puis restaurés (ha)","Score de biodiversité des sites (BBNaturaScore ou équivalent)","Part des achats conformes à la politique zéro déforestation (%)","Espèces protégées présentes sur les sites (nombre)"], ods: ['ODD14', 'ODD15'] },
    ],
  },
  {
    id: 'QC5', isoRef: '6.6', nom: 'Loyauté des pratiques', icone: '⚖️', pilier: 'G', couleur: '#fbbf24',
    description: "La loyauté des pratiques concerne le comportement éthique de l'organisation dans ses relations avec d'autres organisations.",
    domaines: [
      { id: 'DA5.1', isoRef: '6.6.3', nom: 'Lutte contre la corruption', description: "Prévention et combat contre toutes formes de corruption active ou passive, d'extorsion et de détournement de fonds.", actions: ["Adopter et diffuser un code éthique et une politique anti-corruption clairs","Déployer un programme de conformité anti-corruption (mapping risques, contrôles, procédures)","Former régulièrement les collaborateurs exposés aux risques de corruption","Mettre en place un dispositif de signalement des alertes éthiques protégé","Réaliser des audits internes anti-corruption périodiques","Évaluer les risques de corruption chez les tiers (fournisseurs, agents, intermédiaires)"], kpis: ["Existence d'un programme anti-corruption certifié (ex. ISO 37001 - oui/non)","Taux de formation des collaborateurs exposés (%)","Nombre de signalements éthiques traités","Incidents de corruption détectés et sanctionnés"], ods: ['ODD16'] },
      { id: 'DA5.2', isoRef: '6.6.4', nom: 'Engagement politique responsable', description: "Participation responsable et transparente à la vie politique et aux politiques publiques.", actions: ["Adopter une politique de transparence dans les relations avec les institutions publiques","Déclarer les représentants d'intérêts dans les registres officiels","Éviter tout financement politique opaque ou contraire à l'éthique","Participer aux consultations publiques de manière transparente et constructive"], kpis: ["Contributions politiques déclarées (montant total)","Inscription au registre des lobbyistes (oui/non)","Existence d'une politique de lobbying responsable formalisée (oui/non)"], ods: ['ODD16'] },
      { id: 'DA5.3', isoRef: '6.6.5', nom: 'Concurrence loyale', description: "Respect des règles de la concurrence et refus de participer à des pratiques anticoncurrentielles.", actions: ["Former régulièrement les équipes commerciales et achats au droit de la concurrence","Déployer un programme de conformité antitrust avec des procédures claires","Refuser systématiquement les accords de fixation de prix ou de partage de marchés","Éviter tout abus de position dominante vis-à-vis des clients et fournisseurs","Mettre en place un système de veille et de détection des comportements anticoncurrentiels"], kpis: ["Programme de conformité antitrust formalisé (oui/non)","Litiges liés à la concurrence en cours (nombre)","Taux de formation des équipes concernées (%)"], ods: ['ODD16'] },
      { id: 'DA5.4', isoRef: '6.6.6', nom: 'Promotion de la RSE dans la chaîne de valeur', description: "Encouragement et accompagnement des fournisseurs, partenaires et sous-traitants à adopter des pratiques responsables.", actions: ["Intégrer des critères RSE formels dans les appels d'offres et la sélection des fournisseurs","Évaluer régulièrement les fournisseurs stratégiques sur leurs pratiques RSE","Accompagner concrètement les fournisseurs dans le développement de leur démarche RSE","Favoriser les achats locaux, équitables et durables","Publier et diffuser une politique d'achats responsables ambitieuse"], kpis: ["Part des achats couverts par une évaluation RSE fournisseurs (%)","Part des achats locaux et/ou durables (%)","Score moyen RSE des fournisseurs stratégiques"], ods: ['ODD12', 'ODD17'] },
      { id: 'DA5.5', isoRef: '6.6.7', nom: 'Respect des droits de propriété', description: "Respect de la propriété intellectuelle, des droits d'auteur, des brevets et du patrimoine.", actions: ["Adopter une politique formelle de respect de la propriété intellectuelle","Former les équipes R&D, marketing et achats aux droits de propriété intellectuelle","Respecter strictement les licences logicielles et les droits d'auteur","Mettre en place des procédures pour éviter l'usage non autorisé de brevets tiers"], kpis: ["Litiges liés à la propriété intellectuelle en cours (nombre)","Taux de conformité des licences logicielles (%)"], ods: ['ODD9'] },
    ],
  },
  {
    id: 'QC6', isoRef: '6.7', nom: 'Questions relatives aux consommateurs', icone: '🛒', pilier: 'S', couleur: '#c084fc',
    description: "Responsabilités envers les consommateurs : information précise, sécurité des produits et services, promotion de la consommation durable, résolution des litiges, protection des données personnelles.",
    domaines: [
      { id: 'DA6.1', isoRef: '6.7.3', nom: "Pratiques loyales en matière de commercialisation, d'informations et de contrats", description: "Honnêteté, transparence et loyauté dans la communication commerciale, la publicité et les contrats.", actions: ["Garantir la véracité, la clarté et l'objectivité des allégations publicitaires","Éviter d'inclure des clauses contractuelles abusives dans les contrats","Fournir des informations complètes et transparentes sur les produits et services","Lutter activement contre le greenwashing et les allégations environnementales trompeuses","Informer clairement sur les prix, les conditions et les engagements"], kpis: ["Nombre de plaintes pour pratiques commerciales trompeuses","Score de satisfaction client sur la clarté de l'information (%)","Résultats d'audit des pratiques marketing (taux de conformité)"], ods: ['ODD12'] },
      { id: 'DA6.2', isoRef: '6.7.4', nom: 'Protection de la santé et de la sécurité des consommateurs', description: "Garantie que les produits et services ne présentent pas de risques pour la santé ou la sécurité.", actions: ["Mettre en place et certifier un système de management de la qualité (ISO 9001)","Réaliser des analyses de risques complètes sur tous les produits et services","Définir et tester des procédures de retrait et de rappel de produits","Communiquer clairement sur les risques d'utilisation et les précautions à prendre","Suivre et analyser systématiquement les incidents consommateurs liés à la sécurité"], kpis: ["Nombre de rappels produits dans l'année","Nombre d'incidents consommateurs liés à la sécurité","Délai moyen de traitement des réclamations sécurité (jours)","Taux de satisfaction qualité produit/service (%)"], ods: ['ODD3'] },
      { id: 'DA6.3', isoRef: '6.7.5', nom: 'Consommation durable', description: "Promotion de modes de consommation durables en offrant des alternatives responsables.", actions: ["Développer et promouvoir des alternatives éco-responsables dans l'offre","Intégrer l'éco-conception dès le début du développement des produits","Informer les consommateurs sur l'impact environnemental et social des produits","Faciliter et encourager la réparation, le réemploi et le recyclage","Mettre en place un affichage environnemental des produits"], kpis: ["Part des produits éco-conçus dans l'offre totale (%)","Taux de recyclabilité moyen des produits (%)","Produits disposant d'un affichage environnemental certifié (nombre/%)"], ods: ['ODD12'] },
      { id: 'DA6.4', isoRef: '6.7.6', nom: 'Service après-vente, assistance et résolution des réclamations', description: "Accessibilité et efficacité des services client, des mécanismes de traitement des plaintes.", actions: ["Offrir un service client accessible, réactif et multicanal (téléphone, email, chat, boutique)","Définir et appliquer des procédures claires de gestion des réclamations","Former régulièrement les équipes à l'excellence de la relation client","Mesurer et améliorer en continu la satisfaction (NPS, CSAT, CES)","Proposer et promouvoir des modes alternatifs de résolution des litiges (médiation)"], kpis: ["Net Promoter Score (NPS)","Délai moyen de résolution des réclamations (heures/jours)","Taux de réclamations résolues dès le premier contact (%)","Score de satisfaction client global (CSAT, /10 ou %)"], ods: ['ODD10'] },
      { id: 'DA6.5', isoRef: '6.7.7', nom: 'Protection des données et de la vie privée des consommateurs', description: "Respect de la confidentialité et protection des données personnelles des consommateurs. Conformité RGPD.", actions: ["Assurer la pleine conformité au RGPD et aux réglementations applicables","Nommer un Délégué à la Protection des Données (DPO) qualifié","Réaliser des Analyses d'Impact sur la Protection des Données (AIPD/DPIA) pour les traitements à risque","Mettre en place des mesures de sécurité informatique robustes (chiffrement, accès, audits)","Informer clairement et simplement les consommateurs sur l'utilisation de leurs données","Permettre et faciliter l'exercice effectif des droits RGPD"], kpis: ["Score de conformité RGPD (audit annuel, %)","Nombre de violations de données notifiées à la CNIL","Délai moyen de réponse aux demandes d'exercice de droits RGPD (jours)","Plaintes reçues relatives à la vie privée"], ods: ['ODD16'] },
      { id: 'DA6.6', isoRef: '6.7.8', nom: 'Accès aux services essentiels', description: "Facilitation de l'accès des populations vulnérables aux services essentiels.", actions: ["Proposer des tarifs accessibles ou des dispositifs spécifiques pour les publics vulnérables","Assurer l'accessibilité physique et numérique pour les personnes handicapées (RGAA)","Participer aux programmes d'accès universel aux services essentiels","Adapter les conditions de paiement pour faciliter l'accès"], kpis: ["Existence de tarifs sociaux ou de dispositifs d'accessibilité (oui/non)","Score d'accessibilité numérique (RGAA ou WCAG, %)","Nombre de bénéficiaires des dispositifs d'inclusion"], ods: ['ODD10'] },
      { id: 'DA6.7', isoRef: '6.7.9', nom: 'Éducation et sensibilisation', description: "Contribution à l'information et à l'éducation des consommateurs pour leur permettre de faire des choix éclairés.", actions: ["Produire et diffuser des contenus éducatifs sur l'utilisation responsable des produits","Développer des programmes d'éducation à la consommation durable","Communiquer activement sur les enjeux environnementaux et sociaux liés à l'offre"], kpis: ["Nombre de contenus éducatifs produits et diffusés","Audience et portée des programmes d'éducation","Part des consommateurs se déclarant bien informés (%)"], ods: ['ODD4', 'ODD12'] },
    ],
  },
  {
    id: 'QC7', isoRef: '6.8', nom: 'Communautés et développement local', icone: '🏘️', pilier: 'S', couleur: '#22d3ee',
    description: "Les organisations ont une relation avec les communautés au sein desquelles elles opèrent. La norme encourage l'implication active dans le développement local.",
    domaines: [
      { id: 'DA7.1', isoRef: '6.8.3', nom: 'Implication auprès des communautés', description: "Engagement proactif et dialogue continu avec les communautés locales.", actions: ["Organiser des consultations régulières avec les riverains et parties prenantes locales","Participer activement aux instances de concertation et de gouvernance locale","Mettre en place un mécanisme accessible de traitement des plaintes communautaires","Communiquer de manière transparente et régulière sur les impacts locaux de l'activité"], kpis: ["Nombre de consultations communautaires organisées par an","Nombre de partenariats actifs avec des acteurs locaux","Délai moyen de traitement des plaintes communautaires (jours)"], ods: ['ODD11', 'ODD17'] },
      { id: 'DA7.2', isoRef: '6.8.4', nom: 'Éducation et culture', description: "Soutien à l'éducation, à la formation professionnelle et à la préservation du patrimoine culturel local.", actions: ["Financer ou co-financer des programmes d'éducation locale","Proposer des stages, apprentissages et alternances en priorité aux jeunes locaux","Soutenir des projets culturels, artistiques et patrimoniaux locaux","Développer des partenariats durables avec les établissements scolaires locaux"], kpis: ["Nombre d'alternants et stagiaires accueillis (en priorité locaux)","Montant des investissements en éducation locale (€/an)","Partenariats actifs avec des établissements d'enseignement locaux"], ods: ['ODD4'] },
      { id: 'DA7.3', isoRef: '6.8.5', nom: "Création d'emplois et développement des compétences", description: "Contribution à l'emploi local et au développement des compétences au niveau territorial.", actions: ["Favoriser systématiquement le recrutement local pour tous les postes","Travailler en partenariat avec France Travail, missions locales et acteurs de l'emploi","Soutenir des initiatives d'insertion professionnelle pour les publics éloignés de l'emploi","Intégrer des clauses d'insertion dans les marchés publics et privés","Contribuer aux GPEC territoriales"], kpis: ["Part des recrutements locaux (% de l'ensemble des recrutements)","Nombre de personnes accompagnées vers l'emploi","Heures d'insertion professionnelle réalisées"], ods: ['ODD8'] },
      { id: 'DA7.4', isoRef: '6.8.6', nom: 'Développement des technologies et accès à la technologie', description: "Contribution au développement technologique local et réduction de la fracture numérique.", actions: ["Partager les technologies, savoir-faire et innovations avec les acteurs locaux","Soutenir l'innovation sociale et technologique locale","Contribuer à réduire la fracture numérique (formation, équipements, accès)","Participer à des clusters locaux et à des écosystèmes d'innovation"], kpis: ["Technologies ou brevets partagés localement (nombre)","Personnes formées au numérique par l'organisation (nombre/an)","Montant des investissements en R&D collaborative locale (€)"], ods: ['ODD9'] },
      { id: 'DA7.5', isoRef: '6.8.7', nom: 'Création de richesses et de revenus', description: "Impact positif sur la valeur économique créée et distribuée au niveau du territoire.", actions: ["Privilégier les fournisseurs et sous-traitants locaux dans les achats","Mesurer et communiquer la valeur économique créée et distribuée localement","Soutenir activement les TPE/PME locales par des partenariats durables"], kpis: ["Part des achats auprès de fournisseurs locaux (%)","Valeur économique distribuée localement (salaires + achats locaux + impôts, €/an)","Nombre de PME/TPE locales soutenues"], ods: ['ODD1', 'ODD8', 'ODD10'] },
      { id: 'DA7.6', isoRef: '6.8.8', nom: 'La santé', description: "Contribution à la santé publique et au bien-être des communautés locales.", actions: ["Soutenir des associations et initiatives de santé locales","Développer des programmes de mécénat social liés à la santé","Participer à des campagnes de santé publique (prévention, dépistage…)","Contribuer au développement ou au maintien des infrastructures de santé locales"], kpis: ["Montant du mécénat social lié à la santé (€/an)","Bénéficiaires des programmes de santé soutenus par l'organisation","Associations partenaires actives dans le domaine de la santé"], ods: ['ODD3'] },
      { id: 'DA7.7', isoRef: '6.8.9', nom: 'Investissement à impact social', description: "Engagements dans des investissements qui génèrent un impact social positif et mesurable.", actions: ["Mesurer et communiquer l'impact social de l'organisation (méthode SROI ou équivalent)","Développer des partenariats stratégiques avec des acteurs de l'ESS","Intégrer des critères d'impact social dans la stratégie d'investissement","Soutenir des initiatives de développement communautaire à fort impact"], kpis: ["Retour Social sur Investissement (SROI - ratio)","Montant total des investissements à impact social (€/an)","Projets ESS actifs soutenus par l'organisation"], ods: ['ODD1', 'ODD10', 'ODD17'] },
    ],
  },
]

// Flat list of all domains
const ALL_DOMAINS = QC_LIST.flatMap(qc => qc.domaines)

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function actionKey(domainId: string, actionIndex: number) {
  return `${domainId}_${actionIndex}`
}

function computeSuggestedScore(domain: ActionDomain, progress: Record<string, number>, na: Record<string, boolean>): number {
  const values = domain.actions
    .map((_, i) => ({ key: actionKey(domain.id, i), v: progress[actionKey(domain.id, i)] ?? 0 }))
    .filter(({ key }) => !na[key])
    .map(({ v }) => v)
  if (values.length === 0) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  if (avg >= 9.5) return 5
  if (avg >= 7.5) return 4
  if (avg >= 5.5) return 3
  if (avg >= 3.5) return 2
  if (avg >= 1)   return 1
  return 0
}

function getQcScore(qc: CoreSubject, scores: Record<string, number>): number {
  const scored = qc.domaines.filter(d => (scores[d.id] ?? 0) > 0)
  if (scored.length === 0) return 0
  return scored.reduce((acc, d) => acc + scores[d.id], 0) / scored.length
}

function getGlobalScore(scores: Record<string, number>): number {
  const scored = ALL_DOMAINS.filter(d => (scores[d.id] ?? 0) > 0)
  if (scored.length === 0) return 0
  return Math.round((scored.reduce((acc, d) => acc + scores[d.id], 0) / (scored.length * 5)) * 100)
}

// ─── ODD colors ──────────────────────────────────────────────────────────────

const ODD_COLORS: Record<string, string> = {
  ODD1: '#E5243B', ODD2: '#DDA63A', ODD3: '#4C9F38', ODD4: '#C5192D', ODD5: '#FF3A21',
  ODD6: '#26BDE2', ODD7: '#FCC30B', ODD8: '#A21942', ODD9: '#FD6925', ODD10: '#DD1367',
  ODD11: '#FD9D24', ODD12: '#BF8B2E', ODD13: '#3F7E44', ODD14: '#0A97D9', ODD15: '#56C02B',
  ODD16: '#00689D', ODD17: '#19486A',
}

// ─── ViewTabs ─────────────────────────────────────────────────────────────────

const ISO_TABS = [
  { id: 'intro'     as const, label: 'Présentation',    icon: '📋' },
  { id: 'dashboard' as const, label: 'Tableau de bord', icon: '🎯' },
  { id: 'summary'   as const, label: 'Synthèse',        icon: '📊' },
  { id: 'step'      as const, label: 'Questionnaire',   icon: '📝' },
] as const
type IsoView = typeof ISO_TABS[number]['id']

// ─── Radar SVG (7 axes = 7 QC) ───────────────────────────────────────────────

function RadarChart({ scores }: { scores: Record<string, number> }) {
  const N = QC_LIST.length
  const R = 120
  const cx = 150, cy = 155
  const qcScores = QC_LIST.map(qc => getQcScore(qc, scores) / 5) // 0-1
  const angleStep = (2 * Math.PI) / N
  const startAngle = -Math.PI / 2

  function polarToXY(r: number, i: number) {
    const angle = startAngle + i * angleStep
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const rings = [1, 2, 3, 4, 5].map(level => {
    const r = (level / 5) * R
    const pts = Array.from({ length: N }, (_, i) => polarToXY(r, i))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
  })

  const dataPath = qcScores.map((v, i) => {
    const { x, y } = polarToXY(v * R, i)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') + ' Z'

  return (
    <svg viewBox="0 0 300 310" className="w-full max-w-xs mx-auto">
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeOpacity={0.1} />
      ))}
      {Array.from({ length: N }, (_, i) => {
        const outer = polarToXY(R, i)
        return <line key={i} x1={cx} y1={cy} x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)} stroke="currentColor" strokeOpacity={0.15} />
      })}
      <path d={dataPath} fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth={2} />
      {QC_LIST.map((qc, i) => {
        const label = polarToXY(R + 22, i)
        const dot = polarToXY(qcScores[i] * R, i)
        return (
          <g key={qc.id}>
            <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>{qc.icone}</text>
            <circle cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r={4} fill="#6366f1" />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Share Modal (inline minimal) ────────────────────────────────────────────

function ShareModal({ diagnosticId, onClose }: { diagnosticId: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'read' | 'edit'>('read')
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'sending' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch(`/api/iso26000-diagnostic/${diagnosticId}/shares`)
      .then(r => r.json())
      .then(j => { setShares(j.data ?? []); setStatus('idle') })
      .catch(() => setStatus('idle'))
  }, [diagnosticId])

  async function handleShare() {
    if (!email.trim()) return
    setStatus('sending'); setErrorMsg('')
    const res = await fetch(`/api/iso26000-diagnostic/${diagnosticId}/shares`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), permission }),
    })
    const j = await res.json()
    if (!res.ok) { setErrorMsg(j.error ?? 'Erreur'); setStatus('idle') }
    else { setShares(prev => [...prev, j.data]); setEmail(''); setStatus('idle') }
  }

  async function handleRevoke(shareId: string) {
    await fetch(`/api/iso26000-diagnostic/${diagnosticId}/shares?share_id=${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Partager ce diagnostic</h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email de l'utilisateur" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }} />
          <select value={permission} onChange={e => setPermission(e.target.value as 'read' | 'edit')} className="px-2 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
            <option value="read">Lecture</option>
            <option value="edit">Édition</option>
          </select>
          <button onClick={handleShare} disabled={status === 'sending'} className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent, #6366f1)' }}>Inviter</button>
        </div>
        {errorMsg && <p className="text-xs text-red-500 mb-3">{errorMsg}</p>}
        {status === 'loading' ? (
          <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
        ) : shares.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucun partage actif</p>
        ) : (
          <div className="space-y-2">
            {shares.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div style={{ color: 'var(--text)' }}>{s.profiles?.email ?? '—'}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.permission === 'edit' ? 'Édition' : 'Lecture'}</div>
                </div>
                <button onClick={() => handleRevoke(s.id)} className="text-xs text-red-500 hover:underline">Révoquer</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ISO26000DiagApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions } = ctx

  const [view, setView]           = useState<IsoView>('intro')
  const [diagnostic, setDiag]     = useState<DiagnosticRecord | null>(null)
  const [loadingDiag, setLoading] = useState(false)
  const [isOwner, setIsOwner]     = useState(true)
  const [saveStatus, setSave]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [selectedDomain, setSelectedDomain] = useState<ActionDomain | null>(null)
  const [expandedQc, setExpandedQc]         = useState<Set<string>>(new Set(['QC1']))
  const [showShare, setShowShare]   = useState(false)
  const [showAnnexes, setShowAnnexes] = useState(false)
  const [generatingAI, setGenAI]    = useState(false)
  const [noteMap, setNoteMap]         = useState<Record<string, unknown[]>>({})
  const [noteTextMap, setNoteTextMap] = useState<Record<string, string>>({})
  const [notesRemoteVersion, setNotesRemoteVersion] = useState(0)
  const notesSaveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Load / create diagnostic ───────────────────────────────────────────────
  useEffect(() => {
    if (!org || !year) return
    setLoading(true); setDiag(null)
    const supabase = createClient()

    async function load() {
      // Load existing
      const res = await fetch(`/api/iso26000-diagnostic?org_id=${org!.id}&year=${year}`)
      const j = await res.json()
      if (j.data) {
        setDiag(j.data); setIsOwner(j.isOwner ?? true)
        setLoading(false); return
      }
      // Create
      const cr = await fetch('/api/iso26000-diagnostic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org!.id, year }),
      })
      const cj = await cr.json()
      if (cj.data) { setDiag(cj.data); setIsOwner(true) }
      setLoading(false)
    }

    load()

    // Realtime sync
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(`iso26000-diag:${org.id}:${year}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'iso26000_diagnostics', filter: `organisation_id=eq.${org.id}` },
          (payload: { new: Record<string, unknown> }) => {
            const rec = payload.new as unknown as DiagnosticRecord
            if (rec.year === year) setDiag(rec)
          }
        ).subscribe((_s: string, err?: Error) => { if (err) console.warn('[ISO26000] realtime:', err) })
    } catch { /* non-fatal */ }

    return () => { if (channel) { try { supabase.removeChannel(channel) } catch { /* */ } } }
  }, [org, year])

  // ── Auto-select first domain when entering questionnaire ───────────────────
  useEffect(() => {
    if (view === 'step' && !selectedDomain) {
      setSelectedDomain(QC_LIST[0].domaines[0])
      setExpandedQc(new Set(['QC1']))
    }
  }, [view, selectedDomain])

  // ── Load notes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!diagnostic) return
    fetch(`/api/iso26000-diagnostic/${diagnostic.id}/notes`)
      .then(r => r.json())
      .then(j => {
      if (j.data?.sections) setNoteMap(j.data.sections)
      if (j.data?.notes)    setNoteTextMap(j.data.notes)
      setNotesRemoteVersion(v => v + 1)
    })
      .catch(() => { /* */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic?.id])

  // ── Save scores/progress/na (debounced) ────────────────────────────────────
  const schedSave = useCallback((patch: Partial<DiagnosticRecord>) => {
    if (!diagnostic || !isOwner) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSave('saving')
    saveTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/iso26000-diagnostic/${diagnostic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setSave(res.ok ? 'saved' : 'error')
      setTimeout(() => setSave('idle'), 2000)
      // Sync overlapping domain scores to guided_diagnostics
      if (patch.scores && org && year) {
        fetch('/api/sync-diagnostic-scores', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org.id, year, source: 'iso26000' }),
        }).catch(() => {})
      }
    }, 800)
  }, [diagnostic, isOwner, org, year])

  const saveNoteText = useCallback((key: string, value: string) => {
    if (!diagnostic || !isOwner) return
    const existing = notesSaveTimerRef.current.get(key)
    if (existing) clearTimeout(existing)
    const t = setTimeout(async () => {
      await fetch(`/api/iso26000-diagnostic/${diagnostic.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: key, content: value }),
      })
      notesSaveTimerRef.current.delete(key)
    }, 800)
    notesSaveTimerRef.current.set(key, t)
  }, [diagnostic, isOwner])

  const setScore = useCallback((domainId: string, score: number) => {
    setDiag(prev => {
      if (!prev) return prev
      const next = { ...prev, scores: { ...prev.scores, [domainId]: score } }
      schedSave({ scores: next.scores })
      return next
    })
  }, [schedSave])

  const setActionProgress = useCallback((key: string, value: number) => {
    setDiag(prev => {
      if (!prev) return prev
      const next = { ...prev, action_progress: { ...prev.action_progress, [key]: value } }
      schedSave({ action_progress: next.action_progress })
      return next
    })
  }, [schedSave])

  const setActionNa = useCallback((key: string, checked: boolean) => {
    setDiag(prev => {
      if (!prev) return prev
      const next = { ...prev, action_na: { ...prev.action_na, [key]: checked } }
      schedSave({ action_na: next.action_na })
      return next
    })
  }, [schedSave])

  // ── AI Analysis ───────────────────────────────────────────────────────────
  async function handleGenAI() {
    if (!diagnostic) return
    setGenAI(true)
    try {
      const res = await fetch(`/api/iso26000-diagnostic/${diagnostic.id}/analyze`, { method: 'POST' })
      const j = await res.json()
      if (j.data) setDiag(prev => prev ? { ...prev, ai_analysis: j.data.ai_analysis, ai_scores: j.data.ai_scores, ai_generated_at: j.data.ai_generated_at } : prev)
    } catch { /* */ } finally { setGenAI(false) }
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  function handleExportExcel() {
    if (!diagnostic) return
    window.open(`/api/iso26000-diagnostic/${diagnostic.id}/export-excel`, '_blank')
  }

  // ── Header actions ─────────────────────────────────────────────────────────
  useEffect(() => {
    setActions(
      <div className="flex items-center gap-2 flex-wrap">
        {saveStatus !== 'idle' && (
          <span className="text-xs" style={{ color: saveStatus === 'error' ? '#ef4444' : 'var(--text-muted)' }}>
            {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'saved' ? 'Enregistré ✓' : 'Erreur ✗'}
          </span>
        )}
        {diagnostic && isOwner && (
          <>
            <button onClick={handleExportExcel} className="px-3 py-1.5 text-xs rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Excel</button>
            <button disabled className="px-3 py-1.5 text-xs rounded-lg border transition-colors opacity-40 cursor-not-allowed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>PDF</button>
            <button onClick={() => setShowAnnexes(true)} className="px-3 py-1.5 text-xs rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annexes</button>
            <button onClick={() => setShowShare(true)} className="px-3 py-1.5 text-xs rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Partager</button>
          </>
        )}
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, isOwner, saveStatus, view])

  // ── Computed values ────────────────────────────────────────────────────────
  const scores         = diagnostic?.scores ?? {}
  const actionProgress = diagnostic?.action_progress ?? {}
  const actionNa       = diagnostic?.action_na ?? {}
  const evalCount      = ALL_DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).length
  const globalScore    = getGlobalScore(scores)

  // ── VUE INTRO ──────────────────────────────────────────────────────────────
  if (view === 'intro') {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #312e81 100%)' }}>
          <div className="relative z-10">
            <div className="text-5xl mb-4">🔍</div>
            <h1 className="text-3xl font-bold mb-3">Diagnostic RSE ISO 26000</h1>
            <p className="text-lg text-white/90 max-w-2xl leading-relaxed">
              Évaluez la maturité RSE de votre organisation sur l&apos;ensemble des 37 domaines d&apos;action de la norme ISO 26000, organisés en 7 questions centrales. Obtenez un diagnostic complet, des recommandations et un plan d&apos;actions.
            </p>
            {org && (
              <div className="mt-6 flex gap-3 flex-wrap">
                <button onClick={() => setView('dashboard')} className="px-5 py-2.5 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors">🎯 Tableau de bord</button>
                <button onClick={() => setView('step')} className="px-5 py-2.5 bg-white font-semibold rounded-lg hover:bg-indigo-50 transition-colors" style={{ color: '#4f46e5' }}>
                  📝 {evalCount > 0 ? 'Continuer l\'évaluation' : 'Commencer l\'évaluation'}
                </button>
              </div>
            )}
          </div>
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Questions centrales', value: '7', icon: '📚', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Domaines d\'action', value: '37', icon: '🎯', color: 'text-purple-600 dark:text-purple-400' },
            { label: 'ODD couverts', value: '17', icon: '🌍', color: 'text-green-600 dark:text-green-400' },
            { label: 'Niveaux de maturité', value: '5', icon: '⭐', color: 'text-amber-600 dark:text-amber-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Les 7 Questions Centrales */}
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>Les 7 questions centrales ISO 26000</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {QC_LIST.map(qc => {
              const qcScore = getQcScore(qc, scores)
              const qcEval = qc.domaines.filter(d => (scores[d.id] ?? 0) > 0).length
              return (
                <div key={qc.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${qc.couleur}22` }}>{qc.icone}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{qc.nom}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{qc.domaines.length} domaines</div>
                    </div>
                  </div>
                  {qcEval > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                        <span>{qcEval}/{qc.domaines.length} évalués</span>
                        <span>{qcScore.toFixed(1)}/5</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(qcScore/5)*100}%`, backgroundColor: qc.couleur }} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>{qc.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Niveaux de maturité */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Niveaux de maturité</h3>
          <div className="grid sm:grid-cols-5 gap-3">
            {SCORE_LABELS.slice(1).map((label, i) => {
              const colors = ['#94a3b8', '#fb923c', '#facc15', '#34d399', '#6366f1']
              return (
                <div key={label} className="text-center">
                  <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white font-bold text-sm mb-1" style={{ backgroundColor: colors[i] }}>{i+1}</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation vers autres apps RSE */}
        <div className="rounded-2xl p-5 border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Applications RSE liées</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/rse/diagnostic-initial" className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:opacity-80" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xl">📋</span>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Diagnostic initial guidé RSE</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Évaluez rapidement vos 13 domaines prioritaires ISO 26000</div>
              </div>
            </Link>
            <Link href="/rse/odd-iso26000" className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:opacity-80" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xl">🌍</span>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>ISO 26000 &amp; ODD</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Explorez les correspondances ISO 26000 et les 17 ODD</div>
              </div>
            </Link>
          </div>
        </div>

        {showShare && diagnostic && <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />}
        {showAnnexes && diagnostic && <ISO26000AnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />}
      </div>
    )
  }

  // ── Guards post-intro ──────────────────────────────────────────────────────
  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />
        <div className="text-5xl">🏢</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sélectionnez une organisation dans le panneau de gauche<br />pour commencer le diagnostic.</p>
      </div>
    )
  }

  if (loadingDiag) {
    return (
      <div className="space-y-4">
        <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!diagnostic) {
    return <div className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>Impossible de charger le diagnostic.</div>
  }

  // ── VUE TABLEAU DE BORD ───────────────────────────────────────────────────
  if (view === 'dashboard') {
    const pilierScores = (['G', 'E', 'S'] as const).map(p => {
      const qcs = QC_LIST.filter(qc => qc.pilier === p)
      const ds = qcs.flatMap(qc => qc.domaines).filter(d => (scores[d.id] ?? 0) > 0)
      const avg = ds.length > 0 ? ds.reduce((a, d) => a + scores[d.id], 0) / ds.length : 0
      return { pilier: p, label: p === 'G' ? 'Gouvernance' : p === 'E' ? 'Environnement' : 'Social', avg, count: ds.length, total: qcs.flatMap(q => q.domaines).length }
    })
    const oddCovered = Array.from(new Set(ALL_DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).flatMap(d => d.ods)))

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />

        {/* Score global */}
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="text-5xl font-bold mb-1" style={{ color: 'var(--accent, #6366f1)' }}>{globalScore}%</div>
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Score global RSE</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{evalCount} / {ALL_DOMAINS.length} domaines évalués</div>
        </div>

        {/* Radar + Piliers */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Radar ISO 26000</h3>
            <RadarChart scores={scores} />
            <div className="grid grid-cols-4 gap-1 mt-2">
              {QC_LIST.map(qc => (
                <div key={qc.id} className="text-center">
                  <div className="text-base">{qc.icone}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{getQcScore(qc, scores).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Score par pilier</h3>
            {pilierScores.map(({ pilier, label, avg, count, total }) => (
              <div key={pilier}>
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{label} ({count}/{total} domaines)</span>
                  <span>{avg.toFixed(1)}/5</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${(avg/5)*100}%`, backgroundColor: QC_PILIER_COLORS[pilier] }} />
                </div>
              </div>
            ))}

            {/* ODD */}
            {oddCovered.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>ODD adressés ({oddCovered.length}/17)</div>
                <div className="flex flex-wrap gap-1.5">
                  {oddCovered.map(odd => {
                    const n = parseInt(odd.replace('ODD',''),10)
                    return <span key={odd} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: ODD_COLORS[odd] }}>{n}</span>
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Par QC */}
        <div className="space-y-3">
          {QC_LIST.map(qc => {
            const qcScore = getQcScore(qc, scores)
            const qcEval = qc.domaines.filter(d => (scores[d.id] ?? 0) > 0).length
            return (
              <div key={qc.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{qc.icone}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{qc.nom}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{qcEval}/{qc.domaines.length} domaines · Score: {qcScore.toFixed(1)}/5</div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: qc.couleur }}>{Math.round((qcScore/5)*100)}%</div>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${(qcScore/5)*100}%`, backgroundColor: qc.couleur }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom export */}
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={handleExportExcel} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Excel</button>
          <button disabled className="px-4 py-2 text-sm rounded-lg border transition-colors opacity-40 cursor-not-allowed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>PDF</button>
          <button onClick={() => setShowAnnexes(true)} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annexes</button>
        </div>

        {showShare && <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />}
        {showAnnexes && <ISO26000AnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />}
      </div>
    )
  }

  // ── VUE SYNTHÈSE ───────────────────────────────────────────────────────────
  if (view === 'summary') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />

        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>Synthèse — {evalCount}/{ALL_DOMAINS.length} domaines évalués</h3>
          {evalCount > 0 && <p className="text-xs mb-2 font-semibold text-green-600 dark:text-green-400">Score global : {globalScore}%</p>}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cliquez sur un domaine pour le modifier.</p>
        </div>

        {QC_LIST.map(qc => {
          const qcScore = getQcScore(qc, scores)
          return (
            <div key={qc.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 p-4" style={{ backgroundColor: `${qc.couleur}11` }}>
                <span className="text-xl">{qc.icone}</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{qc.nom}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{qc.isoRef} · {qc.domaines.length} domaines</div>
                </div>
                <div className="text-base font-bold" style={{ color: qc.couleur }}>{qcScore.toFixed(1)}/5</div>
              </div>
              <div className="divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {qc.domaines.map(domain => {
                  const s = scores[domain.id] ?? 0
                  const suggested = computeSuggestedScore(domain, actionProgress, actionNa)
                  return (
                    <button key={domain.id} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      onClick={() => { setSelectedDomain(domain); setExpandedQc(new Set([qc.id])); setView('step') }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{domain.nom}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{domain.isoRef}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {suggested > 0 && suggested !== s && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                            Suggéré : {suggested}
                          </span>
                        )}
                        <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${(s/5)*100}%`, backgroundColor: s > 0 ? qc.couleur : 'transparent' }} />
                        </div>
                        <span className="text-xs font-medium w-8 text-right" style={{ color: s > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{s > 0 ? `${s}/5` : '—'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* AI Analysis */}
        {(diagnostic.ai_analysis || evalCount >= 5) && (
          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Analyse IA</h3>
              {isOwner && (
                <button onClick={handleGenAI} disabled={generatingAI} className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-70 disabled:opacity-40" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {generatingAI ? 'Génération…' : diagnostic.ai_analysis ? 'Régénérer' : 'Générer'}
                </button>
              )}
            </div>
            {diagnostic.ai_analysis ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm" style={{ color: 'var(--text)' }}>
                {diagnostic.ai_analysis.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Évaluez au moins 5 domaines pour obtenir une analyse IA.</p>
            )}
          </div>
        )}

        {/* Bottom export */}
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={handleExportExcel} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Excel</button>
          <button disabled className="px-4 py-2 text-sm rounded-lg border transition-colors opacity-40 cursor-not-allowed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>PDF</button>
          <button onClick={() => setShowAnnexes(true)} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annexes</button>
        </div>

        {showShare && <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />}
        {showAnnexes && <ISO26000AnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />}
      </div>
    )
  }

  // ── VUE QUESTIONNAIRE ─────────────────────────────────────────────────────
  const activeDomain = selectedDomain ?? QC_LIST[0].domaines[0]
  const activeQc     = QC_LIST.find(qc => qc.domaines.some(d => d.id === activeDomain.id))!
  const domainScore  = scores[activeDomain.id] ?? 0
  const suggested    = computeSuggestedScore(activeDomain, actionProgress, actionNa)

  return (
    <div className="flex gap-0 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Sidebar QC / Domaines */}
      <div className="w-64 flex-shrink-0 overflow-y-auto border-r" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="p-3">
          <ViewTabs tabs={ISO_TABS} active={view} onChange={setView} />
        </div>
        <div className="px-2 pb-4 space-y-1">
          {QC_LIST.map(qc => {
            const isExpanded = expandedQc.has(qc.id)
            const qcEval = qc.domaines.filter(d => (scores[d.id] ?? 0) > 0).length
            return (
              <div key={qc.id}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setExpandedQc(prev => { const n = new Set(prev); if (n.has(qc.id)) n.delete(qc.id); else n.add(qc.id); return n })}
                >
                  <span className="text-base">{qc.icone}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{qc.nom}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{qcEval}/{qc.domaines.length}</div>
                  </div>
                  <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isExpanded && (
                  <div className="ml-3 mt-0.5 space-y-0.5">
                    {qc.domaines.map(domain => {
                      const s = scores[domain.id] ?? 0
                      const isActive = domain.id === activeDomain.id
                      return (
                        <button key={domain.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs transition-colors"
                          style={{
                            backgroundColor: isActive ? 'var(--accent, #6366f1)' : 'transparent',
                            color: isActive ? 'white' : 'var(--text)',
                          }}
                          onClick={() => setSelectedDomain(domain)}
                        >
                          <div className="flex-1 truncate">{domain.nom}</div>
                          {s > 0 && <span className="flex-shrink-0 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold text-white" style={{ backgroundColor: qc.couleur }}>{s}</span>}
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

      {/* Zone principale */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* En-tête domaine */}
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{activeQc.icone}</span>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeQc.nom} · {activeDomain.isoRef}</div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>{activeDomain.nom}</h2>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{activeDomain.description}</p>
            </div>
          </div>
        </div>

        {/* Sélecteur de score */}
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Niveau de maturité</h3>
            {suggested > 0 && (
              <button onClick={() => setScore(activeDomain.id, suggested)} className="text-xs px-2 py-1 rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Appliquer suggestion ({suggested})
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {SCORE_LABELS.map((label, i) => (
              <button key={i} onClick={() => isOwner && setScore(activeDomain.id, i)}
                className="flex-1 min-w-[80px] py-2 rounded-lg border-2 text-xs font-medium transition-all"
                style={{
                  borderColor: domainScore === i ? activeQc.couleur : 'var(--border)',
                  backgroundColor: domainScore === i ? `${activeQc.couleur}22` : 'transparent',
                  color: domainScore === i ? activeQc.couleur : 'var(--text-muted)',
                }}
                disabled={!isOwner}
              >
                {i === 0 ? label : `${i} — ${label}`}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Actions à évaluer</h3>
          <div className="space-y-4">
            {activeDomain.actions.map((action, i) => {
              const key = actionKey(activeDomain.id, i)
              const prog = actionProgress[key] ?? 0
              const isNa = actionNa[key] ?? false
              return (
                <div key={key} className={`space-y-2 ${isNa ? 'opacity-40' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{action}</div>
                    <label className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={isNa} onChange={e => isOwner && setActionNa(key, e.target.checked)} className="w-3 h-3" />
                      N/A
                    </label>
                  </div>
                  {!isNa && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={10} value={prog}
                        onChange={e => isOwner && setActionProgress(key, parseInt(e.target.value))}
                        className="flex-1 h-1.5 accent-indigo-500" disabled={!isOwner} />
                      <span className="text-xs font-medium w-8 text-right" style={{ color: 'var(--text-muted)' }}>{prog}/10</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* KPIs */}
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Indicateurs clés (KPIs)</h3>
          <ul className="space-y-1">
            {activeDomain.kpis.map((kpi, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex-shrink-0 mt-0.5 font-bold" style={{ color: 'var(--accent, #6366f1)' }}>→</span>
                {kpi}
              </li>
            ))}
          </ul>
        </div>

        {/* ODD */}
        {activeDomain.ods.length > 0 && (
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>ODD associés</h3>
            <div className="flex flex-wrap gap-2">
              {activeDomain.ods.map(odd => {
                const n = parseInt(odd.replace('ODD',''),10)
                return (
                  <span key={odd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: ODD_COLORS[odd] }}>
                    <span className="font-bold">{n}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes du domaine */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>📝 Notes & documents</span>
          </div>
          <ISO26000NotePanel
            apiBase="/api/iso26000-diagnostic"
            noteTable="iso26000_action_notes"
            diagnosticId={diagnostic.id}
            actionKey={`domain_${activeDomain.id}`}
            readOnly={!isOwner}
            note={noteTextMap[`domain_${activeDomain.id}`] ?? ''}
            onNoteChange={v => {
              setNoteTextMap(prev => ({ ...prev, [`domain_${activeDomain.id}`]: v }))
              saveNoteText(`domain_${activeDomain.id}`, v)
            }}
            initialSections={(noteMap[`domain_${activeDomain.id}`] as import('./GuidedActionNotePanel').NoteSection[]) ?? []}
            notesRemoteVersion={notesRemoteVersion}
            onSectionsChange={s => setNoteMap(prev => ({ ...prev, [`domain_${activeDomain.id}`]: s }))}
          />
        </div>

        {/* Bottom export */}
        <div className="flex gap-2 pt-2">
          <button onClick={handleExportExcel} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Excel</button>
          <button disabled className="px-4 py-2 text-sm rounded-lg border transition-colors opacity-40 cursor-not-allowed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>PDF</button>
          <button onClick={() => setShowAnnexes(true)} className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-70" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annexes</button>
        </div>
      </div>

      {showShare && <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />}
      {showAnnexes && <ISO26000AnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />}
    </div>
  )
}
