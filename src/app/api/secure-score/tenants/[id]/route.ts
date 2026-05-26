import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — mettre à jour un tenant (owner seulement)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  // Vérifier ownership
  const { data: existing } = await admin
    .from('m365_tenants').select('owner_id, org_id').eq('id', id).single()
  if (!existing || existing.owner_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Champs modifiables
  const allowed = ['name', 'domain', 'tenant_id', 'client_id', 'client_secret', 'notes', 'is_shared',
    'last_score', 'last_max_score', 'last_status', 'last_run_date']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  const { data, error } = await admin
    .from('m365_tenants').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — supprimer un tenant (owner seulement)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('m365_tenants').select('owner_id').eq('id', id).single()
  if (!existing || existing.owner_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { error } = await admin.from('m365_tenants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
