// /api/projet-rse/projets/[id]/impact-social — théorie du changement et
// retour social. Le ratio n'a de valeur qu'accompagné de sa méthode.
import { ficheDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, PUT } = ficheDeProjet({
  table: 'projet_rse_impact_social', cle: 'impact',
  champs: ['besoin', 'activites', 'extrants', 'resultats', 'impacts',
    'hypotheses', 'sroi_investissement', 'sroi_valeur', 'sroi_methode', 'boucles'],
})

export { GET, PUT }
