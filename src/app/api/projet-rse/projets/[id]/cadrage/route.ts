// /api/projet-rse/projets/[id]/cadrage — fiche de cadrage et business case
// durable. Une fiche par projet ; son incomplétude interdit le démarrage.
import { ficheDeProjet } from '@/lib/projet-rse/crud'

export const dynamic = 'force-dynamic'

const { GET, PUT } = ficheDeProjet({
  table: 'projet_rse_cadrage',
  cle: 'cadrage',
  champs: ['finalite', 'livrable', 'capacite_visee', 'benefice_attendu',
    'pilote_acteur_id', 'parrain_acteur_id', 'perimetre_inclus', 'perimetre_exclu',
    'dependances', 'charge_etp', 'origine_ressources', 'budget_adosse',
    'budget_nouveau', 'justification', 'alternatives', 'criteres_succes',
    'seuils_impact', 'approche'],
})

export { GET, PUT }
