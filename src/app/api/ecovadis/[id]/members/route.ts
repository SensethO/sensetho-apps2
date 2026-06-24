import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ecovadis/[id]/members — propriétaire + utilisateurs partagés (pattern RSE §14.A).
 * EcoVadis utilise sa table de partage dédiée `ecovadis_shares` (et non rse_diagnostic_shares),
 * d'où cette route sur-mesure plutôt que listDiagnosticMembers.
 * Accessible au propriétaire, à un admin, ou à un utilisateur partagé.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: diag } = await admin.from('ecovadis_diagnostics').select('user_id').eq('id', params.id).single()
    if (!diag) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

    const { data: shares } = await admin
      .from('ecovadis_shares')
      .select('shared_with_user_id, permission')
      .eq('diagnostic_id', params.id)

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isOwner = diag.user_id === user.id
    const isAdmin = profile?.role === 'admin'
    const isShared = (shares ?? []).some(s => s.shared_with_user_id === user.id)
    if (!isOwner && !isAdmin && !isShared) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const permById = new Map<string, 'read' | 'edit'>()
    for (const s of shares ?? []) permById.set(s.shared_with_user_id as string, s.permission as 'read' | 'edit')

    const ids = Array.from(new Set<string>([diag.user_id as string, ...Array.from(permById.keys())]))
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name').in('id', ids)
    const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p as { id: string; email: string; full_name: string | null }]))

    const data = ids
      .map(id => ({
        user_id: id,
        email: byId[id]?.email ?? '—',
        full_name: byId[id]?.full_name ?? null,
        isOwner: id === diag.user_id,
        permission: id === diag.user_id ? null : (permById.get(id) ?? null),
      }))
      .sort((a, b) => (a.isOwner === b.isOwner ? 0 : a.isOwner ? -1 : 1))

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
