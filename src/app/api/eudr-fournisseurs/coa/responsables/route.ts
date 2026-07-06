import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOrgOwner } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireOwner(orgId: string | null): Promise<{ userId: string } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  if (!await isOrgOwner(user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { userId: user.id }
}

/** GET ?org_id — liste des responsables COA. */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()
    const { data } = await admin.from('eudr_coa_responsables').select('id, email, created_at').eq('org_id', orgId).order('created_at')
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { org_id, email } — ajoute un responsable (doit avoir un compte Sens'ethO). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; email?: string }
    const auth = await requireOwner(body.org_id ?? null)
    if (auth instanceof NextResponse) return auth
    const email = (body.email ?? '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: target } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle()
    if (!target) return NextResponse.json({ error: "Aucun compte Sens'ethO avec cet email" }, { status: 404 })

    const { error } = await admin.from('eudr_coa_responsables').upsert({
      org_id: body.org_id, email, created_by: auth.userId,
    }, { onConflict: 'org_id,email' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id&org_id — retire un responsable. */
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const id = sp.get('id'); const orgId = sp.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const admin = createAdminClient()
    await admin.from('eudr_coa_responsables').delete().eq('id', id).eq('org_id', orgId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
