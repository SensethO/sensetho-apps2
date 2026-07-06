import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOrgOwner } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP_SLUG = 'eudr-fournisseurs'
const ROLES = ['lecture', 'ecriture', 'superviseur']

async function requireOwner(orgId: string | null): Promise<{ userId: string } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  if (!await isOrgOwner(user.id, orgId)) return NextResponse.json({ error: 'Seul le propriétaire du dossier peut gérer les membres.' }, { status: 403 })
  return { userId: user.id }
}

const shareFor = (role: string) => (role === 'lecture' ? 'read' : 'edit')

/** GET ?org_id — membres COA + candidats (utilisateurs du site) pour la liste déroulante. */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()

    const { data: members } = await admin.from('eudr_coa_members')
      .select('id, user_id, email, role').eq('org_id', orgId).order('created_at')
    const memberIds = new Set((members ?? []).map(m => m.user_id))
    memberIds.add(auth.userId) // exclut le propriétaire lui-même des candidats

    const { data: profiles } = await admin.from('profiles').select('id, email').order('email').limit(1000)
    const candidates = (profiles ?? []).filter(p => p.email && !memberIds.has(p.id)).map(p => ({ id: p.id, email: p.email }))

    return NextResponse.json({ members: members ?? [], candidates })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { org_id, user_id, role } — ajoute/modifie un membre + partage le dossier (accès sidebar). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; user_id?: string; role?: string }
    const auth = await requireOwner(body.org_id ?? null)
    if (auth instanceof NextResponse) return auth
    if (!body.user_id) return NextResponse.json({ error: 'Utilisateur requis' }, { status: 400 })
    const role = ROLES.includes(body.role ?? '') ? body.role! : 'lecture'

    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('email').eq('id', body.user_id).maybeSingle()
    if (!prof) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (body.user_id === auth.userId) return NextResponse.json({ error: 'Vous êtes déjà propriétaire' }, { status: 400 })

    const { error } = await admin.from('eudr_coa_members').upsert({
      org_id: body.org_id, user_id: body.user_id, email: (prof.email as string).toLowerCase(), role, created_by: auth.userId,
    }, { onConflict: 'org_id,user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Partage du dossier pour l'accès (sidebar + lecture/écriture des données).
    await admin.from('rse_diagnostic_shares').upsert({
      app_slug: APP_SLUG, diagnostic_id: body.org_id, shared_with_user_id: body.user_id, permission: shareFor(role), created_by: auth.userId,
    }, { onConflict: 'app_slug,diagnostic_id,shared_with_user_id' })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id&org_id — retire un membre + son partage. */
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const id = sp.get('id'); const orgId = sp.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const admin = createAdminClient()
    const { data: m } = await admin.from('eudr_coa_members').select('user_id').eq('id', id).eq('org_id', orgId).maybeSingle()
    await admin.from('eudr_coa_members').delete().eq('id', id).eq('org_id', orgId)
    if (m) {
      await admin.from('rse_diagnostic_shares').delete()
        .eq('app_slug', APP_SLUG).eq('diagnostic_id', orgId).eq('shared_with_user_id', m.user_id)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
