import { NextRequest, NextResponse } from 'next/server'
import { satelligenceFetch } from '@/lib/eudr/satelligence'
import { requireOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id= — teste le token en listant les projets (GET /v1/projects). */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const r = await satelligenceFetch(orgId!, '/v1/projects')
    if (!r.ok) return NextResponse.json({ ok: false, status: r.status, error: r.error }, { status: 200 })
    return NextResponse.json({ ok: true, projects: r.data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
