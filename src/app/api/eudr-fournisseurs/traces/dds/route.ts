import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { getDdsV3, withdrawDdsV3, getDdsByInternalReferenceV3 } from '@/lib/eudr/tracesV3'
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
    const body = await req.json() as { org_id?: string; id?: string; uuid?: string; action?: 'refresh' | 'withdraw' | 'import' | 'discover' }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()

    // Découverte : balaie les n° de contrat comme références internes et importe les DDS trouvées.
    if (body.action === 'discover') {
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      const { data: contracts } = await admin.from('eudr_contracts').select('contract_number').eq('org_id', body.org_id!)
      const refs = new Set<string>()
      for (const c of contracts ?? []) {
        const cn = (c.contract_number as string | null)?.trim()
        if (!cn) continue
        refs.add(cn)
        cn.split(/\s+/).forEach(p => { if (/^\d{4}-\d{3}/.test(p)) refs.add(p) }) // fragments type 2025-029A
      }
      let discovered = 0
      for (const ref of refs) {
        try {
          const overviews = await getDdsByInternalReferenceV3(creds, ref)
          for (const o of overviews) {
            await admin.from('eudr_dds').upsert({
              org_id: body.org_id!, dds_uuid: o.uuid, environment: creds.environment,
              internal_reference_number: o.internalReferenceNumber, reference_number: o.referenceNumber,
              verification_number: o.verificationNumber, status: o.status,
              official_date: o.date, official_updated_by: o.updatedBy,
              submitted_by: '(importée)', last_checked_at: new Date().toISOString(),
            }, { onConflict: 'org_id,dds_uuid' })
            discovered++
          }
        } catch { /* une référence en échec ne bloque pas le balayage */ }
      }
      const { data: fresh } = await admin.from('eudr_dds').select('*').eq('org_id', body.org_id!).order('submitted_at', { ascending: false })
      return NextResponse.json({ data: fresh ?? [], discovered })
    }

    // Import d'une DDS existante dans le suivi (par UUID) — getDds fonctionne pour tout statut.
    if (body.action === 'import') {
      const uuid = (body.uuid ?? '').trim()
      if (!uuid) return NextResponse.json({ error: 'UUID requis' }, { status: 400 })
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      let info
      try { info = await getDdsV3(creds, uuid) } catch (err) {
        const e = describeTracesError(err); return NextResponse.json({ error: e.message }, { status: 502 })
      }
      if (!info.status && !info.internalReferenceNumber && !info.referenceNumber) {
        return NextResponse.json({ error: 'Aucune DDS trouvée pour cet UUID (sur cet environnement).' }, { status: 404 })
      }
      await admin.from('eudr_dds').upsert({
        org_id: body.org_id!, dds_uuid: uuid, environment: creds.environment,
        internal_reference_number: info.internalReferenceNumber, reference_number: info.referenceNumber,
        verification_number: info.verificationNumber, status: info.status,
        official_date: info.date, official_updated_by: info.updatedBy,
        submitted_by: '(importée)', last_checked_at: new Date().toISOString(),
      }, { onConflict: 'org_id,dds_uuid' })
      const { data: fresh } = await admin.from('eudr_dds').select('*').eq('org_id', body.org_id!).order('submitted_at', { ascending: false })
      return NextResponse.json({ data: fresh ?? [] })
    }

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
