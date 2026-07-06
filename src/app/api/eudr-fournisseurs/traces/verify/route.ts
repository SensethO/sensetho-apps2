import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { getDdsByIdentifiersV3 } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, referenceNumber, verificationNumber }
 * Vérifie une DDS reçue d'un fournisseur/acheteur via getStatementByIdentifiers.
 * Lecture seule.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; referenceNumber?: string; verificationNumber?: string }
    const auth = await guard(body.org_id ?? null)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const referenceNumber = (body.referenceNumber ?? '').trim().toUpperCase()
    const verificationNumber = (body.verificationNumber ?? '').trim().toUpperCase()
    if (!referenceNumber || !verificationNumber) {
      return NextResponse.json({ error: 'referenceNumber et verificationNumber requis' }, { status: 400 })
    }

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const result = await getDdsByIdentifiersV3(creds, referenceNumber, verificationNumber)
    return NextResponse.json({ ok: true, environment: creds.environment, result: { status: result.status, ddsInfo: [{ status: result.status }] } })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
