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

// GET — list all app routes with config name
export async function GET() {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('sp_app_routes')
    .select(`
      id,
      app_key,
      folder_name,
      sp_config_id,
      created_at,
      updated_at,
      sp_configs ( id, name, site_host, is_default )
    `)
    .order('app_key', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST — upsert app route
export async function POST(req: NextRequest) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    app_key: string
    sp_config_id: string | null
    folder_name: string
  }

  if (!body.app_key || !body.folder_name) {
    return NextResponse.json({ error: 'app_key and folder_name are required' }, { status: 400 })
  }

  const { data, error } = await auth.admin
    .from('sp_app_routes')
    .upsert(
      {
        app_key: body.app_key,
        sp_config_id: body.sp_config_id ?? null,
        folder_name: body.folder_name,
      },
      { onConflict: 'app_key' }
    )
    .select(`
      id,
      app_key,
      folder_name,
      sp_config_id,
      created_at,
      updated_at,
      sp_configs ( id, name, site_host, is_default )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
