import { NextRequest, NextResponse } from 'next/server'
import { resolveCoaAccess } from '../_access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id — droits COA de l'utilisateur courant (pour l'UI). */
export async function GET(req: NextRequest) {
  const a = await resolveCoaAccess(req.nextUrl.searchParams.get('org_id'))
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  return NextResponse.json({ isOwner: a.isOwner, role: a.role, canRead: a.canRead, canWrite: a.canWrite, canValidate: a.canValidate })
}
