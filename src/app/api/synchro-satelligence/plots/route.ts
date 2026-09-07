import { NextRequest, NextResponse } from 'next/server'
import { satelligenceFetch } from '@/lib/eudr/satelligence'
import { requireOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?org_id=&id=&limit= — récupère les parcelles de la plateforme.
 *  - avec `id` : GET /v1/plots/{id} (métadonnées + risque d'une parcelle)
 *  - sinon     : GET /v1/plots (liste ; paramètres de requête transmis tels quels)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth

    const id = sp.get('id')
    if (id) {
      const r = await satelligenceFetch(orgId!, `/v1/plots/${encodeURIComponent(id)}`)
      if (!r.ok) return NextResponse.json({ ok: false, status: r.status, error: r.error }, { status: 200 })
      return NextResponse.json({ ok: true, plot: r.data })
    }

    // Transmettre les filtres éventuels (hors org_id/id).
    const qs = new URLSearchParams()
    sp.forEach((v, k) => { if (k !== 'org_id' && k !== 'id') qs.set(k, v) })
    const path = '/v1/plots' + (qs.toString() ? `?${qs.toString()}` : '')
    const r = await satelligenceFetch(orgId!, path)
    if (!r.ok) return NextResponse.json({ ok: false, status: r.status, error: r.error }, { status: 200 })
    return NextResponse.json({ ok: true, plots: r.data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
