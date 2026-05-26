import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS } from '@/lib/settings'

// ── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// ── GET — list all settings ───────────────────────────────────────────────────

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin.from('site_settings').select('key, value, label, description, category, updated_at')

  // Merge DB values over defaults
  const merged: Record<string, string> = { ...SETTINGS_DEFAULTS }
  if (data) {
    for (const row of data) merged[row.key] = row.value ?? ''
  }

  return NextResponse.json({ data: merged, rows: data ?? [] })
}

// ── PATCH — upsert settings ───────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body: Record<string, string> = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }))

  if (updates.length === 0) return NextResponse.json({ data: [] })

  const { data, error } = await admin
    .from('site_settings')
    .upsert(updates, { onConflict: 'key' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
