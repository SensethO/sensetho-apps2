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

/** Script attendu par défaut : celui qui crée les tables des modules. */
export const SCRIPT_MODULES = '20260831_projet_rse_modules.sql'
/** Script qui ouvre les notes aux niveaux autres que le projet. */
export const SCRIPT_MULTI_NIVEAUX = '20260901_projet_rse_notes_multi_niveaux.sql'

/**
 * Traduit une erreur Supabase en message affichable.
 *
 * `script` nomme la migration qui manque réellement. L'indiquer est loin d'être
 * cosmétique : renvoyer vers un script déjà exécuté fait chercher au mauvais
 * endroit.
 */
export function messageErreur(
  e: { code?: string; message?: string },
  script: string = SCRIPT_MODULES,
): string {
  if (!structureAbsente(e)) return e.message ?? 'Erreur inattendue'
  return 'Cette sous-application attend sa migration : le script '
       + script + ' n’a pas encore été exécuté dans Supabase.'
}
