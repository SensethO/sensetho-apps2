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

function maskSecret<T extends Record<string, unknown>>(row: T): T {
  return { ...row, client_secret: '••••••••' }
}

// GET — list all configs (secret masked)
export async function GET() {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('sp_configs')
    .select('id, name, tenant_id, client_id, site_host, site_path, drive_id, root_folder, is_default, notes, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const masked = (data ?? []).map(row => maskSecret(row as Record<string, unknown>))
  return NextResponse.json(masked)
}

// POST — create config
export async function POST(req: NextRequest) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    name: string
    tenant_id: string
    client_id: string
    client_secret: string
    site_host: string
    site_path: string
    root_folder?: string
    is_default?: boolean
    notes?: string
  }

  const { name, tenant_id, client_id, client_secret, site_host, site_path, root_folder, is_default, notes } = body

  if (!name || !tenant_id || !client_id || !client_secret || !site_host || !site_path) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // If setting as default, unset all others first
  if (is_default) {
    await auth.admin.from('sp_configs').update({ is_default: false }).eq('is_default', true)
  }

  const { data, error } = await auth.admin
    .from('sp_configs')
    .insert({
      name,
      tenant_id,
      client_id,
      client_secret,
      site_host,
      site_path,
      root_folder: root_folder ?? 'Documents partages',
      is_default: is_default ?? false,
      notes: notes ?? null,
    })
    .select('id, name, tenant_id, client_id, site_host, site_path, drive_id, root_folder, is_default, notes, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(maskSecret(data as Record<string, unknown>), { status: 201 })
}
