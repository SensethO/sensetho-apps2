import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_sessions').select('user_id').eq('id', sessionId).single()
  return data?.user_id === userId
}

/**
 * POST /api/bilan-ges/sessions/[id]/entry-upload-session
 * Body: { filename, size, prefix?, entryId?, sectionId? }
 * Returns: { uploadUrl, attachmentId, finalName }
 * Règle absolue : AUCUN transit de fichier par Vercel — le navigateur uploade
 * directement vers SharePoint via l'uploadUrl retournée.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json() as { filename?: string; size?: number; prefix?: string }
    const { filename, size, prefix } = body
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const sessionId = params.id
    const attachmentId = crypto.randomUUID()
    const safeName = filename.replace(/[/\\:*?"<>|#%]/g, '_').trim()
    const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
    const safePrefix = prefix ? String(prefix).replace(/[^A-Za-z0-9_-]/g, '') : ''
    const finalName = safePrefix ? `${safePrefix}_${shortId}_${safeName}` : `${shortId}_${safeName}`

    const config = await getConfigForApp('bilan-ges-diagnostic')
    const spPath = `/root:/${config.rootFolder}/sessions/${sessionId}/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp('bilan-ges-diagnostic', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[bilan-ges/sessions/entry-upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
