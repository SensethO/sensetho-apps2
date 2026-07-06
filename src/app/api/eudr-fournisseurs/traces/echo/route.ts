import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials, makeEchoClient, describeTracesError } from '@/lib/eudr/tracesClient'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST { org_id } — test de connectivité/authentification auprès du service EUDR. */
export async function POST(req: NextRequest) {
  try {
    const { org_id } = await req.json() as { org_id?: string }
    const auth = await guard(org_id ?? null)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const creds = await getTracesCredentials(org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const client = makeEchoClient(creds)
    const message = `sensetho-${new Date().toISOString().slice(0, 10)}`
    const result = await client.echo(message)
    return NextResponse.json({ ok: true, environment: creds.environment, echoed: result })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
