import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: vsme } = await admin.from('vsme_settings').select('id').eq('id', params.id).single()
    if (!vsme) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })
    if (!actionKey) return NextResponse.json({ error: 'actionKey required' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size required' }, { status: 400 })

    const attachmentId = crypto.randomUUID()
    const safeName = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    const { data: counterData, error: counterError } = await admin
      .rpc('increment_vsme_attachment_counter', { p_id: params.id })
    if (counterError || counterData == null) {
      return NextResponse.json({ error: 'Failed to generate annexe index' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    const config = await getConfigForApp('vsme-efrag')
    const spPath = `/root:/${config.rootFolder}/${params.id}/${actionKey}/${finalName}:/createUploadSession`
    const spRes = await spGraphForApp('vsme-efrag', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName } }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      return NextResponse.json({ error: 'SharePoint upload session failed', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
