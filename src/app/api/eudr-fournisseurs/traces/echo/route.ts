import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials } from '@/lib/eudr/tracesClient'
import { pingV3 } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id } — test de connexion/authentification auprès du service EUDR.
 * L'ancien service Echo V1/V2 a été retiré côté serveur (404) → on teste via l'API V3
 * (pingV3) : une réponse métier prouve que l'authentification WS-Security est acceptée.
 */
export async function POST(req: NextRequest) {
  try {
    const { org_id } = await req.json() as { org_id?: string }
    const auth = await guard(org_id ?? null)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const creds = await getTracesCredentials(org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const ping = await pingV3(creds)
    if (ping.ok) return NextResponse.json({ ok: true, environment: creds.environment, message: ping.message })
    return NextResponse.json({ ok: false, error: ping.message, detail: ping.detail }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message ?? String(err) }, { status: 502 })
  }
}
