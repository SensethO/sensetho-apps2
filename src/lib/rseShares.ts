import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Helpers de partage des diagnostics RSE marbre.
 * Table générique `rse_diagnostic_shares` (app_slug, diagnostic_id, shared_with_user_id, permission).
 * Tous les appels passent par le service role (bypass RLS).
 */

type Admin = ReturnType<typeof createAdminClient>

/** Rôle admin ? */
async function isAdmin(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'admin'
}

/**
 * L'utilisateur peut-il accéder à ce diagnostic ?
 * - admin : toujours
 * - propriétaire (diagnostic.user_id) : toujours
 * - destinataire d'un partage : oui (lecture). Si requireEdit, partage doit être 'edit'.
 */
export async function canAccessDiagnostic(
  appSlug: string,
  table: string,
  userId: string,
  diagnosticId: string,
  opts: { requireEdit?: boolean } = {}
): Promise<boolean> {
  const admin = createAdminClient()
  if (await isAdmin(admin, userId)) return true

  const { data: diag } = await admin.from(table).select('user_id').eq('id', diagnosticId).single()
  if (diag?.user_id === userId) return true

  const { data: share } = await admin
    .from('rse_diagnostic_shares')
    .select('permission')
    .eq('app_slug', appSlug)
    .eq('diagnostic_id', diagnosticId)
    .eq('shared_with_user_id', userId)
    .maybeSingle()

  if (!share) return false
  if (opts.requireEdit) return share.permission === 'edit'
  return true
}

/**
 * Trouve un diagnostic partagé avec l'utilisateur pour une org + année données.
 * Renvoie la ligne complète ou null.
 */
export async function findSharedDiagnostic(
  appSlug: string,
  table: string,
  userId: string,
  orgId: string,
  annee: number
): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient()
  const { data: shares } = await admin
    .from('rse_diagnostic_shares')
    .select('diagnostic_id')
    .eq('app_slug', appSlug)
    .eq('shared_with_user_id', userId)
  const ids = (shares ?? []).map(s => s.diagnostic_id as string)
  if (!ids.length) return null

  const { data } = await admin
    .from(table)
    .select('*')
    .in('id', ids)
    .eq('org_id', orgId)
    .eq('annee', annee)
    .maybeSingle()
  return (data as Record<string, unknown>) ?? null
}
