import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { getDdsV3 } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, uuid }
 * Récupère l'aperçu d'une DDS déposée (n° de référence, n° de vérification, statut) via getDds V3.
 * Lecture seule.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; uuid?: string }
    const auth = await guard(body.org_id ?? null)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const uuid = (body.uuid ?? '').trim()
    if (!uuid) return NextResponse.json({ error: 'uuid requis' }, { status: 400 })

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const r = await getDdsV3(creds, uuid)
    return NextResponse.json({
      ok: true,
      environment: creds.environment,
      referenceNumber: r.referenceNumber,
      verificationNumber: r.verificationNumber,
      status: r.status,
      internalReferenceNumber: r.internalReferenceNumber,
    })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
