import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Garde d'accès pour les routes API d'administration.
 * Le middleware n'authentifie PAS les routes /api/ (chacune gère sa propre auth) :
 * toute route d'admin doit donc appeler ce helper explicitement.
 * Renvoie null si l'accès est accordé, sinon la réponse d'erreur à retourner.
 */
export async function requireAdmin(): Promise<Response | null> {
  const { data: { user } } = await createUserClient().auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })
  return null
}
