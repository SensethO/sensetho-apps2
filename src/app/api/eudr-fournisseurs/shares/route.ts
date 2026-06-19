import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'eudr-fournisseurs'

/** Seul le propriétaire de l'organisation (ou un admin) gère les partages de son dossier. */
async function canManage(userId: string, orgId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: org } = await admin.from('organisations').select('user_id').eq('id', orgId).single()
  return org?.user_id === userId
}

/** GET /api/eudr-fournisseurs/shares?org_id=xxx — liste des partages du dossier de l'org */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = req.nextUrl.searchParams.get('org_id')
    if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canManage(user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: shares } = await admin
      .from('rse_diagnostic_shares')
      .select('id, shared_with_user_id, permission, created_at')
      .eq('app_slug', APP_SLUG)
      .eq('diagnostic_id', orgId)
      .order('created_at')

    const ids = (shares ?? []).map(s => s.shared_with_user_id)
    let emails: Record<string, string> = {}
    if (ids.length) {
      const { data: profiles } = await admin.from('profiles').select('id, email').in('id', ids)
      emails = Object.fromEntries((profiles ?? []).map(p => [p.id, p.email]))
    }
    const data = (shares ?? []).map(s => ({ ...s, email: emails[s.shared_with_user_id] ?? '—' }))
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/eudr-fournisseurs/shares — body { org_id, email, permission } */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, email, permission } = await req.json() as { org_id?: string; email?: string; permission?: string }
    if (!org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canManage(user.id, org_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const cleanEmail = (email ?? '').trim().toLowerCase()
    if (!cleanEmail) return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    const perm = permission === 'edit' ? 'edit' : 'read'

    const admin = createAdminClient()
    const { data: target } = await admin.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle()
    if (!target) return NextResponse.json({ error: "Aucun compte Sens'ethO avec cet email" }, { status: 404 })
    if (target.id === user.id) return NextResponse.json({ error: 'Vous êtes déjà propriétaire' }, { status: 400 })

    const { error } = await admin.from('rse_diagnostic_shares').upsert({
      app_slug: APP_SLUG, diagnostic_id: org_id, shared_with_user_id: target.id, permission: perm, created_by: user.id,
    }, { onConflict: 'app_slug,diagnostic_id,shared_with_user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/eudr-fournisseurs/shares?shareId=xxx&org_id=xxx */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sp = req.nextUrl.searchParams
    const shareId = sp.get('shareId'); const orgId = sp.get('org_id')
    if (!shareId || !orgId) return NextResponse.json({ error: 'shareId et org_id requis' }, { status: 400 })
    if (!await canManage(user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    await admin.from('rse_diagnostic_shares').delete()
      .eq('id', shareId).eq('app_slug', APP_SLUG).eq('diagnostic_id', orgId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
