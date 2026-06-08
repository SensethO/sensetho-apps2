import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

type Params = { params: { entryId: string } }

async function canAccess(userId: string, entryId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: entry } = await admin.from('gt_time_entries').select('user_id, project_id').eq('id', entryId).single()
  if (!entry) return false
  if (entry.user_id === userId) return true
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', entry.project_id).single()
  if (project?.owner_id === userId) return true
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', entry.project_id).eq('user_id', userId).maybeSingle()
  return !!member
}

/**
 * GET /api/gestion-temps/time-entries/[entryId]/notes/signed-url?item_id=xxx
 * Retourne une URL de téléchargement SharePoint directe (navigateur → SharePoint, sans transit Vercel).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.entryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const item_id = req.nextUrl.searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    const res = await spGraphForApp('gestion-temps', `/items/${item_id}`)
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Item SharePoint non trouvé', detail: errText }, { status: 502 })
    }

    const item = await res.json() as Record<string, unknown>
    const downloadUrl = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!downloadUrl) return NextResponse.json({ error: 'URL de téléchargement non disponible' }, { status: 502 })

    return NextResponse.json({ url: downloadUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
