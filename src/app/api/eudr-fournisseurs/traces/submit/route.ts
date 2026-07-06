import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { submitDdsV3, DdsStatement } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, operatorType, statement }
 * Dépose une Due Diligence Statement dans le registre EUDR via l'API **V3**
 * (EUDRDueDiligenceStatementServiceV3 ; V1/V2 désactivées côté serveur).
 * Écriture → droit d'édition requis. En production, la DDS a valeur légale.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; operatorType?: string; statement?: DdsStatement }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    if (!body.operatorType || !body.statement) {
      return NextResponse.json({ error: 'operatorType et statement requis' }, { status: 400 })
    }

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    // V3 : operatorType → operatorRole. La géométrie GeoJSON est encodée en base64 dans le client V3.
    const result = await submitDdsV3(creds, { operatorRole: body.operatorType, statement: body.statement })
    return NextResponse.json({ ok: true, environment: creds.environment, ddsIdentifier: result.uuid })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
