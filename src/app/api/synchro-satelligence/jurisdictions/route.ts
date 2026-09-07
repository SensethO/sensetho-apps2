import { NextRequest, NextResponse } from 'next/server'
import { satelligenceFetch } from '@/lib/eudr/satelligence'
import { requireOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?org_id=&country=&framework=… — risque juridictionnel (GET /v1/jurisdictions).
 * Les filtres (hors org_id) sont transmis tels quels à l'API.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth

    const qs = new URLSearchParams()
    sp.forEach((v, k) => { if (k !== 'org_id') qs.set(k, v) })
    const path = '/v1/jurisdictions' + (qs.toString() ? `?${qs.toString()}` : '')
    const r = await satelligenceFetch(orgId!, path)
    if (!r.ok) return NextResponse.json({ ok: false, status: r.status, error: r.error }, { status: 200 })
    return NextResponse.json({ ok: true, jurisdictions: r.data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
