import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_sessions').select('user_id').eq('id', sessionId).single()
  return data?.user_id === userId
}

/**
 * DELETE /api/bilan-ges/sessions/[id]/entry-attachment?path=<spItemId>
 * Supprime l'item SharePoint (silencieux si 404).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const path = req.nextUrl.searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })
    if (path.includes('/')) return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 })

    const res = await spGraphForApp('bilan-ges-diagnostic', `/items/${encodeURIComponent(path)}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204 && res.status !== 404) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Échec suppression SharePoint', detail: errText }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
