// Lecture tolérante de l'identifiant d'une sous-ressource sur les routes DELETE.
//
// Contexte : sur les routes imbriquées sous un segment dynamique
// (/api/projet-rse/projets/[id]/parties, .../engagements), la chaîne de requête
// n'arrive pas jusqu'au gestionnaire en production — `req.nextUrl.searchParams`
// y est vide alors qu'elle est correctement renseignée sur les routes statiques
// et en développement. Conséquence observée le 30 août 2026 : la suppression
// d'une partie prenante ou d'une action d'engagement répondait « id requis »
// quel que soit le paramètre transmis, rendant les boutons de suppression
// inopérants.
//
// Le correctif ne cherche pas à deviner la cause : il lit l'identifiant aux
// trois endroits où il peut légitimement se trouver, dans l'ordre du moins
// coûteux au plus coûteux, et s'arrête au premier trouvé.

import type { NextRequest } from 'next/server'

/** Identifiant de sous-ressource, lu dans nextUrl, puis dans l'URL brute, puis dans le corps JSON. */
export async function lireIdentifiant(
  req: NextRequest,
  cle = 'id',
): Promise<string | null> {
  const depuisNextUrl = req.nextUrl.searchParams.get(cle)
  if (depuisNextUrl) return depuisNextUrl

  // L'URL brute survit à certaines réécritures qui vident nextUrl.
  try {
    const depuisUrl = new URL(req.url).searchParams.get(cle)
    if (depuisUrl) return depuisUrl
  } catch {
    // URL non analysable : on passe au corps.
  }

  // Dernier recours : le client peut transmettre l'identifiant dans le corps.
  try {
    const corps = await req.json() as Record<string, unknown> | null
    const valeur = corps?.[cle]
    if (typeof valeur === 'string' && valeur) return valeur
  } catch {
    // Pas de corps, ou corps non JSON : rien de plus à tenter.
  }

  return null
}
