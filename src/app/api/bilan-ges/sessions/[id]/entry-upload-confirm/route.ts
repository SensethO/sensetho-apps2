import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_sessions').select('user_id').eq('id', sessionId).single()
  return data?.user_id === userId
}

/**
 * POST /api/bilan-ges/sessions/[id]/entry-upload-confirm
 * Body: { attachmentId, spItemId, name, mime, size, prefix? }
 * Le fichier est déjà sur SharePoint (upload direct navigateur → SharePoint).
 * Renvoie les métadonnées GESEntryAttachment — le client les stocke dans le
 * JSONB scope de la session via PATCH /sessions/[id].
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json() as {
      attachmentId?: string
      spItemId?: string
      name?: string
      mime?: string
      size?: number
      prefix?: string
    }
    const { attachmentId, spItemId, name, mime, size, prefix } = body

    if (!spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const attachment = {
      id: attachmentId ?? crypto.randomUUID(),
      name,                       // nom d'affichage (renommable côté client)
      path: spItemId,             // SharePoint item ID
      size: size ?? 0,
      mime: mime ?? 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
      ...(prefix ? { prefix } : {}),
    }

    return NextResponse.json({ data: attachment }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
