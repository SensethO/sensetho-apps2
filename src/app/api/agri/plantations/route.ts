export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createAdminClient()

    // Vérifie si admin
    const { data: profile } = await svc
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      // Admin : toutes les plantations
      const { data: plantations } = await svc
        .from('plantations')
        .select('*')
        .order('nom')
      return NextResponse.json({ plantations: plantations ?? [] })
    }

    // Vérifie les rôles AgriTracker (planteur et/ou acheteur)
    const { data: agriRoles } = await svc
      .from('agri_user_roles')
      .select('role')
      .eq('user_id', user.id)

    const roles = agriRoles ?? []
    const hasPlanteur = roles.some((r: { role: string }) => r.role === 'planteur')
    const hasAcheteur = roles.some((r: { role: string }) => r.role === 'acheteur')

    // Collecte les IDs de plantations accessibles
    const plantationIds = new Set<string>()

    // Planteur : ses propres plantations (user_id = user.id)
    if (hasPlanteur) {
      const { data: owned } = await svc
        .from('plantations')
        .select('id')
        .eq('user_id', user.id)
      ;(owned ?? []).forEach((r: { id: string }) => plantationIds.add(r.id))
    }

    // Acheteur : plantations accessibles via acces_acheteurs
    if (hasAcheteur) {
      const { data: accesData } = await svc
        .from('acces_acheteurs')
        .select('plantation_id')
        .eq('acheteur_user_id', user.id)
      ;(accesData ?? []).forEach((r: { plantation_id: string }) => plantationIds.add(r.plantation_id))
    }

    if (plantationIds.size === 0) {
      return NextResponse.json({ plantations: [] })
    }

    const { data: plantations } = await svc
      .from('plantations')
      .select('*')
      .in('id', Array.from(plantationIds))
      .order('nom')

    return NextResponse.json({ plantations: plantations ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
