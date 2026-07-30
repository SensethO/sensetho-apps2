import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessOrgDossier } from '@/lib/rseShares'

const APP_SLUG = 'eudr-fournisseurs'

export interface AuthResult {
  ok: boolean
  status?: number
  error?: string
  userId?: string
}

/**
 * Erreur d'infrastructure (base injoignable) — à ne JAMAIS confondre avec un refus de droits.
 * Lors de l'incident du 30/07/2026, une base indisponible faisait répondre « Abonnement requis »
 * ou « Unauthorized », ce qui laissait croire à un problème de compte.
 */
class BackendUnavailable extends Error {}

async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).single()
  // PGRST116 = aucune ligne (profil réellement absent) : ce n'est pas une panne.
  if (error && error.code !== 'PGRST116') throw new BackendUnavailable(error.message)
  return data?.role === 'admin'
}

async function hasSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  if (await isAdmin(userId)) return true
  const { data, error } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', APP_SLUG)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new BackendUnavailable(error.message)
  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

/** L'utilisateur est-il propriétaire de l'organisation (ou admin) ? Requis pour gérer les identifiants. */
export async function isOrgOwner(userId: string, orgId: string): Promise<boolean> {
  if (await isAdmin(userId)) return true
  const admin = createAdminClient()
  const { data } = await admin.from('organisations').select('user_id').eq('id', orgId).single()
  return data?.user_id === userId
}

/**
 * Garde commune : session valide + abonnement actif + accès au dossier de l'org.
 * requireEdit=true pour les écritures vers le registre (submit/amend/retract).
 */
export async function guard(orgId: string | null, opts: { requireEdit?: boolean } = {}): Promise<AuthResult> {
  const supabase = createUserClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  // Base/auth injoignable : on renvoie 503, jamais un refus de droits trompeur.
  if (authError && !/session|jwt|token|expired|missing/i.test(authError.message)) {
    return { ok: false, status: 503, error: 'Service momentanément indisponible — réessayez dans un instant.' }
  }
  if (!user) return { ok: false, status: 401, error: 'Session expirée — reconnectez-vous.' }
  if (!orgId) return { ok: false, status: 400, error: 'org_id requis' }
  try {
    if (!await hasSubscription(user.id)) return { ok: false, status: 403, error: 'Abonnement requis' }
    if (!await canAccessOrgDossier(APP_SLUG, user.id, orgId, opts)) {
      return { ok: false, status: 403, error: 'Forbidden' }
    }
  } catch (e) {
    if (e instanceof BackendUnavailable) {
      return { ok: false, status: 503, error: 'Service momentanément indisponible — réessayez dans un instant.' }
    }
    throw e
  }
  return { ok: true, userId: user.id }
}
