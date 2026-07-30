import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Garde d'accès pour les routes API d'administration.
 * Le middleware n'authentifie PAS les routes /api/ (chacune gère sa propre auth) :
 * toute route d'admin doit donc appeler ce helper explicitement.
 * Renvoie null si l'accès est accordé, sinon la réponse d'erreur à retourner.
 */
export async function requireAdmin(): Promise<Response | null> {
  const { data: { user }, error: authError } = await createUserClient().auth.getUser()
  // Une base injoignable ne doit jamais se traduire par un refus de droits trompeur.
  const unavailable = () => Response.json(
    { error: 'Service momentanément indisponible — réessayez dans un instant.' }, { status: 503 })
  if (authError && !/session|jwt|token|expired|missing/i.test(authError.message)) return unavailable()
  if (!user) return Response.json({ error: 'Session expirée — reconnectez-vous.' }, { status: 401 })
  const { data: profile, error } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (error && error.code !== 'PGRST116') return unavailable()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  return null
}
