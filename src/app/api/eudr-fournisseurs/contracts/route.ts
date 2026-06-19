import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessOrgDossier } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const TABLE = 'eudr_contracts'

/** Champs modifiables côté client */
const FIELDS = [
  'contract_number', 'product', 'product_under_eudr', 'supplier',
  'delivery_country', 'eudr_applied', 'production_date', 'expected_delivery_date',
  'plot_geolocation', 'due_diligence', 'risk_level', 'notes',
]

async function getRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

async function checkSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const role = await getRole(userId)
  if (role === 'admin') return true
  const { data } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', 'eudr-fournisseurs')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

function pickFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) if (k in body) out[k] = body[k]
  return out
}

/** GET /api/eudr-fournisseurs/contracts?org_id=xxx — liste des contrats de l'org */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id')
    if (!org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

    if (!await canAccessOrgDossier('eudr-fournisseurs', user.id, org_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const admin = createAdminClient()
    const { data, error } = await admin.from(TABLE).select('*').eq('org_id', org_id).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/eudr-fournisseurs/contracts — créer un contrat */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const body = await req.json()
    const org_id = body.org_id
    if (!org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canAccessOrgDossier('eudr-fournisseurs', user.id, org_id, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from(TABLE)
      .insert({ ...pickFields(body), org_id, user_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/eudr-fournisseurs/contracts?id=xxx — modifier un contrat */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin.from(TABLE).select('org_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    if (!await canAccessOrgDossier('eudr-fournisseurs', user.id, existing.org_id as string, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const patch = { ...pickFields(body), updated_at: new Date().toISOString() }
    const { data, error } = await admin.from(TABLE).update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/eudr-fournisseurs/contracts?id=xxx — supprimer un contrat */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin.from(TABLE).select('org_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    if (!await canAccessOrgDossier('eudr-fournisseurs', user.id, existing.org_id as string, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin.from(TABLE).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
