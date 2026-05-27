export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const { data: { user } } = await createRouteClient().auth.getUser()
  if (!user) return null

  const svc = createAdminClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET — renvoie tous les utilisateurs + rôles agri + plantations + accès
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const svc = createAdminClient()

    // Tous les profils
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, email, full_name, role')
      .order('full_name')

    // Tous les rôles agri
    const { data: agriRoles } = await svc
      .from('agri_user_roles')
      .select('user_id, role')

    // Toutes les plantations
    const { data: plantations } = await svc
      .from('plantations')
      .select('id, nom, region, pays_nom, superficie_totale_ha, user_id')
      .order('nom')

    // Tous les accès acheteurs
    const { data: acces } = await svc
      .from('acces_acheteurs')
      .select('acheteur_user_id, plantation_id')

    // Merge
    const users = (profiles ?? []).map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      agri_roles: (agriRoles ?? []).filter(r => r.user_id === p.id).map(r => r.role),
      acces_plantation_ids: (acces ?? []).filter(a => a.acheteur_user_id === p.id).map(a => a.plantation_id),
    }))

    return NextResponse.json({ users, plantations: plantations ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST — actions admin
export async function POST(req: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const svc = createAdminClient()
    const body = await req.json()
    const { action, userId, role, plantationId } = body

    if (action === 'assign-role') {
      await svc
        .from('agri_user_roles')
        .upsert({ user_id: userId, role, assigned_by: admin.id }, { onConflict: 'user_id,role' })
    } else if (action === 'revoke-role') {
      await svc
        .from('agri_user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role)
      // Si on retire le rôle acheteur, on retire aussi ses accès
      if (role === 'acheteur') {
        await svc
          .from('acces_acheteurs')
          .delete()
          .eq('acheteur_user_id', userId)
      }
    } else if (action === 'grant-access') {
      await svc
        .from('acces_acheteurs')
        .upsert({ acheteur_user_id: userId, plantation_id: plantationId, invite_par: admin.id }, { onConflict: 'acheteur_user_id,plantation_id' })
    } else if (action === 'revoke-access') {
      await svc
        .from('acces_acheteurs')
        .delete()
        .eq('acheteur_user_id', userId)
        .eq('plantation_id', plantationId)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
