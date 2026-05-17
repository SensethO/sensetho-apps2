import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  return share?.permission === 'edit'
}

/**
 * POST /api/guided-diagnostic/[id]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName }
 *
 * Crée une upload session SharePoint pour GUIDED-DIAG/{id}/{actionKey}/{filename}
 * Le fichier est envoyé directement par le browser vers SharePoint (aucun transit Vercel).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body

    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })
    if (!actionKey) return NextResponse.json({ error: 'actionKey required' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size required' }, { status: 400 })

    const diagnosticId = params.id
    const attachmentId = crypto.randomUUID()

    // Sanitize filename
    const safeName = filename.replace(/[/\\:*?"<>|]/g, '_')
    const finalName = safeName

    // Create SharePoint upload session
    const config = await getConfigForApp('guided-diagnostic')
    const spPath = `/root:/${config.rootFolder}/${diagnosticId}/${actionKey}/${finalName}:/createUploadSession`
    const spRes = await spGraphForApp('guided-diagnostic', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
          name: finalName,
        },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[upload-session/sharepoint] error', spRes.status, errText)
      return NextResponse.json({ error: 'SharePoint upload session failed', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }

    return NextResponse.json({
      uploadUrl: spJson.uploadUrl,
      attachmentId,
      finalName,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
