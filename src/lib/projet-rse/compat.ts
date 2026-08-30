// Tolérance à la migration non encore appliquée.
//
// Le code du registre d'acteurs est déployé avant que la migration SQL ne soit
// exécutée dans Supabase. Entre les deux, les nouvelles tables n'existent pas.
// Plutôt que de renvoyer une erreur — ce qui viderait l'écran des parties
// prenantes et ressemblerait à une perte de données — les routes concernées
// retombent sur l'ancien modèle, ou renvoient une liste vide selon le cas.
//
// Ce fichier est supprimable une fois la migration appliquée partout ; il ne
// coûte qu'un test sur le code d'erreur.

/** Vrai lorsque l'erreur signale une table ou une colonne absente. */
export function structureAbsente(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  // 42P01 : undefined_table · 42703 : undefined_column · PGRST205 : table inconnue du cache
  if (err.code === '42P01' || err.code === '42703' || err.code === 'PGRST205') return true
  const m = (err.message ?? '').toLowerCase()
  return m.includes('does not exist')
      || m.includes("could not find the table")
      || m.includes("could not find the 'acteur_id' column")
}
