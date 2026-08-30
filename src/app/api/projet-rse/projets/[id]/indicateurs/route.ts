// /api/projet-rse/projets/[id]/indicateurs — le niveau est obligatoire : c'est
// lui qui empêche de confondre une mesure d'activité avec une mesure de
// résultat, erreur exacte du programme précédent.
import { routesDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, POST, PATCH, DELETE } = routesDeProjet({
  table: 'projet_rse_indicateurs', cle: 'indicateurs', requis: 'nom',
  champs: ['nom', 'mesure', 'niveau', 'formule', 'source', 'frequence',
    'proprietaire_acteur_id', 'valeur_depart', 'cible', 'tolerance',
    'instance_saisie', 'obligatoire'],
})

export { GET, POST, PATCH, DELETE }
