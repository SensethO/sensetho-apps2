import { NextRequest, NextResponse } from 'next/server'
import { satelligenceFetch } from '@/lib/eudr/satelligence'
import { requireOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, geometry?, payload? } — risque « à la volée » (POST /get-risk-info).
 * Envoie `payload` tel quel s'il est fourni, sinon enveloppe la `geometry` GeoJSON.
 * Aucune donnée n'est stockée côté Satelligence.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; geometry?: unknown; payload?: unknown }
    const orgId = body.org_id ?? null
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth

    let payload: unknown = body.payload
    if (payload === undefined) {
      if (body.geometry === undefined) return NextResponse.json({ error: 'geometry ou payload requis' }, { status: 400 })
      let geom = body.geometry
      if (typeof geom === 'string') {
        try { geom = JSON.parse(geom) } catch { return NextResponse.json({ error: 'GeoJSON invalide (JSON non valide).' }, { status: 400 }) }
      }
      payload = { geometry: geom }
    }

    const r = await satelligenceFetch(orgId!, '/get-risk-info', { method: 'POST', body: JSON.stringify(payload) })
    if (!r.ok) return NextResponse.json({ ok: false, status: r.status, error: r.error, data: r.data }, { status: 200 })
    return NextResponse.json({ ok: true, result: r.data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
