import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

export function makeSvc() {
  return createAdminClient()
}

export async function getUser() {
  const client = createRouteClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

/** Vérifie que l'utilisateur peut accéder à une plantation (owner, acheteur autorisé, ou admin) */
export async function checkPlantationAccess(
  svc: ReturnType<typeof makeSvc>,
  userId: string,
  plantationId: string
): Promise<{ allowed: boolean; isOwner: boolean; isAdmin: boolean }> {
  const { data: profile } = await svc.from('profiles').select('role').eq('id', userId).single()
  const isAdmin = profile?.role === 'admin'
  if (isAdmin) return { allowed: true, isOwner: false, isAdmin: true }

  const { data: plantation } = await svc
    .from('plantations').select('user_id').eq('id', plantationId).single()
  const isOwner = plantation?.user_id === userId
  if (isOwner) return { allowed: true, isOwner: true, isAdmin: false }

  const { data: acces } = await svc
    .from('acces_acheteurs')
    .select('plantation_id')
    .eq('acheteur_user_id', userId)
    .eq('plantation_id', plantationId)
    .maybeSingle()

  return { allowed: !!acces, isOwner: false, isAdmin: false }
}
