import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSpFolder } from '@/lib/sharepointMulti'
import type { SpConfigResolved } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return { user, admin }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = (await req.json()) as { parentId?: string | null; name: string }

  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data: cfg, error: fetchErr } = await auth.admin
    .from('sp_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !cfg) return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  if (!cfg.drive_id) return NextResponse.json({ error: 'Config not tested — drive_id missing' }, { status: 400 })

  const resolved: SpConfigResolved = {
    tenantId: cfg.tenant_id,
    clientId: cfg.client_id,
    clientSecret: cfg.client_secret,
    siteHost: cfg.site_host,
    sitePath: cfg.site_path,
    driveId: cfg.drive_id,
    rootFolder: cfg.root_folder,
  }

  try {
    const result = await createSpFolder(resolved, body.parentId ?? null, body.name)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
