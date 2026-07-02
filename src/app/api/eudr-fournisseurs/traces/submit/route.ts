import { NextRequest, NextResponse } from 'next/server'
import { getTracesCredentials, makeSubmissionClient } from '@/lib/eudr/tracesClient'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Json = Record<string, unknown>

/** Encode en base64 les géométries GeoJSON fournies en objet ou en JSON brut. */
function normalizeGeometry(statement: Json): Json {
  const commodities = statement.commodities
  if (!Array.isArray(commodities)) return statement
  for (const c of commodities as Json[]) {
    const producers = c.producers
    const list = Array.isArray(producers) ? producers : producers ? [producers] : []
    for (const p of list as Json[]) {
      const g = p.geometryGeojson
      if (g && typeof g === 'object') {
        p.geometryGeojson = Buffer.from(JSON.stringify(g)).toString('base64')
      } else if (typeof g === 'string' && g.trim().startsWith('{')) {
        p.geometryGeojson = Buffer.from(g.trim()).toString('base64')
      }
    }
    if (list.length) c.producers = list
  }
  return statement
}

/**
 * POST { org_id, operatorType, statement }
 * Dépose une Due Diligence Statement dans le registre EUDR (submitDds V2).
 * Écriture → droit d'édition requis. En production, la DDS a valeur légale.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; operatorType?: string; statement?: Json }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    if (!body.operatorType || !body.statement) {
      return NextResponse.json({ error: 'operatorType et statement requis' }, { status: 400 })
    }

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const request = {
      operatorType: body.operatorType,
      statement: normalizeGeometry(body.statement),
    }
    const client = makeSubmissionClient(creds)
    const result = await client.submitDds(request)
    return NextResponse.json({ ok: true, environment: creds.environment, ddsIdentifier: result.ddsIdentifier, result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message ?? String(err) }, { status: 502 })
  }
}
