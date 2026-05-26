import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET  — liste les tenants de l'utilisateur + ceux partagés par son org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  // Récupérer l'org_id du profil
  const { data: profile } = await admin
    .from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile?.org_id ?? null

  // Tenants personnels
  const { data: own } = await admin
    .from('m365_tenants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Tenants partagés de l'org (exclure les siens déjà listés)
  let shared: unknown[] = []
  if (orgId) {
    const { data } = await admin
      .from('m365_tenants')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_shared', true)
      .neq('owner_id', user.id)
      .order('name')
    shared = data ?? []
  }

  return NextResponse.json({ own: own ?? [], shared })
}

// POST — créer un tenant
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { name, domain, tenant_id, client_id, client_secret, notes, is_shared } = body

  if (!name?.trim() || !domain?.trim() || !tenant_id?.trim() || !client_id?.trim()) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Récupérer l'org_id du profil pour le partage
  const { data: profile } = await admin
    .from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profile?.org_id ?? null

  const { data, error } = await admin.from('m365_tenants').insert({
    owner_id: user.id,
    org_id: orgId,
    name: name.trim(),
    domain: domain.trim().toLowerCase(),
    tenant_id: tenant_id.trim(),
    client_id: client_id.trim(),
    client_secret: client_secret?.trim() ?? null,
    notes: notes?.trim() ?? '',
    is_shared: Boolean(is_shared) && Boolean(orgId),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
