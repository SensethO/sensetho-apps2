// Message lisible pour une structure absente.
//
// Tant que la migration des sous-applications n'a pas été exécutée dans
// Supabase, leurs tables n'existent pas. Sans cette traduction, l'interface
// afficherait « Could not find the table 'public.projet_rse_smp' », qui ne dit
// rien à qui n'a pas le contexte — et surtout ne dit pas quoi faire.

/** Vrai lorsque l'erreur signale une table ou une colonne absente. */
export function structureAbsente(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  if (e.code === '42P01' || e.code === '42703' || e.code === 'PGRST205') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('does not exist') || m.includes('could not find the table')
}

const ATTENTE = 'Cette sous-application attend sa migration : le script '
              + '20260831_projet_rse_modules.sql n’a pas encore été exécuté dans Supabase.'

/** Traduit une erreur Supabase en message affichable. */
export function messageErreur(e: { code?: string; message?: string }): string {
  return structureAbsente(e) ? ATTENTE : (e.message ?? 'Erreur inattendue')
}
