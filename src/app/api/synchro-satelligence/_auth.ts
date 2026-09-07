import { NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Garde : l'utilisateur doit être connecté ET propriétaire de l'organisation
 * (ou admin). Les identifiants Satelligence sont sensibles → réservés au propriétaire.
 */
export async function requireOwner(orgId: string | null): Promise<{ userId: string } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

  const admin = createAdminClient()
  const { data: owned } = await admin
    .from('organisations').select('id').eq('id', orgId).eq('user_id', user.id).maybeSingle()
  if (!owned) {
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (prof?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}
