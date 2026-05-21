'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ViewTabs from '@/components/rse/ViewTabs'
import type { RseContext } from '@/components/rse/RseAppShell'
import { createClient } from '@/lib/supabase/client'
const ODDNotePanel = dynamic(() => import('./GuidedActionNotePanel'), { ssr: false, loading: () => null })

// ─── Données ISO 26000 (source de vérité locale) ─────────────────────────────

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

// ODD metadata
const ODD_META: Record<string, { couleur: string; nom: string; description: string }> = {
  ODD1:  { couleur: '#E5243B', nom: 'Pas de pauvreté',             description: 'Éliminer la pauvreté sous toutes ses formes et partout dans le monde.' },
  ODD2:  { couleur: '#DDA63A', nom: 'Faim zéro',                   description: 'Éliminer la faim, assurer la sécurité alimentaire, améliorer la nutrition et promouvoir une agriculture durable.' },
  ODD3:  { couleur: '#4C9F38', nom: 'Santé et bien-être',          description: 'Permettre à tous de vivre en bonne santé et promouvoir le bien-être de tous à tout âge.' },
  ODD4:  { couleur: '#C5192D', nom: 'Éducation de qualité',        description: "Assurer l'accès de tous à une éducation de qualité, sur un pied d'égalité." },
  ODD5:  { couleur: '#FF3A21', nom: 'Égalité entre les sexes',     description: "Parvenir à l'égalité des sexes et autonomiser toutes les femmes et les filles." },
  ODD6:  { couleur: '#26BDE2', nom: 'Eau propre',                  description: "Garantir l'accès de tous à l'eau et à l'assainissement." },
  ODD7:  { couleur: '#FCC30B', nom: 'Énergie propre',              description: "Garantir l'accès de tous à des services énergétiques fiables et durables." },
  ODD8:  { couleur: '#A21942', nom: 'Travail décent',              description: 'Promouvoir une croissance économique soutenue, partagée et durable, le plein emploi et le travail décent.' },
  ODD9:  { couleur: '#FD6925', nom: 'Industrie et innovation',     description: "Bâtir une infrastructure résiliente, promouvoir une industrialisation durable et encourager l'innovation." },
  ODD10: { couleur: '#DD1367', nom: 'Inégalités réduites',         description: "Réduire les inégalités dans les pays et d'un pays à l'autre." },
  ODD11: { couleur: '#FD9D24', nom: 'Villes durables',             description: 'Faire en sorte que les villes soient ouvertes à tous, sûres, résilientes et durables.' },
  ODD12: { couleur: '#BF8B2E', nom: 'Consommation responsable',    description: 'Établir des modes de consommation et de production durables.' },
  ODD13: { couleur: '#3F7E44', nom: 'Action climatique',           description: "Prendre d'urgence des mesures pour lutter contre les changements climatiques." },
  ODD14: { couleur: '#0A97D9', nom: 'Vie aquatique',               description: 'Conserver et exploiter durablement les océans, mers et ressources marines.' },
  ODD15: { couleur: '#56C02B', nom: 'Vie terrestre',               description: "Préserver et restaurer les écosystèmes terrestres." },
  ODD16: { couleur: '#00689D', nom: 'Paix et justice',             description: "Promouvoir l'avènement de sociétés pacifiques et ouvertes aux fins du développement durable." },
  ODD17: { couleur: '#19486A', nom: 'Partenariats',                description: 'Revitaliser le Partenariat mondial pour le développement durable.' },
}

const QC_LIST: CoreSubject[] = [
  {
    id: 'QC1', isoRef: '6.2', nom: "Gouvernance de l'organisation", icone: '🏛️', pilier: 'G', couleur: '#60a5fa',
    description: "La gouvernance est le système par lequel une organisation prend ses décisions. Question centrale transversale — elle conditionne l'efficacité de toutes les autres.",
    domaines: [
      { id: 'DA1.1', isoRef: '6.2', nom: 'Gouvernance organisationnelle', description: "Mise en place de structures, processus et mécanismes permettant d'agir de façon responsable et transparente.", actions: ["Définir et formaliser les valeurs, vision et stratégie RSE","Identifier et cartographier les parties prenantes","Mettre en place des mécanismes de décision transparents","Établir un reporting RSE régulier (annuel au minimum)","Intégrer la RSE dans les objectifs stratégiques","Désigner un responsable RSE avec mandat officiel","Promouvoir la diversité dans les instances de décision","Évaluer et améliorer en continu les pratiques de gouvernance","Former les dirigeants aux enjeux de responsabilité sociétale","Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)"], kpis: ["Politique RSE formalisée (oui/non)","Score d'intégration RSE dans les objectifs (0-100%)","Fréquence du reporting RSE (nombre/an)","Part des administrateurs formés à la RSE (%)","Existence d'un comité RSE au niveau direction (oui/non)"], ods: ['ODD16', 'ODD17'] },
    ],
  },
  {
    id: 'QC2', isoRef: '6.3', nom: "Droits de l'Homme", icone: '🤝', pilier: 'S', couleur: '#f87171',
    description: "Obligation de respecter les droits de l'Homme universellement reconnus et d'éviter d'être complice de violations.",
    domaines: [
      { id: 'DA2.1', isoRef: '6.3.3', nom: 'Devoir de vigilance', description: "Identification et prévention des risques d'atteinte aux droits de l'Homme.", actions: ["Cartographier les risques droits de l'Homme","Mettre en place un plan de vigilance","Évaluer régulièrement les fournisseurs","Définir des procédures de remédiation","Former les équipes à la vigilance"], kpis: ["Plan de vigilance formalisé (oui/non)","Taux de fournisseurs évalués (%)","Nombre d'incidents traités"], ods: ['ODD16'] },
      { id: 'DA2.2', isoRef: '6.3.4', nom: "Situations à risque pour les droits de l'Homme", description: "Attention particulière aux zones de conflit, discrimination systémique.", actions: ["Analyser le contexte géographique des activités","Éviter ou sécuriser les zones à très haut risque","Collaborer avec des ONG locales","Établir des mécanismes de signalement locaux","Adapter les politiques RH aux contextes locaux"], kpis: ["Cartographie des zones à risque","Mesures de mitigation par zone","Incidents recensés"], ods: ['ODD16'] },
      { id: 'DA2.3', isoRef: '6.3.5', nom: 'Prévention de la complicité', description: "Éviter d'être directement ou indirectement complice de violations.", actions: ["Adopter une politique tolérance zéro","Auditer la chaîne de valeur","Intégrer des clauses contractuelles droits de l'Homme","Définir des critères dans les appels d'offres","Mettre fin aux partenariats en cas de violations"], kpis: ["Taux de contrats avec clauses droits de l'Homme (%)","Nombre d'audits fournisseurs","Partenariats résiliés pour violations"], ods: ['ODD16'] },
      { id: 'DA2.4', isoRef: '6.3.6', nom: "Remédier aux atteintes aux droits de l'Homme", description: "Mécanismes permettant aux personnes affectées de signaler leurs préoccupations.", actions: ["Créer un mécanisme de réclamations accessible","Garantir la confidentialité des lanceurs d'alerte","Documenter chaque réclamation","Publier des rapports annuels","Former les équipes au mécanisme"], kpis: ["Existence d'un mécanisme de réclamations (oui/non)","Délai moyen de traitement (jours)","Taux de satisfaction (%)","Nombre de réclamations reçues et résolues"], ods: ['ODD16'] },
      { id: 'DA2.5', isoRef: '6.3.7', nom: 'Discrimination et groupes vulnérables', description: "Prévention de toute forme de discrimination et protection des personnes vulnérables.", actions: ["Adopter une politique de non-discrimination","Mettre en place des actions positives","Former les managers aux discriminations et biais","Réaliser des audits de rémunération","Mettre en place des aménagements pour les personnes handicapées"], kpis: ["Index égalité professionnelle (/100)","Taux d'emploi des personnes handicapées (%)","Actions disciplinaires pour discrimination","Part des femmes dans les postes de direction (%)"], ods: ['ODD5', 'ODD10'] },
      { id: 'DA2.6', isoRef: '6.3.8', nom: 'Droits civils et politiques', description: "Respect de la liberté d'expression, de conscience, de réunion et d'association.", actions: ["Garantir la liberté d'expression au travail","Protéger le droit d'association syndicale","Ne pas exercer de pression politique","Protéger la vie privée des salariés","Respecter la liberté de conscience et de religion"], kpis: ["Liberté syndicale formellement reconnue (oui/non)","Charte de protection des données personnelles (oui/non)","Incidents de restriction de libertés recensés"], ods: ['ODD16'] },
      { id: 'DA2.7', isoRef: '6.3.9', nom: 'Droits économiques, sociaux et culturels', description: "Droit au travail, à l'éducation, à la santé et à un niveau de vie suffisant.", actions: ["Assurer des rémunérations permettant un niveau de vie décent","Favoriser la formation continue","Respecter et promouvoir le droit à la santé","Soutenir l'accès aux services essentiels","Respecter les traditions culturelles locales"], kpis: ["Rapport salaire minimum interne / salaire vital local","Budget de formation par salarié (€/an)","Taux d'accès à la protection sociale complète (%)"], ods: ['ODD1', 'ODD3', 'ODD4', 'ODD8'] },
      { id: 'DA2.8', isoRef: '6.3.10', nom: 'Principes fondamentaux et droits au travail', description: "Respect des conventions fondamentales de l'OIT.", actions: ["Garantir l'absence totale de travail forcé","Interdire le travail des enfants","Promouvoir la liberté syndicale","Assurer l'égalité de rémunération F/H","Intégrer les conventions OIT dans les contrats fournisseurs"], kpis: ["Zéro cas de travail forcé ou infantile","Conformité aux conventions OIT","Écart de rémunération F/H à poste équivalent (%)"], ods: ['ODD8'] },
    ],
  },
  {
    id: 'QC3', isoRef: '6.4', nom: 'Relations et conditions de travail', icone: '👷', pilier: 'S', couleur: '#34d399',
    description: "Les relations et conditions de travail s'étendent au-delà des relations directes avec les propres employés pour inclure les sous-traitants.",
    domaines: [
      { id: 'DA3.1', isoRef: '6.4.3', nom: 'Emploi et relations employeur/employé', description: "Conditions d'embauche, de travail, de rémunération et de licenciement équitables.", actions: ["Établir des contrats de travail clairs","Assurer des rémunérations justes et équitables","Mettre en place un recrutement non discriminatoire","Définir des procédures de licenciement justes","Favoriser la stabilité de l'emploi","Privilégier l'emploi local"], kpis: ["Taux d'emplois stables (CDI %)","Ratio salaire médian / salaire minimum légal","Taux de turnover volontaire (%)","Délai moyen de pourvoi des postes (jours)"], ods: ['ODD8'] },
      { id: 'DA3.2', isoRef: '6.4.4', nom: 'Conditions de travail et protection sociale', description: "Temps de travail, politiques de congés, protection sociale et équilibre vie pro/perso.", actions: ["Respecter strictement les temps de travail légaux","Assurer une protection sociale complète","Proposer une politique de congés flexible","Mettre en place une charte du droit à la déconnexion","Faciliter le télétravail et les modes flexibles","Accompagner le retour post-congé parental"], kpis: ["Taux de couverture protection sociale complète (%)","Heures supplémentaires non compensées (objectif zéro)","Existence d'une charte de déconnexion (oui/non)","Taux de recours au télétravail (%)"], ods: ['ODD3', 'ODD8'] },
      { id: 'DA3.3', isoRef: '6.4.5', nom: 'Dialogue social', description: "Consultation et négociation entre la direction et les représentants des travailleurs.", actions: ["Encourager activement la représentation syndicale","Tenir des réunions régulières avec les représentants","Informer et consulter les salariés","Conclure des accords d'entreprise","Réaliser des enquêtes d'engagement régulières"], kpis: ["Nombre d'accords d'entreprise signés","Taux de participation aux élections professionnelles (%)","Score d'engagement salarié (/100)","Nombre de réunions CSE par an"], ods: ['ODD8'] },
      { id: 'DA3.4', isoRef: '6.4.6', nom: 'Santé et sécurité au travail', description: "Prévention des risques professionnels et promotion de la santé physique et mentale.", actions: ["Réaliser et mettre à jour le DUER","Former l'ensemble des salariés aux gestes de premiers secours","Déployer une politique de prévention des RPS","Assurer un suivi médical régulier","Viser la certification ISO 45001","Analyser systématiquement tous les accidents","Réaliser des aménagements ergonomiques"], kpis: ["Taux de fréquence des accidents (TF)","Taux de gravité des accidents (TG)","Taux d'absentéisme maladie (%)","Jours de formation SST par salarié et par an","Score de bien-être au travail"], ods: ['ODD3'] },
      { id: 'DA3.5', isoRef: '6.4.7', nom: 'Développement du capital humain', description: "Formation, développement des compétences, gestion des talents et évolution professionnelle.", actions: ["Mener des entretiens annuels et professionnels","Élaborer un plan de développement des compétences","Encourager la mobilité interne","Garantir l'accès à la formation continue et au CPF","Mettre en place un programme de mentorat","Évaluer les besoins en compétences futures (GEPP)"], kpis: ["Heures de formation par salarié par an","Budget formation en % de la masse salariale","Taux de réalisation des entretiens professionnels (%)","Taux de promotion interne (%)"], ods: ['ODD4', 'ODD8'] },
    ],
  },
  {
    id: 'QC4', isoRef: '6.5', nom: 'Environnement', icone: '🌱', pilier: 'E', couleur: '#4ade80',
    description: "L'ISO 26000 reconnaît que les organisations ont une responsabilité envers l'environnement qui va au-delà des obligations réglementaires.",
    domaines: [
      { id: 'DA4.1', isoRef: '6.5.3', nom: 'Prévention de la pollution', description: "Identification et réduction des émissions polluantes dans l'air, l'eau et les sols.", actions: ["Réaliser un bilan complet des émissions polluantes","Investir dans des technologies propres","Réduire l'utilisation des substances dangereuses","Gérer et valoriser les déchets","Traiter les effluents avant rejet","Viser la certification ISO 14001","Former les collaborateurs aux bonnes pratiques environnementales"], kpis: ["Quantité totale de déchets produits (tonnes/an)","Taux de valorisation des déchets (%)","Émissions polluantes mesurées","Nombre d'incidents environnementaux"], ods: ['ODD6', 'ODD14', 'ODD15'] },
      { id: 'DA4.2', isoRef: '6.5.4', nom: 'Utilisation durable des ressources', description: "Réduction de la consommation de ressources naturelles et promotion de l'économie circulaire.", actions: ["Réaliser un bilan énergétique complet","Améliorer l'efficacité énergétique","Installer des sources d'énergie renouvelable","Mesurer et réduire la consommation d'eau","Intégrer l'éco-conception","Optimiser les achats (circuits courts)","Déployer une démarche d'économie circulaire","Viser la certification ISO 50001"], kpis: ["Consommation d'énergie totale (MWh/an)","Part des énergies renouvelables (%)","Consommation d'eau (m³/an)","Taux de matières recyclées (%)","Intensité énergétique"], ods: ['ODD6', 'ODD7', 'ODD12'] },
      { id: 'DA4.3', isoRef: '6.5.5', nom: 'Atténuation des changements climatiques', description: "Réduction des émissions de GES et adaptation aux impacts du changement climatique.", actions: ["Réaliser un Bilan Carbone® complet (scopes 1, 2, 3)","Définir une trajectoire de réduction alignée sur les Accords de Paris","Élaborer un plan de transition bas-carbone","Compenser les émissions résiduelles","Analyser les risques climatiques selon le cadre TCFD","Réduire les déplacements professionnels","Adopter une politique d'achats bas-carbone"], kpis: ["Empreinte carbone totale (tCO₂e/an)","Taux de réduction des émissions vs référence (%)","Budget dédié à la transition énergétique (€)","Score d'alignement SBTi","Part des émissions scope 3 mesurées (%)"], ods: ['ODD13'] },
      { id: 'DA4.4', isoRef: '6.5.6', nom: "Protection de l'environnement et biodiversité", description: "Préservation et restauration de la biodiversité et des écosystèmes naturels.", actions: ["Réaliser un diagnostic de biodiversité sur les sites","Appliquer la séquence ERC (Éviter-Réduire-Compenser)","Adopter une politique zéro déforestation","Végétaliser les sites et favoriser la biodiversité locale","Engager des programmes de restauration écologique","Évaluer les dépendances écosystémiques selon le cadre TNFD"], kpis: ["Superficie d'habitats restaurés (ha)","Score de biodiversité des sites","Part des achats conformes à la politique zéro déforestation (%)","Espèces protégées présentes sur les sites"], ods: ['ODD14', 'ODD15'] },
    ],
  },
  {
    id: 'QC5', isoRef: '6.6', nom: 'Loyauté des pratiques', icone: '⚖️', pilier: 'G', couleur: '#fbbf24',
    description: "La loyauté des pratiques concerne le comportement éthique dans les relations avec d'autres organisations.",
    domaines: [
      { id: 'DA5.1', isoRef: '6.6.3', nom: 'Lutte contre la corruption', description: "Prévention et combat contre toutes formes de corruption.", actions: ["Adopter et diffuser un code éthique anti-corruption","Déployer un programme de conformité anti-corruption","Former régulièrement les collaborateurs exposés","Mettre en place un dispositif de signalement protégé","Réaliser des audits internes anti-corruption","Évaluer les risques de corruption chez les tiers"], kpis: ["Programme anti-corruption certifié ISO 37001 (oui/non)","Taux de formation des collaborateurs exposés (%)","Nombre de signalements éthiques traités","Incidents de corruption détectés et sanctionnés"], ods: ['ODD16'] },
      { id: 'DA5.2', isoRef: '6.6.4', nom: 'Engagement politique responsable', description: "Participation responsable et transparente à la vie politique et aux politiques publiques.", actions: ["Adopter une politique de transparence avec les institutions","Déclarer les représentants d'intérêts","Éviter tout financement politique opaque","Participer aux consultations publiques de manière transparente"], kpis: ["Contributions politiques déclarées (montant total)","Inscription au registre des lobbyistes (oui/non)","Politique de lobbying responsable formalisée (oui/non)"], ods: ['ODD16'] },
      { id: 'DA5.3', isoRef: '6.6.5', nom: 'Concurrence loyale', description: "Respect des règles de la concurrence et refus des pratiques anticoncurrentielles.", actions: ["Former régulièrement les équipes au droit de la concurrence","Déployer un programme de conformité antitrust","Refuser les accords de fixation de prix","Éviter tout abus de position dominante","Mettre en place une veille anticoncurrentielle"], kpis: ["Programme de conformité antitrust formalisé (oui/non)","Litiges liés à la concurrence (nombre)","Taux de formation des équipes concernées (%)"], ods: ['ODD16'] },
      { id: 'DA5.4', isoRef: '6.6.6', nom: 'Promotion de la RSE dans la chaîne de valeur', description: "Encouragement des fournisseurs et partenaires à adopter des pratiques responsables.", actions: ["Intégrer des critères RSE dans les appels d'offres","Évaluer régulièrement les fournisseurs stratégiques","Accompagner les fournisseurs dans leur démarche RSE","Favoriser les achats locaux, équitables et durables","Publier une politique d'achats responsables"], kpis: ["Part des achats couverts par une évaluation RSE fournisseurs (%)","Part des achats locaux et/ou durables (%)","Score moyen RSE des fournisseurs stratégiques"], ods: ['ODD12', 'ODD17'] },
      { id: 'DA5.5', isoRef: '6.6.7', nom: 'Respect des droits de propriété', description: "Respect de la propriété intellectuelle, des droits d'auteur, des brevets et du patrimoine.", actions: ["Adopter une politique de respect de la propriété intellectuelle","Former les équipes R&D et achats","Respecter strictement les licences logicielles","Mettre en place des procédures pour éviter l'usage non autorisé de brevets"], kpis: ["Litiges liés à la propriété intellectuelle (nombre)","Taux de conformité des licences logicielles (%)"], ods: ['ODD9'] },
    ],
  },
  {
    id: 'QC6', isoRef: '6.7', nom: 'Questions relatives aux consommateurs', icone: '🛒', pilier: 'S', couleur: '#c084fc',
    description: "Responsabilités envers les consommateurs : information précise, sécurité des produits, protection des données.",
    domaines: [
      { id: 'DA6.1', isoRef: '6.7.3', nom: "Pratiques loyales en matière de commercialisation", description: "Honnêteté, transparence et loyauté dans la communication commerciale.", actions: ["Garantir la véracité et la clarté des allégations publicitaires","Éviter les clauses contractuelles abusives","Fournir des informations complètes sur les produits","Lutter activement contre le greenwashing","Informer clairement sur les prix et conditions"], kpis: ["Nombre de plaintes pour pratiques trompeuses","Score de satisfaction sur la clarté de l'information (%)","Résultats d'audit des pratiques marketing"], ods: ['ODD12'] },
      { id: 'DA6.2', isoRef: '6.7.4', nom: 'Protection de la santé et de la sécurité des consommateurs', description: "Garantie que les produits et services ne présentent pas de risques.", actions: ["Mettre en place et certifier un système qualité ISO 9001","Réaliser des analyses de risques complètes","Définir et tester des procédures de retrait produits","Communiquer clairement sur les risques d'utilisation","Suivre les incidents consommateurs liés à la sécurité"], kpis: ["Nombre de rappels produits dans l'année","Nombre d'incidents consommateurs liés à la sécurité","Délai moyen de traitement des réclamations sécurité (jours)","Taux de satisfaction qualité produit (%)"], ods: ['ODD3'] },
      { id: 'DA6.3', isoRef: '6.7.5', nom: 'Consommation durable', description: "Promotion de modes de consommation durables.", actions: ["Développer et promouvoir des alternatives éco-responsables","Intégrer l'éco-conception dès le développement produit","Informer les consommateurs sur l'impact environnemental","Faciliter la réparation, le réemploi et le recyclage","Mettre en place un affichage environnemental"], kpis: ["Part des produits éco-conçus dans l'offre (%)","Taux de recyclabilité moyen (%)","Produits avec affichage environnemental certifié (nombre/%)"], ods: ['ODD12'] },
      { id: 'DA6.4', isoRef: '6.7.6', nom: 'Service après-vente et résolution des réclamations', description: "Accessibilité et efficacité des services client et mécanismes de traitement des plaintes.", actions: ["Offrir un service client accessible et multicanal","Définir des procédures claires de gestion des réclamations","Former régulièrement les équipes à la relation client","Mesurer et améliorer la satisfaction (NPS, CSAT)","Proposer des modes alternatifs de résolution des litiges"], kpis: ["Net Promoter Score (NPS)","Délai moyen de résolution des réclamations (h/jours)","Taux de réclamations résolues au premier contact (%)","Score de satisfaction client global (CSAT)"], ods: ['ODD10'] },
      { id: 'DA6.5', isoRef: '6.7.7', nom: 'Protection des données et de la vie privée', description: "Respect de la confidentialité et protection des données personnelles. Conformité RGPD.", actions: ["Assurer la pleine conformité au RGPD","Nommer un DPO qualifié","Réaliser des AIPD/DPIA pour les traitements à risque","Mettre en place des mesures de sécurité informatique robustes","Informer clairement sur l'utilisation des données","Permettre l'exercice effectif des droits RGPD"], kpis: ["Score de conformité RGPD (audit annuel, %)","Nombre de violations de données notifiées à la CNIL","Délai moyen de réponse aux demandes RGPD (jours)","Plaintes reçues relatives à la vie privée"], ods: ['ODD16'] },
      { id: 'DA6.6', isoRef: '6.7.8', nom: 'Accès aux services essentiels', description: "Facilitation de l'accès des populations vulnérables aux services essentiels.", actions: ["Proposer des tarifs accessibles pour les publics vulnérables","Assurer l'accessibilité physique et numérique (RGAA)","Participer aux programmes d'accès universel","Adapter les conditions de paiement"], kpis: ["Existence de tarifs sociaux (oui/non)","Score d'accessibilité numérique (RGAA, %)","Nombre de bénéficiaires des dispositifs d'inclusion"], ods: ['ODD10'] },
      { id: 'DA6.7', isoRef: '6.7.9', nom: 'Éducation et sensibilisation', description: "Contribution à l'information et à l'éducation des consommateurs pour des choix éclairés.", actions: ["Produire et diffuser des contenus éducatifs sur l'utilisation responsable","Développer des programmes d'éducation à la consommation durable","Communiquer sur les enjeux environnementaux liés à l'offre"], kpis: ["Nombre de contenus éducatifs produits et diffusés","Audience des programmes d'éducation","Part des consommateurs se déclarant bien informés (%)"], ods: ['ODD4', 'ODD12'] },
    ],
  },
  {
    id: 'QC7', isoRef: '6.8', nom: 'Communautés et développement local', icone: '🏘️', pilier: 'S', couleur: '#22d3ee',
    description: "Les organisations ont une relation avec les communautés au sein desquelles elles opèrent. La norme encourage l'implication active dans le développement local.",
    domaines: [
      { id: 'DA7.1', isoRef: '6.8.3', nom: 'Implication auprès des communautés', description: "Engagement proactif et dialogue continu avec les communautés locales.", actions: ["Organiser des consultations régulières avec les riverains","Participer aux instances de concertation locale","Mettre en place un mécanisme de traitement des plaintes communautaires","Communiquer de manière transparente sur les impacts locaux"], kpis: ["Nombre de consultations communautaires organisées par an","Nombre de partenariats actifs avec des acteurs locaux","Délai moyen de traitement des plaintes communautaires (jours)"], ods: ['ODD11', 'ODD17'] },
      { id: 'DA7.2', isoRef: '6.8.4', nom: 'Éducation et culture', description: "Soutien à l'éducation, à la formation professionnelle et à la préservation du patrimoine culturel.", actions: ["Financer des programmes d'éducation locale","Proposer des stages et alternances aux jeunes locaux","Soutenir des projets culturels et patrimoniaux locaux","Développer des partenariats avec les établissements scolaires"], kpis: ["Nombre d'alternants et stagiaires accueillis","Montant des investissements en éducation locale (€/an)","Partenariats actifs avec des établissements d'enseignement"], ods: ['ODD4'] },
      { id: 'DA7.3', isoRef: '6.8.5', nom: "Création d'emplois et développement des compétences", description: "Contribution à l'emploi local et au développement des compétences au niveau territorial.", actions: ["Favoriser le recrutement local pour tous les postes","Travailler avec France Travail et missions locales","Soutenir des initiatives d'insertion professionnelle","Intégrer des clauses d'insertion dans les marchés","Contribuer aux GPEC territoriales"], kpis: ["Part des recrutements locaux (%)","Nombre de personnes accompagnées vers l'emploi","Heures d'insertion professionnelle réalisées"], ods: ['ODD8'] },
      { id: 'DA7.4', isoRef: '6.8.6', nom: 'Développement des technologies et accès à la technologie', description: "Contribution au développement technologique local et réduction de la fracture numérique.", actions: ["Partager les technologies et savoir-faire avec les acteurs locaux","Soutenir l'innovation sociale et technologique locale","Contribuer à réduire la fracture numérique","Participer à des clusters locaux et écosystèmes d'innovation"], kpis: ["Technologies ou brevets partagés localement (nombre)","Personnes formées au numérique (nombre/an)","Montant des investissements en R&D collaborative locale (€)"], ods: ['ODD9'] },
      { id: 'DA7.5', isoRef: '6.8.7', nom: 'Création de richesses et de revenus', description: "Impact positif sur la valeur économique créée et distribuée au niveau du territoire.", actions: ["Privilégier les fournisseurs et sous-traitants locaux","Mesurer et communiquer la valeur économique distribuée localement","Soutenir activement les TPE/PME locales"], kpis: ["Part des achats auprès de fournisseurs locaux (%)","Valeur économique distribuée localement (€/an)","Nombre de PME/TPE locales soutenues"], ods: ['ODD1', 'ODD8', 'ODD10'] },
      { id: 'DA7.6', isoRef: '6.8.8', nom: 'La santé', description: "Contribution à la santé publique et au bien-être des communautés locales.", actions: ["Soutenir des associations et initiatives de santé locales","Développer des programmes de mécénat social lié à la santé","Participer à des campagnes de santé publique","Contribuer au développement des infrastructures de santé locales"], kpis: ["Montant du mécénat social lié à la santé (€/an)","Bénéficiaires des programmes de santé soutenus","Associations partenaires actives dans le domaine de la santé"], ods: ['ODD3'] },
      { id: 'DA7.7', isoRef: '6.8.9', nom: 'Investissement à impact social', description: "Engagements dans des investissements qui génèrent un impact social positif et mesurable.", actions: ["Mesurer et communiquer l'impact social (méthode SROI)","Développer des partenariats stratégiques avec des acteurs ESS","Intégrer des critères d'impact social dans la stratégie d'investissement","Soutenir des initiatives de développement communautaire à fort impact"], kpis: ["Retour Social sur Investissement (SROI - ratio)","Montant total des investissements à impact social (€/an)","Projets ESS actifs soutenus"], ods: ['ODD1', 'ODD10', 'ODD17'] },
    ],
  },
]

// ─── Build reverse mapping ODD → domaines ────────────────────────────────────
interface MappingEntry { qc: CoreSubject; domain: ActionDomain }
function buildOddMapping(): Record<string, MappingEntry[]> {
  const map: Record<string, MappingEntry[]> = {}
  for (let i = 1; i <= 17; i++) map[`ODD${i}`] = []
  for (const qc of QC_LIST) {
    for (const domain of qc.domaines) {
      for (const odd of domain.ods) {
        if (map[odd]) map[odd].push({ qc, domain })
      }
    }
  }
  return map
}
const ODD_MAPPING = buildOddMapping()

// ─── ViewTabs ─────────────────────────────────────────────────────────────────
const ODD_TABS = [
  { id: 'intro'    as const, label: 'Présentation', icon: '📋' },
  { id: 'explorer' as const, label: 'Explorateur',  icon: '🌍' },
  { id: 'matrice'  as const, label: 'Matrice',      icon: '📊' },
] as const
type OddView = typeof ODD_TABS[number]['id']

// ─── Pilier styles ────────────────────────────────────────────────────────────
const PILIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  G: { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300',  label: 'Gouvernance' },
  E: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Environnement' },
  S: { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-300',    label: 'Social' },
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = useMemo(() => {
    const byPilier: Record<string, Set<string>> = { G: new Set(), E: new Set(), S: new Set() }
    const oddCoverage = new Set<string>()
    let totalDomains = 0
    for (const qc of QC_LIST) {
      totalDomains += qc.domaines.length
      for (const domain of qc.domaines) {
        for (const odd of domain.ods) {
          byPilier[qc.pilier].add(domain.id)
          oddCoverage.add(odd)
        }
      }
    }
    return { G: byPilier.G.size, E: byPilier.E.size, S: byPilier.S.size, oddCount: oddCoverage.size, totalDomains }
  }, [])
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'ODD couverts',    value: stats.oddCount,    sub: 'sur 17',    color: 'text-purple-600 dark:text-purple-400' },
        { label: 'Domaines',        value: stats.totalDomains,sub: 'au total',  color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Gouvernance',     value: stats.G,           sub: 'domaines',  color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Environnement',   value: stats.E,           sub: 'domaines',  color: 'text-green-600 dark:text-green-400' },
        { label: 'Social',          value: stats.S,           sub: 'domaines',  color: 'text-red-600 dark:text-red-400' },
      ].map(s => (
        <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{s.sub}</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── ODD pictogram helper ─────────────────────────────────────────────────────
function oddImgSrc(num: number) {
  return `https://sdgs.un.org/sites/default/files/goals/E_SDG_Icons-${String(num).padStart(2, '0')}.jpg`
}

// ─── ODD Card ─────────────────────────────────────────────────────────────────
function OddCard({
  oddKey, selected, onClick, evaluated, total,
}: {
  oddKey: string; selected: boolean; onClick: () => void
  evaluated: number; total: number
}) {
  const meta = ODD_META[oddKey]
  const num = parseInt(oddKey.replace('ODD', ''), 10)
  const coveragePct = total > 0 ? Math.round((evaluated / total) * 100) : 0
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col rounded-xl border-2 transition-all overflow-hidden text-center hover:shadow-md"
      style={{ borderColor: selected ? meta.couleur : `${meta.couleur}44`, backgroundColor: selected ? `${meta.couleur}18` : 'transparent' }}
    >
      <img
        src={oddImgSrc(num)}
        alt={`ODD ${num}`}
        className="w-full aspect-square object-cover"
        loading="lazy"
      />
      <div className="px-1.5 pt-1 pb-1.5 flex flex-col gap-0.5">
        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${coveragePct}%`, backgroundColor: meta.couleur }}
          />
        </div>
        <div className="text-xs font-semibold" style={{ color: meta.couleur }}>
          {evaluated > 0 ? `${evaluated}/${total}` : `${total} dom.`}
        </div>
      </div>
    </button>
  )
}

// ─── Domain Card ──────────────────────────────────────────────────────────────
function DomainCard({
  entry, expandedId, onToggle,
  diagId, domainScore, noteTextMap, noteMap, notesRemoteVersion,
  onNoteChange, onSectionsChange,
}: {
  entry: MappingEntry
  expandedId: string | null
  onToggle: (id: string) => void
  diagId?: string | null
  domainScore?: number
  noteTextMap?: Record<string, string>
  noteMap?: Record<string, unknown[]>
  notesRemoteVersion?: number
  onNoteChange?: (key: string, v: string) => void
  onSectionsChange?: (key: string, s: unknown[]) => void
}) {
  const { qc, domain } = entry
  const pilier = PILIER_STYLES[qc.pilier]
  const isExpanded = expandedId === domain.id

  // Maturity bar (score 0-4)
  const MATURITY_LEVELS = [
    { label: 'Non évalué', color: '#9ca3af' },
    { label: 'Inexistant',    color: '#ef4444' },
    { label: 'Initié',        color: '#f97316' },
    { label: 'En dév.',       color: '#eab308' },
    { label: 'Maîtrisé',      color: '#22c55e' },
  ]
  const score = domainScore ?? 0
  const maturity = MATURITY_LEVELS[Math.min(score, 4)]

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      <button className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => onToggle(domain.id)}>
        <div className="flex-shrink-0 mt-0.5 text-xl">{qc.icone}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pilier.bg} ${pilier.text}`}>{pilier.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{domain.isoRef}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{domain.nom}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">{qc.nom}</div>
          {/* Barre de maturité automatique */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 flex-1">
              {[1,2,3,4].map(lvl => (
                <div
                  key={lvl}
                  className="h-2 flex-1 rounded-sm transition-all duration-500"
                  style={{ backgroundColor: score >= lvl ? MATURITY_LEVELS[lvl].color : '#e5e7eb' }}
                />
              ))}
            </div>
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: maturity.color, minWidth: 72 }}>
              {score > 0 ? `${score}/4 · ${maturity.label}` : maturity.label}
            </span>
          </div>
        </div>
        <svg className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">{domain.description}</p>
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Autres ODD couverts</div>
            <div className="flex flex-wrap gap-1.5">
              {domain.ods.map(odd => {
                const m = ODD_META[odd]; const n = parseInt(odd.replace('ODD',''),10)
                return (
                  <span key={odd} className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: m.couleur }}>
                    <img src={oddImgSrc(n)} alt={`ODD${n}`} className="w-4 h-4 rounded-sm object-cover flex-shrink-0" />
                    ODD{n} · {m.nom}
                  </span>
                )
              })}
            </div>
          </div>
          {domain.actions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions clés</div>
              <ul className="space-y-3">
                {domain.actions.map((action, i) => {
                  const actionKey = `${domain.id}_action_${i}`
                  return (
                    <li key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/40">
                        <span className="flex-shrink-0 mt-0.5 text-green-500 font-bold text-xs">✓</span>
                        <span className="text-xs text-gray-700 dark:text-gray-200 font-medium leading-relaxed">{action}</span>
                      </div>
                      {diagId && (
                        <div className="px-3 pb-3 pt-2">
                          <ODDNotePanel
                            apiBase="/api/iso26000-diagnostic"
                            noteTable="iso26000_action_notes"
                            diagnosticId={diagId}
                            actionKey={actionKey}
                            readOnly={false}
                            note={noteTextMap?.[actionKey] ?? ''}
                            onNoteChange={v => onNoteChange?.(actionKey, v)}
                            initialSections={(noteMap?.[actionKey] ?? []) as import('./GuidedActionNotePanel').NoteSection[]}
                            notesRemoteVersion={notesRemoteVersion ?? 0}
                            onSectionsChange={s => onSectionsChange?.(actionKey, s)}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Matrix View ──────────────────────────────────────────────────────────────
function MatrixView({ onOddSelect }: { onOddSelect: (odd: string) => void }) {
  const ODD_KEYS = Array.from({ length: 17 }, (_, i) => `ODD${i + 1}`)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 text-gray-500 font-medium w-56 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">Domaine d&apos;action</th>
            {ODD_KEYS.map(odd => {
              const meta = ODD_META[odd]; const num = parseInt(odd.replace('ODD',''),10)
              return (
                <th key={odd} className="p-1">
                  <button onClick={() => onOddSelect(odd)} className="hover:opacity-80 transition-opacity mx-auto block" title={meta.nom}>
                    <img src={oddImgSrc(num)} alt={`ODD ${num}`} className="w-7 h-7 rounded object-cover" />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {QC_LIST.map(qc => (
            <>
              <tr key={`qc-${qc.id}`} className="bg-gray-100 dark:bg-gray-800/80">
                <td className="p-2 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-100 dark:bg-gray-800/80" colSpan={18}>{qc.icone} {qc.nom}</td>
              </tr>
              {qc.domaines.map(domain => (
                <tr key={domain.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="p-2 text-gray-600 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900"><span className="text-gray-400 mr-1">{domain.isoRef}</span>{domain.nom}</td>
                  {ODD_KEYS.map(odd => {
                    const covered = domain.ods.includes(odd); const meta = ODD_META[odd]
                    return (
                      <td key={odd} className="p-1 text-center">
                        {covered ? <div className="w-4 h-4 rounded-sm mx-auto" style={{ backgroundColor: meta.couleur }} title={`${domain.nom} → ${meta.nom}`} /> : <div className="w-4 h-4 mx-auto" />}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ODDExplorerApp({ ctx }: { ctx: RseContext }) {
  const [view, setView]                 = useState<OddView>('intro')
  const [selectedOdd, setSelectedOdd]   = useState<string | null>(null)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [pilierFilter, setPilierFilter] = useState<'all' | 'G' | 'E' | 'S'>('all')

  const { org, year } = ctx
  const [diagId, setDiagId] = useState<string | null>(null)
  const [diagScores, setDiagScores] = useState<Record<string, number>>({})
  const [noteMap, setNoteMap] = useState<Record<string, unknown[]>>({})
  const [noteTextMap, setNoteTextMap] = useState<Record<string, string>>({})
  const [notesRemoteVersion, setNotesRemoteVersion] = useState(0)
  const notesSaveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (!org || !year) { setDiagId(null); setDiagScores({}); return }
    async function load() {
      const res = await fetch(`/api/iso26000-diagnostic?org_id=${org!.id}&year=${year}`)
      const j = await res.json()
      if (j.data) {
        setDiagId(j.data.id)
        setDiagScores(j.data.scores ?? {})
      } else {
        // Create if doesn't exist
        const cr = await fetch('/api/iso26000-diagnostic', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org!.id, year }),
        })
        const cj = await cr.json()
        if (cj.data) { setDiagId(cj.data.id); setDiagScores(cj.data.scores ?? {}) }
      }
    }
    load()
  }, [org, year])

  // Realtime subscription → scores live depuis iso26000_diagnostics
  useEffect(() => {
    if (!diagId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`odd_diag_scores_${diagId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'iso26000_diagnostics',
        filter: `id=eq.${diagId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const updated = payload.new as { scores?: Record<string, number> }
        if (updated.scores) setDiagScores(updated.scores)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [diagId])

  useEffect(() => {
    if (!diagId) return
    fetch(`/api/iso26000-diagnostic/${diagId}/notes`)
      .then(r => r.json())
      .then(j => {
        if (j.data?.sections) setNoteMap(j.data.sections)
        if (j.data?.notes) setNoteTextMap(j.data.notes)
        setNotesRemoteVersion(v => v + 1)
      })
      .catch(() => {})
  }, [diagId])

  const saveNoteText = useCallback((key: string, value: string) => {
    if (!diagId) return
    const existing = notesSaveTimerRef.current.get(key)
    if (existing) clearTimeout(existing)
    const t = setTimeout(async () => {
      await fetch(`/api/iso26000-diagnostic/${diagId}/notes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: key, content: value }),
      })
      notesSaveTimerRef.current.delete(key)
    }, 800)
    notesSaveTimerRef.current.set(key, t)
  }, [diagId])

  const ODD_KEYS = Array.from({ length: 17 }, (_, i) => `ODD${i + 1}`)

  const selectedMeta = selectedOdd ? ODD_META[selectedOdd] : null
  const selectedNum  = selectedOdd ? parseInt(selectedOdd.replace('ODD', ''), 10) : null

  // Couverture par ODD : nb de domaines avec score > 0
  const oddCoverage = useMemo(() => {
    const result: Record<string, { evaluated: number; total: number }> = {}
    for (const oddKey of ODD_KEYS) {
      const domains = ODD_MAPPING[oddKey]
      const evaluated = domains.filter(e => (diagScores[e.domain.id] ?? 0) > 0).length
      result[oddKey] = { evaluated, total: domains.length }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagScores])

  const filteredEntries = useMemo(() => {
    if (!selectedOdd) return []
    const entries = ODD_MAPPING[selectedOdd]
    return pilierFilter === 'all' ? entries : entries.filter(e => e.qc.pilier === pilierFilter)
  }, [selectedOdd, pilierFilter])

  function handleSelectOdd(odd: string) {
    setSelectedOdd(prev => prev === odd ? null : odd)
    setExpandedDomain(null)
    setPilierFilter('all')
    if (view !== 'explorer') setView('explorer')
  }

  return (
    <div className="space-y-6">
      <ViewTabs tabs={ODD_TABS} active={view} onChange={setView} />

      {/* ── VUE PRÉSENTATION ──────────────────────────────────────────────── */}
      {view === 'intro' && (
        <div className="space-y-8">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-teal-700 p-8 text-white">
            <div className="relative z-10">
              <div className="text-5xl mb-4">🌍</div>
              <h1 className="text-3xl font-bold mb-3">ISO 26000 & Objectifs de Développement Durable</h1>
              <p className="text-lg text-white/90 max-w-2xl leading-relaxed">
                Explorez les correspondances entre les 37 domaines d&apos;action de la norme ISO 26000 et les 17 Objectifs de Développement Durable des Nations Unies. Comprenez comment votre démarche RSE contribue à l&apos;Agenda 2030.
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <button onClick={() => setView('explorer')} className="px-5 py-2.5 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors">
                  🌍 Explorateur ODD
                </button>
                <button onClick={() => setView('matrice')} className="px-5 py-2.5 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors">
                  📊 Matrice de correspondance
                </button>
              </div>
            </div>
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
            <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full" />
          </div>

          {/* Stats */}
          <StatsBar />

          {/* Les 7 QC */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7 questions centrales ISO 26000</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {QC_LIST.map(qc => {
                const oddSet = new Set(qc.domaines.flatMap(d => d.ods))
                const pilierStyle = PILIER_STYLES[qc.pilier]
                return (
                  <div key={qc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${qc.couleur}22` }}>{qc.icone}</div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{qc.nom}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pilierStyle.bg} ${pilierStyle.text}`}>{pilierStyle.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3 line-clamp-3">{qc.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{qc.domaines.length} domaine{qc.domaines.length > 1 ? 's' : ''}</span>
                      <span>{oddSet.size} ODD</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Navigation vers autres apps */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Applications RSE liées</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link href="/rse/diagnostic-initial" className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-sm transition-all">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Diagnostic initial guidé RSE</div>
                  <div className="text-xs text-gray-500 mt-0.5">Évaluez rapidement vos 13 domaines prioritaires ISO 26000</div>
                </div>
              </Link>
              <Link href="/rse/iso26000" className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-sm transition-all">
                <span className="text-2xl">🔍</span>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Diagnostic RSE ISO 26000</div>
                  <div className="text-xs text-gray-500 mt-0.5">Diagnostic complet sur les 37 domaines d&apos;action</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── VUE EXPLORATEUR ──────────────────────────────────────────────────── */}
      {view === 'explorer' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Sélectionnez un Objectif de Développement Durable</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
              {ODD_KEYS.map(odd => (
                <OddCard
                  key={odd}
                  oddKey={odd}
                  selected={selectedOdd === odd}
                  onClick={() => handleSelectOdd(odd)}
                  evaluated={oddCoverage[odd]?.evaluated ?? 0}
                  total={oddCoverage[odd]?.total ?? 0}
                />
              ))}
            </div>
          </div>

          {selectedOdd && selectedMeta && selectedNum !== null && (
            <div className="space-y-4">
              <div className="rounded-xl p-5 text-white" style={{ backgroundColor: selectedMeta.couleur }}>
                <div className="flex items-start gap-4">
                  <img
                    src={oddImgSrc(selectedNum)}
                    alt={`ODD ${selectedNum}`}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-md"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium uppercase tracking-wide opacity-80 mb-1">ODD {selectedNum}</div>
                    <h2 className="text-xl font-bold mb-2">{selectedMeta.nom}</h2>
                    <p className="text-sm opacity-90 leading-relaxed">{selectedMeta.description}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2 text-sm">
                  <span className="font-semibold">{ODD_MAPPING[selectedOdd].length}</span>
                  <span className="opacity-80">domaine{ODD_MAPPING[selectedOdd].length > 1 ? 's' : ''} ISO 26000 contribue{ODD_MAPPING[selectedOdd].length > 1 ? 'nt' : ''} à cet objectif</span>
                </div>
              </div>

              {ODD_MAPPING[selectedOdd].length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500">Filtrer par pilier :</span>
                  {(['all', 'G', 'E', 'S'] as const).map(p => {
                    const labels: Record<string, string> = { all: 'Tous', G: '🏛️ Gouvernance', E: '🌿 Environnement', S: '🤝 Social' }
                    const count = p === 'all' ? ODD_MAPPING[selectedOdd].length : ODD_MAPPING[selectedOdd].filter(e => e.qc.pilier === p).length
                    if (count === 0 && p !== 'all') return null
                    return (
                      <button key={p} onClick={() => setPilierFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pilierFilter === p ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} style={pilierFilter === p ? { backgroundColor: selectedMeta.couleur } : undefined}>
                        {labels[p]} ({count})
                      </button>
                    )
                  })}
                </div>
              )}

              {filteredEntries.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">{filteredEntries.length} domaine{filteredEntries.length > 1 ? 's' : ''} d&apos;action · Cliquez pour développer</div>
                  {filteredEntries.map(entry => (
                    <DomainCard
                      key={entry.domain.id}
                      entry={entry}
                      expandedId={expandedDomain}
                      onToggle={(id) => setExpandedDomain(prev => prev === id ? null : id)}
                      diagId={diagId}
                      domainScore={diagScores[entry.domain.id]}
                      noteTextMap={noteTextMap}
                      noteMap={noteMap}
                      notesRemoteVersion={notesRemoteVersion}
                      onNoteChange={(key, v) => {
                        setNoteTextMap(prev => ({ ...prev, [key]: v }))
                        saveNoteText(key, v)
                      }}
                      onSectionsChange={(key, s) => setNoteMap(prev => ({ ...prev, [key]: s as unknown[] }))}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">Aucun domaine pour ce filtre.</div>
              )}
            </div>
          )}

          {!selectedOdd && (
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🌍</div>
              <div className="text-sm">Sélectionnez un ODD pour voir les domaines ISO 26000 qui y contribuent.</div>
            </div>
          )}
        </div>
      )}

      {/* ── VUE MATRICE ──────────────────────────────────────────────────────── */}
      {view === 'matrice' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Matrice ISO 26000 × ODD</h2>
            <p className="text-sm text-gray-500">Chaque cellule colorée indique qu&apos;un domaine d&apos;action contribue à l&apos;ODD correspondant. Cliquez sur un numéro pour l&apos;explorer.</p>
          </div>
          <MatrixView onOddSelect={(odd) => { setView('explorer'); setSelectedOdd(odd); setExpandedDomain(null); setPilierFilter('all') }} />
        </div>
      )}
    </div>
  )
}
