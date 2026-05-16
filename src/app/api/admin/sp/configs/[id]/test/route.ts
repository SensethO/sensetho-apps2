import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { testSpConfig } from '@/lib/sharepointMulti'

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Fetch config with secret
  const { data: cfg, error: fetchErr } = await auth.admin
    .from('sp_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !cfg) return NextResponse.json({ error: 'Config not found' }, { status: 404 })

  const result = await testSpConfig({
    tenant_id: cfg.tenant_id,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    site_host: cfg.site_host,
    site_path: cfg.site_path,
    drive_id: cfg.drive_id,
  })

  // If successful, save the drive_id back
  if (result.ok && result.driveId) {
    await auth.admin
      .from('sp_configs')
      .update({ drive_id: result.driveId })
      .eq('id', id)
  }

  return NextResponse.json(result)
}
