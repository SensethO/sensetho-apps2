import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCoaAccess } from '../_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, coa_id } — valide un COA. Réservé au rôle « superviseur »
 * (ou propriétaire/admin). Un seul validateur suffit.
 * DELETE ?org_id&coa_id — retire la validation (repasse à « analysé »).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; coa_id?: string }
    const a = await resolveCoaAccess(body.org_id ?? null)
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
    if (!a.canValidate) return NextResponse.json({ error: 'Seul un superviseur peut valider un COA.' }, { status: 403 })
    if (!body.coa_id) return NextResponse.json({ error: 'coa_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: coa } = await admin.from('eudr_coa').select('status').eq('id', body.coa_id).eq('org_id', body.org_id).maybeSingle()
    if (!coa) return NextResponse.json({ error: 'COA introuvable' }, { status: 404 })
    if (coa.status === 'draft') return NextResponse.json({ error: 'Analysez le COA avant de le valider.' }, { status: 400 })

    const { data, error } = await admin.from('eudr_coa').update({
      status: 'validated', validated_by: a.email || a.userId, validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', body.coa_id).eq('org_id', body.org_id).select('id, status, validated_by, validated_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id'); const coaId = sp.get('coa_id')
    const a = await resolveCoaAccess(orgId)
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
    if (!a.canValidate) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    if (!coaId) return NextResponse.json({ error: 'coa_id requis' }, { status: 400 })
    const admin = createAdminClient()
    const { error } = await admin.from('eudr_coa').update({
      status: 'analyzed', validated_by: null, validated_at: null, updated_at: new Date().toISOString(),
    }).eq('id', coaId).eq('org_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
