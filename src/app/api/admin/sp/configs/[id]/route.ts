import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// PATCH — update config
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>

  // If client_secret is the mask placeholder, remove it from the update payload
  const updates: Record<string, unknown> = { ...body }
  if (updates.client_secret === '••••••••') {
    delete updates.client_secret
  }

  // Remove read-only fields
  delete updates.id
  delete updates.created_at
  delete updates.updated_at

  // If setting as default, unset all others first
  if (updates.is_default === true) {
    await auth.admin
      .from('sp_configs')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', id)
  }

  const { data, error } = await auth.admin
    .from('sp_configs')
    .update(updates)
    .eq('id', id)
    .select('id, name, tenant_id, client_id, site_host, site_path, drive_id, root_folder, is_default, notes, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const masked = { ...data, client_secret: '••••••••' }
  return NextResponse.json(masked)
}

// DELETE — remove config
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { error } = await auth.admin.from('sp_configs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
