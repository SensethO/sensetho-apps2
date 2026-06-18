import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'iso45001'
const TABLE = 'iso45001_diagnostics'

const canAccess = (userId: string, diagnosticId: string) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId)

/**
 * GET /api/iso45001/[id]/notes/signed-url?item_id=xxx
 * Retourne une URL de téléchargement SharePoint directe.
 * Le téléchargement se fait navigateur → SharePoint, sans passer par Vercel.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const item_id = req.nextUrl.searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    const res = await spGraphForApp('iso45001-diagnostic', `/items/${item_id}`)
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Item SharePoint non trouvé', detail: errText }, { status: 502 })
    }

    const item = await res.json() as Record<string, unknown>
    const downloadUrl = item['@microsoft.graph.downloadUrl'] as string | undefined

    if (!downloadUrl) {
      return NextResponse.json({ error: 'URL de téléchargement non disponible' }, { status: 502 })
    }

    return NextResponse.json({ url: downloadUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
