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

async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'admin'
}

async function hasSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  if (await isAdmin(userId)) return true
  const { data } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', APP_SLUG)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }
  if (!orgId) return { ok: false, status: 400, error: 'org_id requis' }
  if (!await hasSubscription(user.id)) return { ok: false, status: 403, error: 'Abonnement requis' }
  if (!await canAccessOrgDossier(APP_SLUG, user.id, orgId, opts)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true, userId: user.id }
}
