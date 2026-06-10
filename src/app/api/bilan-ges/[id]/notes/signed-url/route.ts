import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * GET /api/bilan-ges/[id]/notes/signed-url?item_id=xxx
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

    const res = await spGraphForApp('bilan-ges-diagnostic', `/items/${item_id}`)
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
