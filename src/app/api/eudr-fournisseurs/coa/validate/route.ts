import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOrgOwner } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, coa_id }
 * Valide un COA. Autorisé si l'utilisateur courant est un responsable COA
 * de l'organisation (liste dédiée) — ou propriétaire/admin. Un seul suffit.
 * DELETE ?coa_id&org_id — retire la validation (revient à « analysé »).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as { org_id?: string; coa_id?: string }
    if (!body.org_id || !body.coa_id) return NextResponse.json({ error: 'org_id et coa_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const email = (user.email ?? '').toLowerCase()
    const owner = await isOrgOwner(user.id, body.org_id)
    let allowed = owner
    if (!allowed && email) {
      const { data: resp } = await admin.from('eudr_coa_responsables')
        .select('id').eq('org_id', body.org_id).ilike('email', email).maybeSingle()
      allowed = !!resp
    }
    if (!allowed) return NextResponse.json({ error: 'Seul un responsable COA peut valider.' }, { status: 403 })

    const { data: coa } = await admin.from('eudr_coa').select('status').eq('id', body.coa_id).eq('org_id', body.org_id).maybeSingle()
    if (!coa) return NextResponse.json({ error: 'COA introuvable' }, { status: 404 })
    if (coa.status === 'draft') return NextResponse.json({ error: "Analysez le COA avant de le valider." }, { status: 400 })

    const { data, error } = await admin.from('eudr_coa').update({
      status: 'validated', validated_by: email || user.id, validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', body.coa_id).eq('org_id', body.org_id).select('id, status, validated_by, validated_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id'); const coaId = sp.get('coa_id')
    if (!orgId || !coaId) return NextResponse.json({ error: 'org_id et coa_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const email = (user.email ?? '').toLowerCase()
    const owner = await isOrgOwner(user.id, orgId)
    let allowed = owner
    if (!allowed && email) {
      const { data: resp } = await admin.from('eudr_coa_responsables').select('id').eq('org_id', orgId).ilike('email', email).maybeSingle()
      allowed = !!resp
    }
    if (!allowed) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

    const { error } = await admin.from('eudr_coa').update({
      status: 'analyzed', validated_by: null, validated_at: null, updated_at: new Date().toISOString(),
    }).eq('id', coaId).eq('org_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
