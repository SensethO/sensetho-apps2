// /api/projet-rse/projets/[id]/lots — structure de découpage du travail.
// Trois niveaux : projet, lot, tâche. La descente s'arrête dès qu'un lot peut
// être confié à une personne nommée avec une échéance et une charge.
import { routesDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, POST, PATCH, DELETE } = routesDeProjet({
  table: 'projet_rse_lots', cle: 'lots', requis: 'libelle',
  tri: { colonne: 'ordre' },
  champs: ['parent_id', 'code', 'libelle', 'description', 'charge_jh',
    'debut', 'echeance', 'statut', 'ordre'],
})

export { GET, POST, PATCH, DELETE }
