import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'


async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id, iso26000_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).iso26000_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  return share?.permission === 'edit'
}

/**
 * POST /api/iso26000/[id]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName }
 *
 * Crée une upload session SharePoint pour ISO26000/{id}/{actionKey}/{filename}
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

    // Sanitize filename (strip forbidden SP chars)
    const safeName = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    // ── Générer le préfixe A001_ de manière atomique ──────────────────────────
    // increment_iso26000_attachment_counter() incrémente iso26000_diagnostics.attachment_counter
    // et retourne la nouvelle valeur — opération atomique, garantit l'unicité.
    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_iso26000_attachment_counter', { p_id: diagnosticId })
    if (counterError || counterData == null) {
      console.error('[upload-session/counter] error', counterError)
      return NextResponse.json({ error: 'Failed to generate annexe index' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    // Create SharePoint upload session
    const config = await getConfigForApp('iso26000')
    const spPath = `/root:/${config.rootFolder}/${diagnosticId}/${actionKey}/${finalName}:/createUploadSession`
    const spRes = await spGraphForApp('iso26000', spPath, {
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
      annexeIndex,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
