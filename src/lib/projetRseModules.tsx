// Registre des sous-applications de Projet RSE — chaque nouvelle sous-app
// s'enregistre ici sans toucher au cœur. Le cœur (ProjetRseApp) génère un
// onglet par module : un module « disponible » monte son composant autour du
// projet courant, un module « a_venir » affiche sa carte descriptive.

import ProjetRsePartiesModule from '@/components/apps/ProjetRsePartiesModule'
import ProjetRseCadrageModule from '@/components/apps/ProjetRseCadrageModule'
import ProjetRseCycleModule from '@/components/apps/ProjetRseCycleModule'
import ProjetRseP5Module from '@/components/apps/ProjetRseP5Module'
import ProjetRseSmpModule from '@/components/apps/ProjetRseSmpModule'
import ProjetRseImpactSocialModule from '@/components/apps/ProjetRseImpactSocialModule'

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
    statut: 'disponible',
    description:
      'Les douze rubriques de la fiche de cadrage, dont la capacité visée — ce que l’organisation saura faire une fois le livrable remis. Une fiche incomplète interdit le démarrage.',
    Component: ProjetRseCadrageModule,
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
    statut: 'disponible',
    description:
      'Les éléments People, Planet, Prosperity, Product et Process cotés de −3 à +3, avec la règle anti-masquage : aucune moyenne n’est affichée, seulement le pire élément de chaque catégorie.',
    Component: ProjetRseP5Module,
  },
  {
    id: 'smp',
    label: 'Plan de management de la durabilité',
    icon: '📋',
    phasePrincipale: 'design',
    statut: 'disponible',
    description:
      'Indicateurs de durabilité, seuils d’alerte et instance saisie au franchissement. Tenu au niveau du programme et non projet par projet, pour qu’il soit tenu par quelqu’un.',
    Component: ProjetRseSmpModule,
  },
  {
    id: 'cycle',
    label: 'WBS, RACI, risques & jalons',
    icon: '🗺️',
    phasePrincipale: 'delivery',
    statut: 'disponible',
    description:
      'Découpage du travail, matrice de responsabilités, jalons dotés de leur critère et de leur preuve, registre des risques et jeu minimal d’indicateurs. Les titulaires sont pris au registre des parties prenantes.',
    Component: ProjetRseCycleModule,
  },
  {
    id: 'impact-social',
    label: 'Théorie du changement, SROI & Lean Startup',
    icon: '💫',
    phasePrincipale: 'closure',
    statut: 'disponible',
    description:
      'Théorie du changement avec ses hypothèses écrites, retour social sur investissement dont le ratio reste masqué tant que la méthode ne l’est pas, et boucles d’apprentissage.',
    Component: ProjetRseImpactSocialModule,
  },
]
