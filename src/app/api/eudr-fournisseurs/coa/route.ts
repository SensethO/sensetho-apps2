import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TABLE = 'eudr_coa'
const COLS = 'id, label, supplier_id, contract_id, source_attachment_id, client_demand_attachment_id, status, extracted, analysis, summary, points_a_verifier, document_date, uploaded_by_email, analyzed_at, analyzed_model, validated_by, validated_at, created_at, updated_at'

/** GET ?org_id — liste des COA de l'organisation. */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const admin = createAdminClient()
    const { data, error } = await admin.from(TABLE).select(COLS).eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { org_id, label, supplier_id?, contract_id? } — crée un COA (brouillon). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; label?: string; supplier_id?: string; contract_id?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('email').eq('id', auth.userId).maybeSingle()
    const { data, error } = await admin.from(TABLE).insert({
      org_id: body.org_id,
      user_id: auth.userId,
      uploaded_by_email: (prof?.email as string | undefined)?.toLowerCase() ?? null,
      label: (body.label ?? '').trim() || 'COA',
      supplier_id: body.supplier_id || null,
      contract_id: body.contract_id || null,
    }).select(COLS).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id&org_id — supprime un COA (les fichiers SharePoint sont conservés). */
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const id = sp.get('id'); const orgId = sp.get('org_id')
    const auth = await guard(orgId, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const admin = createAdminClient()
    const { error } = await admin.from(TABLE).delete().eq('id', id).eq('org_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
