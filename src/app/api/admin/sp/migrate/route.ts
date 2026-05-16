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

// GET — list migration jobs
export async function GET() {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('sp_migrations')
    .select(`
      id,
      name,
      app_keys,
      status,
      total_files,
      migrated_files,
      failed_files,
      error_log,
      created_by,
      created_at,
      updated_at,
      source:source_config_id ( id, name ),
      target:target_config_id ( id, name )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST — create migration job
export async function POST(req: NextRequest) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as {
    name: string
    source_config_id: string
    target_config_id: string
    app_keys: string[]
  }

  if (!body.name || !body.source_config_id || !body.target_config_id || !body.app_keys?.length) {
    return NextResponse.json({ error: 'name, source_config_id, target_config_id, app_keys are required' }, { status: 400 })
  }

  // Count total files to migrate
  const admin = createAdminClient()
  let total = 0

  for (const appKey of body.app_keys) {
    if (appKey === 'guided-diagnostic') {
      const { count } = await admin
        .from('guided_action_attachments')
        .select('*', { count: 'exact', head: true })
      total += count ?? 0
    } else if (['iso26000', 'csrd', 'gri'].includes(appKey)) {
      const table = `${appKey}_action_notes`
      const { count } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .not('sections', 'is', null)
      total += count ?? 0
    }
  }

  const { data, error } = await auth.admin
    .from('sp_migrations')
    .insert({
      name: body.name,
      source_config_id: body.source_config_id,
      target_config_id: body.target_config_id,
      app_keys: body.app_keys,
      status: 'pending',
      total_files: total,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
