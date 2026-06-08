import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

type Params = { params: { actionId: string } }

async function canAccess(userId: string, actionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', actionId).single()
  if (!action) return false
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', action.project_id).single()
  if (!project) return false
  if (project.owner_id === userId) return true
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', action.project_id).eq('user_id', userId).maybeSingle()
  return !!member
}

/**
 * GET /api/gestion-temps/actions/[actionId]/notes/signed-url?item_id=xxx
 * Retourne une URL de téléchargement SharePoint directe.
 * Le téléchargement se fait navigateur → SharePoint, sans transit par Vercel.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const item_id = req.nextUrl.searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    const res = await spGraphForApp('gestion-temps', `/items/${item_id}`)
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
