// Registre des sous-applications de Projet RSE — chaque nouvelle sous-app
// s'enregistre ici sans toucher au cœur. Le cœur (ProjetRseApp) génère un
// onglet par module : un module « disponible » monte son composant autour du
// projet courant, un module « a_venir » affiche sa carte descriptive.

import ProjetRsePartiesModule from '@/components/apps/ProjetRsePartiesModule'

export interface ProjetRseModuleProps {
  projetId: string
  organisationId: string
  phase: string
  readOnly: boolean
}

export interface ProjetRseModule {
  id: string
  label: string
  icon: string
  /** Phase PRiSM où le module est le plus utile (indicatif, jamais bloquant). */
  phasePrincipale?: string
  statut: 'disponible' | 'a_venir'
  description: string
  Component?: React.ComponentType<ProjetRseModuleProps>
}

export const PROJET_RSE_MODULES: ProjetRseModule[] = [
  {
    id: 'cadrage',
    label: 'Cadrage & Business case durable',
    icon: '🎯',
    phasePrincipale: 'pre_project',
    statut: 'a_venir',
    description:
      'Justification du projet, analyse des alternatives, objectifs, seuils d’impact et critères de succès : le business case durable est la référence interrogée à chaque revue de fin de phase.',
  },
  {
    id: 'parties-prenantes',
    label: 'Parties prenantes',
    icon: '👥',
    phasePrincipale: 'discovery',
    statut: 'disponible',
    description:
      'Registre des parties prenantes (dont la société et la Terre), matrice Pouvoir × Intérêt interactive et plan d’engagement — le processus est continu sur tout le cycle de vie.',
    Component: ProjetRsePartiesModule,
  },
  {
    id: 'p5ia',
    label: 'Analyse d’impact P5',
    icon: '🌍',
    phasePrincipale: 'discovery',
    statut: 'a_venir',
    description:
      '52 éléments People / Planet / Prosperity évalués sur une échelle de 1 à 5, avec la règle anti-masquage : un impact très négatif ne peut pas être compensé par un impact positif ailleurs.',
  },
  {
    id: 'smp',
    label: 'Plan de management de la durabilité',
    icon: '📋',
    phasePrincipale: 'design',
    statut: 'a_venir',
    description:
      'KPI de durabilité, seuils d’alerte, procédures d’escalade et matériau de reporting : le SMP transforme l’analyse d’impact en engagements mesurables et suivis.',
  },
  {
    id: 'cycle',
    label: 'WBS, RACI, risques & jalons',
    icon: '🗺️',
    phasePrincipale: 'delivery',
    statut: 'a_venir',
    description:
      'Découpage du travail (WBS), matrice de responsabilités (RACI), registre des risques et jalons du projet — l’outillage classique du chef de projet, revisité durable.',
  },
  {
    id: 'impact-social',
    label: 'Théorie du changement, SROI & Lean Startup',
    icon: '💫',
    phasePrincipale: 'closure',
    statut: 'a_venir',
    description:
      'Théorie du changement, mesure du retour social sur investissement (SROI) et boucles d’apprentissage Lean Startup pour piloter et prouver l’impact social du projet.',
  },
]
