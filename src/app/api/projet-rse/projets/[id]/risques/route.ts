// /api/projet-rse/projets/[id]/risques — registre des risques du projet.
// Un risque retiré est tracé avec son motif : sans cela le registre ne fait
// que croître et devient illisible.
import { routesDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, POST, PATCH, DELETE } = routesDeProjet({
  table: 'projet_rse_risques', cle: 'risques', requis: 'libelle',
  champs: ['code', 'libelle', 'categorie', 'probabilite', 'impact', 'reponse',
    'traitement', 'porteur_acteur_id', 'seuil_escalade', 'statut', 'motif_retrait'],
})

export { GET, POST, PATCH, DELETE }
