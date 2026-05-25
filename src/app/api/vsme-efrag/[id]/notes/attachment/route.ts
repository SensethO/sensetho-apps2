import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })
    const body = await req.json() as { fileName?: string }
    const { fileName } = body
    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row, error: fetchErr } = await admin
      .from('vsme_attachments').select('sharepoint_item_id')
      .eq('id', attachment_id).eq('vsme_id', params.id).single()
    if (fetchErr || !row) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    const spRes = await spGraphForApp('vsme-efrag', `/items/${row.sharepoint_item_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName }),
    })
    if (!spRes.ok && spRes.status !== 404) {
      return NextResponse.json({ error: 'SharePoint rename failed' }, { status: 502 })
    }

    await admin.from('vsme_attachments').update({ name: fileName }).eq('id', attachment_id).eq('vsme_id', params.id)
    return NextResponse.json({ ok: true, name: fileName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row, error: fetchErr } = await admin
      .from('vsme_attachments').select('sharepoint_item_id')
      .eq('id', attachment_id).eq('vsme_id', params.id).single()
    if (fetchErr || !row) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    const spRes = await spGraphForApp('vsme-efrag', `/items/${row.sharepoint_item_id}`, { method: 'DELETE' })
    if (!spRes.ok && spRes.status !== 404) {
      return NextResponse.json({ error: 'SharePoint delete failed' }, { status: 502 })
    }

    await admin.from('vsme_attachments').delete().eq('id', attachment_id).eq('vsme_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
