import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { getDdsV3, withdrawDdsV3 } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/eudr-fournisseurs/traces/dds?org_id=xxx — liste des DDS déposées (suivi). */
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await createAdminClient()
    .from('eudr_dds').select('*').eq('org_id', orgId!).order('submitted_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST { org_id, id? } — actualise le statut officiel via getDds (par UUID) auprès de TRACES.
 * Sans `id` : actualise toutes les DDS de l'org. Renvoie la liste à jour.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; id?: string; action?: 'refresh' | 'withdraw' }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()

    // Retrait d'une DDS (withdrawDds) — fenêtre 72 h, statut AVAILABLE, hors verrou douane.
    if (body.action === 'withdraw') {
      if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
      const { data: row } = await admin.from('eudr_dds').select('dds_uuid').eq('id', body.id).eq('org_id', body.org_id!).maybeSingle()
      if (!row) return NextResponse.json({ error: 'DDS introuvable' }, { status: 404 })
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      try {
        await withdrawDdsV3(creds, row.dds_uuid as string)
      } catch (err) {
        const info = describeTracesError(err)
        return NextResponse.json({ error: info.message, detail: info.detail }, { status: 502 })
      }
      await admin.from('eudr_dds').update({ status: 'WITHDRAWN', last_checked_at: new Date().toISOString() }).eq('id', body.id)
      const { data: fresh } = await admin.from('eudr_dds').select('*').eq('org_id', body.org_id!).order('submitted_at', { ascending: false })
      return NextResponse.json({ data: fresh ?? [] })
    }
    const q = admin.from('eudr_dds').select('*').eq('org_id', body.org_id!)
    if (body.id) q.eq('id', body.id)
    const { data: rows, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })

    for (const row of rows ?? []) {
      try {
        const info = await getDdsV3(creds, row.dds_uuid as string)
        await admin.from('eudr_dds').update({
          status: info.status,
          reference_number: info.referenceNumber,
          verification_number: info.verificationNumber,
          official_date: info.date,
          official_updated_by: info.updatedBy,
          last_checked_at: new Date().toISOString(),
        }).eq('id', row.id)
      } catch { /* une DDS injoignable ne bloque pas les autres */ }
    }

    const { data: fresh } = await admin.from('eudr_dds').select('*').eq('org_id', body.org_id!).order('submitted_at', { ascending: false })
    return NextResponse.json({ data: fresh ?? [] })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ error: info.message }, { status: 502 })
  }
}
