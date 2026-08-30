// /api/projet-rse/projets/[id]/p5 — cotations de l'analyse d'impact.
// Le référentiel des éléments est porté par le code applicatif ; la base ne
// stocke que les notes, ce qui évite de figer une nomenclature.
import { routesDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, POST, PATCH, DELETE } = routesDeProjet({
  table: 'projet_rse_p5', cle: 'cotations', requis: 'code',
  tri: { colonne: 'code' },
  champs: ['code', 'note', 'commentaire'],
})

export { GET, POST, PATCH, DELETE }
