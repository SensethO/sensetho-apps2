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

// ─── Flat domain list + QC start indices (module-level constants) ─────────────
const ALL_DOMAINS_FLAT: MappingEntry[] = QC_LIST.flatMap(qc => qc.domaines.map(d => ({ qc, domain: d })))
const QC_START_INDICES: number[] = (() => {
  const indices: number[] = []
  let idx = 0
  for (const qc of QC_LIST) { indices.push(idx); idx += qc.domaines.length }
  return indices
})()

// ─── Maturity levels ──────────────────────────────────────────────────────────
const MATURITY_LEVELS = [
  { label: 'Non évalué',       color: '#9ca3af' },
  { label: 'Inexistant',       color: '#ef4444' },
  { label: 'Initié',           color: '#f97316' },
  { label: 'En développement', color: '#eab308' },
  { label: 'Maîtrisé',        color: '#22c55e' },
  { label: 'Exemplaire',       color: '#0ea5e9' },
]

// ─── ViewTabs ─────────────────────────────────────────────────────────────────
const ODD_TABS = [
  { id: 'accueil'    as const, label: 'Accueil',         icon: '🏠' },
  { id: 'diagnostic' as const, label: 'Diagnostic ISO',  icon: '📝' },
  { id: 'odd'        as const, label: 'Vue ODD',         icon: '🌍' },
  { id: 'dashboard'  as const, label: 'Tableau de bord', icon: '🎯' },
  { id: 'plan'       as const, label: "Plan d'actions",  icon: '✅' },
  { id: 'search'     as const, label: 'Recherche',       icon: '🔍' },
] as const
type OddView = typeof ODD_TABS[number]['id']

// ─── Pilier styles ────────────────────────────────────────────────────────────
const PILIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  G: { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300',  label: 'Gouvernance' },
  E: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Environnement' },
  S: { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-300',    label: 'Social' },
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
      className="relative flex flex-col transition-all hover:scale-105 hover:shadow-md"
      style={{ outline: selected ? `3px solid ${meta.couleur}` : '3px solid transparent', borderRadius: 8 }}
    >
      <div className="relative w-full">
        <img
          src={oddImgSrc(num)}
          alt={`ODD ${num}`}
          className="w-full aspect-square object-cover rounded-lg"
          loading="lazy"
        />
        {evaluated > 0 && (
          <div
            className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
            style={{ backgroundColor: meta.couleur, fontSize: 10 }}
          >
            {evaluated}
          </div>
        )}
      </div>
      <div className="w-full h-1 rounded-full mt-1 overflow-hidden bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${coveragePct}%`, backgroundColor: meta.couleur }}
        />
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
  const [expandedNoteAction, setExpandedNoteAction] = useState<string | null>(null)

  useEffect(() => { if (!isExpanded) setExpandedNoteAction(null) }, [isExpanded])

  const score = domainScore ?? 0
  const maturity = MATURITY_LEVELS[Math.min(score, 5)]

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => onToggle(domain.id)}>
        <div className="flex-shrink-0 text-xl">{qc.icone}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pilier.bg} ${pilier.text}`}>{pilier.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{domain.isoRef}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{domain.nom}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{qc.nom}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {[1,2,3,4,5].map(lvl => (
            <div
              key={lvl}
              className="w-3.5 h-3.5 rounded-full transition-all duration-500"
              style={{ backgroundColor: score >= lvl ? MATURITY_LEVELS[lvl].color : '#d1d5db' }}
            />
          ))}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ml-1 flex-shrink-0"
            style={{ backgroundColor: score > 0 ? maturity.color : '#6b7280' }}
          >
            {score}
          </div>
        </div>
        <svg className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{domain.description}</p>
          {diagId && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Niveau de maturité</div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">⟳ calculé depuis les actions</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[1,2,3,4,5].map(lvl => (
                  <div key={lvl}
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300"
                    style={score >= lvl
                      ? { backgroundColor: MATURITY_LEVELS[lvl].color, borderColor: MATURITY_LEVELS[lvl].color, color: 'white' }
                      : { backgroundColor: 'transparent', borderColor: '#e5e7eb' }
                    }
                  >
                    {score >= lvl ? lvl : ''}
                  </div>
                ))}
                {score > 0 && (
                  <span className="ml-1 text-xs font-semibold px-2.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: MATURITY_LEVELS[Math.min(score,5)].color }}>
                    {score} — {MATURITY_LEVELS[Math.min(score,5)].label}
                  </span>
                )}
              </div>
            </div>
          )}
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
                  const noteOpen = expandedNoteAction === actionKey
                  return (
                    <li key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/40">
                        <span className="flex-shrink-0 mt-0.5 text-green-500 font-bold text-xs">✓</span>
                        <span className="flex-1 text-xs text-gray-700 dark:text-gray-200 font-medium leading-relaxed">{action}</span>
                        {diagId && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedNoteAction(prev => prev === actionKey ? null : actionKey) }}
                            className="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded transition-colors"
                            title={noteOpen ? 'Fermer notes' : 'Notes & documents'}
                            style={{ color: noteOpen ? '#6366f1' : '#9ca3af' }}
                          >
                            {noteOpen ? '▼' : '▶'}
                          </button>
                        )}
                      </div>
                      {diagId && noteOpen && (
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

// ─── Auto-scoring from action progress ───────────────────────────────────────
// Formule : moyenne des progressions non-N/A / 2 → arrondi → score 0-5
function computeScoresFromProgress(
  currentScores: Record<string, number>,
  progress: Record<string, number>,
  na: Record<string, boolean>,
): Record<string, number> {
  const result = { ...currentScores }
  for (const qc of QC_LIST) {
    for (const domain of qc.domaines) {
      const keys = domain.actions.map((_, i) => `${domain.id}_${i}`)
      const nonNaKeys = keys.filter(k => !(na[k] ?? false))
      if (nonNaKeys.length === 0) continue
      const hasProgress = nonNaKeys.some(k => (progress[k] ?? 0) > 0)
      if (hasProgress) {
        const total = nonNaKeys.reduce((sum, k) => sum + (progress[k] ?? 0), 0)
        result[domain.id] = Math.round(total / nonNaKeys.length / 2)
      }
    }
  }
  return result
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ODDExplorerApp({ ctx }: { ctx: RseContext }) {
  const [view, setView]                       = useState<OddView>('accueil')
  const [selectedOdd, setSelectedOdd]         = useState<string | null>(null)
  const [expandedDomain, setExpandedDomain]   = useState<string | null>(null)
  const [pilierFilter, setPilierFilter]       = useState<'all' | 'G' | 'E' | 'S'>('all')
  const [diagDomainIndex, setDiagDomainIndex] = useState(0)
  const [planQcFilter, setPlanQcFilter]       = useState('all')
  const [searchQuery, setSearchQuery]         = useState('')
  const [showMatrix, setShowMatrix]           = useState(false)

  const { org, year } = ctx
  const [diagId, setDiagId]                   = useState<string | null>(null)
  const [diagScores, setDiagScores]           = useState<Record<string, number>>({})
  const [noteMap, setNoteMap]                 = useState<Record<string, unknown[]>>({})
  const [noteTextMap, setNoteTextMap]         = useState<Record<string, string>>({})
  const [notesRemoteVersion, setNotesRemoteVersion] = useState(0)
  const notesSaveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const scoreTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const diagScoresRef     = useRef<Record<string, number>>({})

  const [actionProgress, setActionProgress] = useState<Record<string, number>>({})
  const [actionNa, setActionNa]             = useState<Record<string, boolean>>({})
  const actionProgressRef = useRef<Record<string, number>>({})
  const actionNaRef       = useRef<Record<string, boolean>>({})
  const actionTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!org || !year) { setDiagId(null); setDiagScores({}); return }
    async function load() {
      const res = await fetch(`/api/iso26000-diagnostic?org_id=${org!.id}&year=${year}`)
      const j = await res.json()
      if (j.data) {
        setDiagId(j.data.id)
        setDiagScores(j.data.scores ?? {})
        const ap = (j.data.action_progress ?? {}) as Record<string, number>
        const an = (j.data.action_na ?? {}) as Record<string, boolean>
        setActionProgress(ap); actionProgressRef.current = ap
        setActionNa(an);       actionNaRef.current       = an
        diagScoresRef.current = j.data.scores ?? {}
      } else {
        const cr = await fetch('/api/iso26000-diagnostic', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org!.id, year }),
        })
        const cj = await cr.json()
        if (cj.data) { setDiagId(cj.data.id); setDiagScores(cj.data.scores ?? {}) }
      }
      fetch('/api/sync-diagnostic-scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org!.id, year, source: 'guided' }),
      }).then(r => r.json()).then(sync => {
        if ((sync.synced ?? 0) > 0) {
          fetch(`/api/iso26000-diagnostic?org_id=${org!.id}&year=${year}`)
            .then(r => r.json()).then(fresh => {
              if (fresh.data?.scores) setDiagScores(fresh.data.scores)
            }).catch(() => {})
        }
      }).catch(() => {})
    }
    load()
  }, [org, year])

  useEffect(() => {
    if (!diagId) return
    const supabase = createClient()
    let realtimeOk = false
    const channel = supabase
      .channel(`odd_diag_scores_${diagId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'iso26000_diagnostics',
        filter: `id=eq.${diagId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        realtimeOk = true
        const updated = payload.new as { scores?: Record<string, number> }
        if (updated.scores) setDiagScores(updated.scores)
      })
      .subscribe((status: string) => { if (status === 'SUBSCRIBED') realtimeOk = true })
    const poll = setInterval(() => {
      if (realtimeOk) return
      fetch(`/api/iso26000-diagnostic/${diagId}`)
        .then(r => r.json())
        .then(j => { if (j.data?.scores) setDiagScores(j.data.scores) })
        .catch(() => {})
    }, 4000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
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

  useEffect(() => { diagScoresRef.current = diagScores }, [diagScores])

  const saveScore = useCallback((domainId: string, score: number) => {
    if (!diagId) return
    setDiagScores(prev => {
      const next = { ...prev, [domainId]: score }
      diagScoresRef.current = next
      return next
    })
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current)
    scoreTimerRef.current = setTimeout(async () => {
      await fetch(`/api/iso26000-diagnostic/${diagId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: diagScoresRef.current }),
      })
      if (org?.id) {
        fetch('/api/sync-diagnostic-scores', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org.id, year, source: 'iso26000' }),
        }).catch(() => {})
      }
      scoreTimerRef.current = null
    }, 800)
  }, [diagId, org, year])

  // ── Action progress + N/A ─────────────────────────────────────────────────
  const saveActionState = useCallback(async () => {
    if (!diagId) return
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
    actionTimerRef.current = setTimeout(async () => {
      await fetch(`/api/iso26000-diagnostic/${diagId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_progress: actionProgressRef.current,
          action_na:       actionNaRef.current,
          scores:          diagScoresRef.current,
        }),
      })
      if (org?.id) {
        fetch('/api/sync-diagnostic-scores', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org.id, year, source: 'iso26000' }),
        }).catch(() => {})
      }
      actionTimerRef.current = null
    }, 800)
  }, [diagId, org, year])

  const setActionProgressKey = useCallback((key: string, value: number) => {
    if (!diagId) return
    const newProg = { ...actionProgressRef.current, [key]: value }
    setActionProgress(newProg)
    actionProgressRef.current = newProg
    const newScores = computeScoresFromProgress(diagScoresRef.current, newProg, actionNaRef.current)
    setDiagScores(newScores); diagScoresRef.current = newScores
    saveActionState()
  }, [diagId, saveActionState])

  const toggleActionNa = useCallback((key: string) => {
    if (!diagId) return
    const newNa = { ...actionNaRef.current, [key]: !(actionNaRef.current[key] ?? false) }
    setActionNa(newNa)
    actionNaRef.current = newNa
    const newScores = computeScoresFromProgress(diagScoresRef.current, actionProgressRef.current, newNa)
    setDiagScores(newScores); diagScoresRef.current = newScores
    saveActionState()
  }, [diagId, saveActionState])

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

  // ── Computed values ────────────────────────────────────────────────────────
  const globalScore = useMemo(() => {
    const allScores = ALL_DOMAINS_FLAT.map(e => diagScores[e.domain.id] ?? 0)
    const evaluated = allScores.filter(s => s > 0)
    if (evaluated.length === 0) return 0
    return Math.round((evaluated.reduce((s, v) => s + v, 0) / (evaluated.length * 5)) * 100)
  }, [diagScores])

  const evaluatedDomains = useMemo(() =>
    ALL_DOMAINS_FLAT.filter(e => (diagScores[e.domain.id] ?? 0) > 0).length,
    [diagScores]
  )

  const qcAvgScores = useMemo(() =>
    QC_LIST.map(qc => {
      const scores = qc.domaines.map(d => diagScores[d.id] ?? 0)
      return scores.reduce((s, v) => s + v, 0) / scores.length
    }),
    [diagScores]
  )

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
    if (view !== 'odd') setView('odd')
  }

  return (
    <div className="space-y-6">
      <ViewTabs tabs={ODD_TABS} active={view} onChange={setView} />

      {/* ── ACCUEIL ────────────────────────────────────────────────────────────── */}
      {view === 'accueil' && (
        <div className="space-y-6">
          {/* Score global + raccourcis */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 rounded-2xl p-6 bg-gradient-to-br from-green-600 to-teal-700 text-white">
              <div className="text-sm opacity-80 mb-1">Score global ISO 26000 × ODD</div>
              <div className="text-5xl font-bold mb-2">{diagId ? `${globalScore}%` : '—'}</div>
              <div className="text-sm opacity-70">
                {diagId
                  ? `${evaluatedDomains} / ${ALL_DOMAINS_FLAT.length} domaines évalués`
                  : 'Sélectionnez une organisation pour accéder au diagnostic'}
              </div>
              {diagId && (
                <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${globalScore}%` }} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => setView('diagnostic')}
                className="flex-1 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-all hover:border-green-300 dark:hover:border-green-600">
                <div className="text-xl mb-1">📝</div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">Diagnostic ISO</div>
                <div className="text-xs text-gray-500 mt-0.5">Évaluer les 37 domaines</div>
              </button>
              <button onClick={() => setView('odd')}
                className="flex-1 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:shadow-md transition-all hover:border-green-300 dark:hover:border-green-600">
                <div className="text-xl mb-1">🌍</div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">Vue ODD</div>
                <div className="text-xs text-gray-500 mt-0.5">Explorer par objectif ONU</div>
              </button>
            </div>
          </div>

          {/* 7 QC cards */}
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Vue d&apos;ensemble — 7 questions centrales ISO 26000</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {QC_LIST.map((qc, qcIdx) => {
                const evaluatedInQc = qc.domaines.filter(d => (diagScores[d.id] ?? 0) > 0).length
                const pct = Math.round((evaluatedInQc / qc.domaines.length) * 100)
                const avgScore = qcAvgScores[qcIdx]
                const pilierStyle = PILIER_STYLES[qc.pilier]
                const oddSet = new Set(qc.domaines.flatMap(d => d.ods))
                return (
                  <button
                    key={qc.id}
                    onClick={() => { setDiagDomainIndex(QC_START_INDICES[qcIdx]); setView('diagnostic') }}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md transition-all hover:border-green-300 dark:hover:border-green-600"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: `${qc.couleur}22` }}>{qc.icone}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{qc.nom}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pilierStyle.bg} ${pilierStyle.text}`}>{pilierStyle.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-500">{evaluatedInQc}/{qc.domaines.length} domaines · {oddSet.size} ODD</span>
                      <span className="font-bold" style={{ color: pct > 0 ? qc.couleur : '#9ca3af' }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: qc.couleur }} />
                    </div>
                    {diagId && (
                      <div className="mt-2 text-xs text-gray-400">Score moyen : <span className="font-semibold">{avgScore.toFixed(1)}/5</span></div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Apps liées */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Applications RSE liées</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link href="/rse/diagnostic-initial" className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-sm transition-all">
                <span className="text-xl">📋</span>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Diagnostic initial guidé RSE</div>
                  <div className="text-xs text-gray-500 mt-0.5">Évaluez rapidement vos 13 domaines prioritaires ISO 26000</div>
                </div>
              </Link>
              <Link href="/rse/iso26000" className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-sm transition-all">
                <span className="text-xl">🔍</span>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Diagnostic RSE ISO 26000</div>
                  <div className="text-xs text-gray-500 mt-0.5">Diagnostic complet sur les 37 domaines d&apos;action</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── DIAGNOSTIC ISO ─────────────────────────────────────────────────────── */}
      {view === 'diagnostic' && (
        <div className="space-y-4">
          {/* QC pills */}
          <div className="flex flex-wrap gap-2">
            {QC_LIST.map((qc, qcIdx) => {
              const isCurrentQc = diagDomainIndex >= QC_START_INDICES[qcIdx] &&
                (qcIdx === QC_LIST.length - 1 || diagDomainIndex < QC_START_INDICES[qcIdx + 1])
              const evaluatedInQc = qc.domaines.filter(d => (diagScores[d.id] ?? 0) > 0).length
              const pct = Math.round((evaluatedInQc / qc.domaines.length) * 100)
              return (
                <button
                  key={qc.id}
                  onClick={() => setDiagDomainIndex(QC_START_INDICES[qcIdx])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2"
                  style={isCurrentQc
                    ? { backgroundColor: qc.couleur, borderColor: qc.couleur, color: 'white' }
                    : { backgroundColor: 'transparent', borderColor: qc.couleur + '60', color: 'var(--text-muted)' }
                  }
                >
                  {qc.icone} {qc.id}
                  {pct > 0 && <span className="opacity-80">{pct}%</span>}
                </button>
              )
            })}
          </div>

          {/* Domain card */}
          {(() => {
            const entry = ALL_DOMAINS_FLAT[diagDomainIndex]
            if (!entry) return null
            const { qc, domain } = entry
            const score = diagScores[domain.id] ?? 0
            const maturity = MATURITY_LEVELS[score] ?? MATURITY_LEVELS[0]
            return (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: `${qc.couleur}22` }}>{qc.icone}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 mb-0.5">{qc.id} · {domain.isoRef}</div>
                      <div className="font-bold text-gray-900 dark:text-white leading-tight">{domain.nom}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{qc.nom}</div>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow"
                        style={{ backgroundColor: score > 0 ? maturity.color : '#9ca3af' }}
                      >
                        {score}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">{maturity.label}</div>
                    </div>
                  </div>

                  {/* NIVEAU DE MATURITÉ — lecture seule, calculé depuis les actions */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Niveau de maturité</span>
                      {diagId && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                          ⟳ calculé depuis les actions
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Indicateurs read-only */}
                      {[1,2,3,4,5].map(lvl => (
                        <div
                          key={lvl}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300"
                          style={score >= lvl
                            ? { backgroundColor: MATURITY_LEVELS[lvl].color, borderColor: MATURITY_LEVELS[lvl].color, color: 'white' }
                            : { backgroundColor: 'transparent', borderColor: '#e5e7eb' }
                          }
                          title={`${lvl} — ${MATURITY_LEVELS[lvl].label}`}
                        >
                          {score >= lvl ? lvl : ''}
                        </div>
                      ))}
                      {/* Badge niveau actuel */}
                      {score > 0 ? (
                        <span className="ml-1 text-sm font-semibold px-3 py-1 rounded-full text-white transition-all duration-300"
                          style={{ backgroundColor: maturity.color }}>
                          {score} — {maturity.label}
                        </span>
                      ) : (
                        <span className="ml-1 text-xs text-gray-400">
                          {diagId ? 'Évaluez les actions ci-dessous pour calculer automatiquement' : 'Sélectionnez une organisation'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5">
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{domain.description}</p>

                  {/* ODD tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {domain.ods.map(odd => {
                      const m = ODD_META[odd]; const n = parseInt(odd.replace('ODD',''),10)
                      return (
                        <span key={odd} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: m.couleur }}>
                          <img src={oddImgSrc(n)} alt={`ODD${n}`} className="w-3.5 h-3.5 rounded-sm" />
                          ODD{n} · {m.nom}
                        </span>
                      )
                    })}
                  </div>

                  {/* Actions avec barres de progression */}
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Actions clés ({domain.actions.length})
                  </div>
                  <ul className="space-y-2">
                    {domain.actions.map((action, i) => {
                      const aKey = `${domain.id}_${i}`
                      const prog = actionProgress[aKey] ?? 0
                      const isNa = actionNa[aKey] ?? false
                      // Couleur selon progression : rouge→orange→jaune→vert
                      const progColor = prog >= 9 ? '#22c55e'   // vert
                                      : prog >= 7 ? '#84cc16'   // vert-jaune
                                      : prog >= 5 ? '#eab308'   // jaune
                                      : prog >= 3 ? '#f97316'   // orange
                                      : prog >= 1 ? '#ef4444'   // rouge
                                      : '#9ca3af'               // gris (non démarré)
                      // Couleur du fond vide (toujours visible, légèrement colorée si démarré)
                      const emptyColor = prog > 0 ? `${progColor}30` : '#e5e7eb'
                      return (
                        <li key={i} className={`rounded-lg border overflow-hidden ${isNa ? 'opacity-60' : ''}`}
                          style={{ borderColor: prog > 0 && !isNa ? `${progColor}60` : 'var(--border, #e5e7eb)' }}>
                          {/* Ligne texte */}
                          <div className={`flex items-start gap-2 px-3 py-2 ${prog > 0 && !isNa ? '' : 'bg-gray-50 dark:bg-gray-700/30'}`}
                            style={prog > 0 && !isNa ? { backgroundColor: `${progColor}10` } : {}}>
                            <span className="flex-shrink-0 mt-0.5 font-bold text-xs leading-none"
                              style={{ color: prog >= 10 ? '#22c55e' : prog > 0 && !isNa ? progColor : '#9ca3af' }}>
                              {prog >= 10 ? '✓' : '○'}
                            </span>
                            <span className={`flex-1 text-xs font-medium leading-relaxed ${isNa ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                              {action}
                            </span>
                          </div>
                          {/* Ligne progress */}
                          {diagId && (
                            <div className="flex items-center gap-2 px-3 pb-2 pt-1.5 bg-white dark:bg-gray-800">
                              {/* 10 carrés toujours visibles */}
                              <div className="flex gap-0.5">
                                {Array.from({ length: 10 }, (_, n) => n + 1).map(n => (
                                  <button
                                    key={n}
                                    disabled={isNa}
                                    onClick={() => setActionProgressKey(aKey, prog === n ? 0 : n)}
                                    className="w-4 h-4 rounded-sm transition-all disabled:cursor-not-allowed"
                                    style={{
                                      backgroundColor: !isNa && prog >= n ? progColor : emptyColor,
                                      transform: !isNa && prog === n ? 'scaleY(1.3)' : undefined,
                                    }}
                                    title={n === 10 ? 'Terminée (10/10)' : `${n}/10`}
                                  />
                                ))}
                              </div>
                              <span className="text-[11px] tabular-nums font-semibold w-8 text-right"
                                style={{ color: prog > 0 && !isNa ? progColor : '#9ca3af' }}>
                                {prog > 0 ? `${prog}/10` : ''}
                              </span>
                              <button
                                onClick={() => toggleActionNa(aKey)}
                                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors ${
                                  isNa
                                    ? 'border-orange-400 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-500'
                                    : 'border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500 dark:border-gray-600 dark:text-gray-500'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )
          })()}

          {/* Navigation ← → */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setDiagDomainIndex(i => Math.max(0, i - 1))}
              disabled={diagDomainIndex === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              ← Précédente
            </button>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {diagDomainIndex + 1} / {ALL_DOMAINS_FLAT.length}
            </div>
            <button
              onClick={() => setDiagDomainIndex(i => Math.min(ALL_DOMAINS_FLAT.length - 1, i + 1))}
              disabled={diagDomainIndex === ALL_DOMAINS_FLAT.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Suivante →
            </button>
          </div>
        </div>
      )}

      {/* ── VUE ODD ────────────────────────────────────────────────────────────── */}
      {view === 'odd' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Sélectionnez un Objectif de Développement Durable</h2>
              <button
                onClick={() => setShowMatrix(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {showMatrix ? '🌍 Grille ODD' : '📊 Matrice'}
              </button>
            </div>

            {showMatrix ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-500 mb-3">Chaque cellule colorée indique qu&apos;un domaine contribue à l&apos;ODD. Cliquez sur un pictogramme pour explorer.</p>
                <MatrixView onOddSelect={(odd) => { setSelectedOdd(odd); setExpandedDomain(null); setPilierFilter('all'); setShowMatrix(false) }} />
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-3">
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
            )}
          </div>

          {selectedOdd && selectedMeta && selectedNum !== null && (
            <div className="space-y-4">
              <div className="rounded-xl p-5 text-white" style={{ backgroundColor: selectedMeta.couleur }}>
                <div className="flex items-start gap-4">
                  <img src={oddImgSrc(selectedNum)} alt={`ODD ${selectedNum}`} className="w-20 h-20 rounded-lg object-cover flex-shrink-0 shadow-md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide opacity-80 mb-1">ODD {selectedNum}</div>
                    <h2 className="text-xl font-bold mb-1">{selectedMeta.nom}</h2>
                    <p className="text-sm opacity-90 leading-relaxed">{selectedMeta.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-4xl font-bold leading-none">
                      {oddCoverage[selectedOdd]?.total > 0
                        ? Math.round((oddCoverage[selectedOdd].evaluated / oddCoverage[selectedOdd].total) * 100)
                        : 0}%
                    </div>
                    <div className="text-sm opacity-70 mt-0.5">couverture</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${oddCoverage[selectedOdd]?.total > 0 ? Math.round((oddCoverage[selectedOdd].evaluated / oddCoverage[selectedOdd].total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="text-sm opacity-80">
                    <span className="font-semibold text-white">{oddCoverage[selectedOdd]?.evaluated ?? 0}</span>
                    {' / '}{ODD_MAPPING[selectedOdd].length} domaine{ODD_MAPPING[selectedOdd].length > 1 ? 's' : ''} évalués
                  </div>
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
                      <button key={p} onClick={() => setPilierFilter(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pilierFilter === p ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        style={pilierFilter === p ? { backgroundColor: selectedMeta.couleur } : undefined}>
                        {labels[p]} ({count})
                      </button>
                    )
                  })}
                </div>
              )}

              {filteredEntries.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">{filteredEntries.length} domaine{filteredEntries.length > 1 ? 's' : ''} d&apos;action — cliquez pour évaluer</div>
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
                      onNoteChange={(key, v) => { setNoteTextMap(prev => ({ ...prev, [key]: v })); saveNoteText(key, v) }}
                      onSectionsChange={(key, s) => setNoteMap(prev => ({ ...prev, [key]: s as unknown[] }))}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">Aucun domaine pour ce filtre.</div>
              )}
            </div>
          )}

          {!selectedOdd && !showMatrix && (
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🌍</div>
              <div className="text-sm">Sélectionnez un ODD pour voir les domaines ISO 26000 qui y contribuent.</div>
            </div>
          )}
        </div>
      )}

      {/* ── TABLEAU DE BORD ────────────────────────────────────────────────────── */}
      {view === 'dashboard' && (
        <div className="space-y-6">
          {/* Score global + ODD couverts */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-6 bg-gradient-to-br from-green-600 to-teal-700 text-white">
              <div className="text-sm opacity-80 mb-1">Score global ISO 26000</div>
              <div className="text-5xl font-bold mb-2">{diagId ? `${globalScore}%` : '—'}</div>
              <div className="text-sm opacity-70">{evaluatedDomains} / {ALL_DOMAINS_FLAT.length} domaines évalués</div>
              {diagId && (
                <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${globalScore}%` }} />
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">ODD couverts</div>
              <div className="grid grid-cols-6 gap-1.5">
                {ODD_KEYS.map(odd => {
                  const cov = oddCoverage[odd]
                  const covered = cov.evaluated > 0
                  const num = parseInt(odd.replace('ODD',''),10)
                  return (
                    <button key={odd} onClick={() => handleSelectOdd(odd)} title={ODD_META[odd].nom}
                      className={`transition-all hover:scale-110 rounded ${covered ? 'opacity-100' : 'opacity-25 grayscale'}`}>
                      <img src={oddImgSrc(num)} alt={`ODD${num}`} className="w-full aspect-square rounded object-cover" />
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {ODD_KEYS.filter(o => oddCoverage[o]?.evaluated > 0).length} / 17 ODD adressés
              </div>
            </div>
          </div>

          {/* Radar + barres QC */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Radar SVG */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Radar — 7 questions centrales</div>
              {(() => {
                const n = 7; const size = 240; const cx = size/2; const cy = size/2; const r = 80
                const rings = [0.2, 0.4, 0.6, 0.8, 1.0]
                const axisPoints = QC_LIST.map((_, i) => {
                  const angle = (Math.PI*2*i)/n - Math.PI/2
                  return { x: cx + r*Math.cos(angle), y: cy + r*Math.sin(angle) }
                })
                const dataPoints = qcAvgScores.map((avg, i) => {
                  const norm = Math.min(avg / 5, 1)
                  const angle = (Math.PI*2*i)/n - Math.PI/2
                  return { x: cx + r*norm*Math.cos(angle), y: cy + r*norm*Math.sin(angle) }
                })
                const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')
                return (
                  <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs mx-auto">
                    {rings.map(ring => {
                      const pts = QC_LIST.map((_, i) => {
                        const angle = (Math.PI*2*i)/n - Math.PI/2
                        return `${cx + r*ring*Math.cos(angle)},${cy + r*ring*Math.sin(angle)}`
                      }).join(' ')
                      return <polygon key={ring} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                    })}
                    {axisPoints.map((p,i) => (
                      <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="0.5" />
                    ))}
                    <polygon points={polygon} fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeWidth="2" />
                    {dataPoints.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#10b981" />)}
                    {QC_LIST.map((qc, i) => {
                      const angle = (Math.PI*2*i)/n - Math.PI/2
                      const lr = r + 20
                      return (
                        <text key={i} x={cx + lr*Math.cos(angle)} y={cy + lr*Math.sin(angle)}
                          textAnchor="middle" dominantBaseline="middle" fontSize="13">
                          {qc.icone}
                        </text>
                      )
                    })}
                  </svg>
                )
              })()}
            </div>

            {/* Barres par QC */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Score par question centrale</div>
              <div className="space-y-3">
                {QC_LIST.map((qc, i) => {
                  const pct = Math.round((qcAvgScores[i] / 5) * 100)
                  const evaluatedInQc = qc.domaines.filter(d => (diagScores[d.id] ?? 0) > 0).length
                  return (
                    <div key={qc.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                          {qc.icone} <span className="truncate max-w-[160px]">{qc.nom}</span>
                        </span>
                        <span className="font-bold ml-2 flex-shrink-0" style={{ color: pct > 0 ? qc.couleur : '#9ca3af' }}>
                          {pct}% <span className="text-gray-400 font-normal">({evaluatedInQc}/{qc.domaines.length})</span>
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: qc.couleur }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAN D'ACTIONS ─────────────────────────────────────────────────────── */}
      {view === 'plan' && (
        <div className="space-y-4">
          {/* Header + filtre */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Actions prioritaires classées par niveau de maturité</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Les domaines les moins avancés apparaissent en premier</div>
            </div>
            <select
              value={planQcFilter}
              onChange={e => setPlanQcFilter(e.target.value)}
              className="ml-auto px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}
            >
              <option value="all">Toutes les questions centrales</option>
              {QC_LIST.map(qc => <option key={qc.id} value={qc.id}>{qc.icone} {qc.id} — {qc.nom}</option>)}
            </select>
          </div>

          {(() => {
            const filtered = planQcFilter === 'all'
              ? ALL_DOMAINS_FLAT
              : ALL_DOMAINS_FLAT.filter(e => e.qc.id === planQcFilter)

            const sorted = [...filtered].sort((a, b) => {
              const sA = diagScores[a.domain.id] ?? 0
              const sB = diagScores[b.domain.id] ?? 0
              return sA - sB
            })

            const totalActions = sorted.reduce((sum, e) => sum + e.domain.actions.length, 0)

            return (
              <div className="space-y-3">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sorted.length} domaines · {totalActions} actions</div>
                {sorted.map(({ qc, domain }) => {
                  const score = diagScores[domain.id] ?? 0
                  const matColor = MATURITY_LEVELS[score]?.color ?? '#9ca3af'
                  const matLabel = MATURITY_LEVELS[score]?.label ?? 'Non évalué'
                  return (
                    <div key={domain.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* Domain header */}
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-xl flex-shrink-0">{qc.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400">{qc.id} · {domain.isoRef}</div>
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{domain.nom}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {[1,2,3,4,5].map(lvl => (
                            <div key={lvl} className="w-3 h-3 rounded-full transition-all"
                              style={{ backgroundColor: score >= lvl ? MATURITY_LEVELS[lvl].color : '#e5e7eb' }} />
                          ))}
                          <span className="ml-1 text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: matColor }}>
                            {score}
                          </span>
                          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{matLabel}</span>
                        </div>
                      </div>
                      {/* Actions avec indicateurs de progression */}
                      <div className="px-4 py-3">
                        <ul className="space-y-2">
                          {domain.actions.map((action, i) => {
                            const aKey = `${domain.id}_${i}`
                            const prog = actionProgress[aKey] ?? 0
                            const isNa = actionNa[aKey] ?? false
                            const progColor = prog >= 8 ? '#22c55e' : prog >= 5 ? '#eab308' : prog > 0 ? '#f97316' : '#d1d5db'
                            return (
                              <li key={i} className={`flex items-start gap-2 text-xs ${isNa ? 'opacity-50' : 'text-gray-600 dark:text-gray-300'}`}>
                                <span className={`font-bold mt-0.5 flex-shrink-0 ${prog >= 10 ? 'text-green-500' : 'text-gray-300'}`}>✓</span>
                                <span className={`flex-1 leading-relaxed ${isNa ? 'line-through text-gray-400' : ''}`}>{action}</span>
                                {prog > 0 && !isNa && (
                                  <span className="flex-shrink-0 text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${progColor}22`, color: progColor }}>
                                    {prog}/10
                                  </span>
                                )}
                                {isNa && <span className="flex-shrink-0 text-[10px] text-orange-500 font-medium">N/A</span>}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── RECHERCHE ──────────────────────────────────────────────────────────── */}
      {view === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-sm">🔍</div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher (ex: bilan carbone, formation, fournisseurs...)"
              className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>

          {searchQuery.length >= 2 ? (() => {
            const q = searchQuery.toLowerCase()
            type SearchResult = { qc: CoreSubject; domain: ActionDomain; matchedActions: string[] }
            const results: SearchResult[] = []
            for (const { qc, domain } of ALL_DOMAINS_FLAT) {
              const domainMatch = domain.nom.toLowerCase().includes(q) || domain.description.toLowerCase().includes(q)
              const matchedActions = domain.actions.filter(a => a.toLowerCase().includes(q))
              const kpiMatch = domain.kpis.some(k => k.toLowerCase().includes(q))
              if (domainMatch || matchedActions.length > 0 || kpiMatch) {
                results.push({ qc, domain, matchedActions: domainMatch ? domain.actions : matchedActions })
              }
            }

            if (results.length === 0) {
              return (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="text-sm">Aucun résultat pour « {searchQuery} »</div>
                </div>
              )
            }

            return (
              <div className="space-y-3">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {results.length} domaine{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
                </div>
                {results.map(({ qc, domain, matchedActions }) => {
                  const score = diagScores[domain.id] ?? 0
                  const matColor = MATURITY_LEVELS[score]?.color ?? '#9ca3af'
                  return (
                    <div key={domain.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl flex-shrink-0">{qc.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400">{qc.id} · {domain.isoRef}</div>
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{domain.nom}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{qc.nom}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {[1,2,3,4,5].map(lvl => (
                            <div key={lvl} className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: score >= lvl ? MATURITY_LEVELS[lvl].color : '#e5e7eb' }} />
                          ))}
                          <span className="ml-1 text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: matColor }}>{score}</span>
                        </div>
                      </div>
                      {matchedActions.length > 0 && (
                        <ul className="space-y-1">
                          {matchedActions.slice(0, 5).map((action, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                              <span className="text-green-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                              <span className="leading-relaxed">{action}</span>
                            </li>
                          ))}
                          {matchedActions.length > 5 && (
                            <li className="text-xs text-gray-400 pl-4">… et {matchedActions.length - 5} action{matchedActions.length - 5 > 1 ? 's' : ''} supplémentaire{matchedActions.length - 5 > 1 ? 's' : ''}</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })() : (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-sm">Saisissez au moins 2 caractères pour rechercher</div>
              <div className="text-xs mt-1 opacity-70">Recherche dans les 37 domaines, descriptions, actions clés et indicateurs</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
