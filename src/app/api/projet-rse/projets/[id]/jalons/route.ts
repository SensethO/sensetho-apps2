// /api/projet-rse/projets/[id]/jalons — un jalon n'est pas une date, c'est une
// décision : critère écrit avant, preuve exigée, instance qui prononce,
// conséquence d'un manquement.
import { routesDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, POST, PATCH, DELETE } = routesDeProjet({
  table: 'projet_rse_jalons', cle: 'jalons', requis: 'libelle',
  tri: { colonne: 'echeance' },
  champs: ['libelle', 'nature', 'echeance', 'critere', 'preuve', 'instance',
    'consequence', 'statut', 'franchi_le'],
})

export { GET, POST, PATCH, DELETE }
