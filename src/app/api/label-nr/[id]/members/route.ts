import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { canAccessDiagnostic, listDiagnosticMembers } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'label-nr'
const TABLE = 'label_nr_diagnostics'

/** GET /api/label-nr/[id]/members — propriétaire + utilisateurs partagés (pattern RSE §14.A). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccessDiagnostic(APP_SLUG, TABLE, user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await listDiagnosticMembers(APP_SLUG, TABLE, params.id)
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
