import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function checkSubscription(userId: string, appSlug: string): Promise<boolean> {
  const admin = createAdminClient()
  // Vérifier si admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  // Vérifier abonnement
  const { data } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', appSlug)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

/** GET /api/guided-diagnostic?org_id=xxx&year=2025 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id')
    const year = parseInt(searchParams.get('year') ?? '')

    if (!org_id || isNaN(year)) {
      return NextResponse.json({ error: 'org_id and year are required' }, { status: 400 })
    }

    if (!await checkSubscription(user.id, 'diagnostic-initial')) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Chercher le diagnostic (propriétaire OU partagé)
    const { data: owned } = await admin
      .from('guided_diagnostics')
      .select('*')
      .eq('user_id', user.id)
      .eq('organisation_id', org_id)
      .eq('year', year)
      .maybeSingle()

    if (owned) return NextResponse.json({ data: owned, isOwner: true })

    // Chercher un diagnostic partagé avec cet utilisateur pour cette org+year
    const { data: shared } = await admin
      .from('guided_diagnostics')
      .select('*, guided_diagnostic_shares!inner(permission, shared_with_user_id)')
      .eq('organisation_id', org_id)
      .eq('year', year)
      .eq('guided_diagnostic_shares.shared_with_user_id', user.id)
      .maybeSingle()

    if (shared) {
      const permission = (shared as Record<string, unknown[]>).guided_diagnostic_shares?.[0]
      return NextResponse.json({ data: shared, isOwner: false, permission })
    }

    return NextResponse.json({ data: null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/guided-diagnostic — créer un nouveau diagnostic */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await checkSubscription(user.id, 'diagnostic-initial')) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
    }

    const { org_id, year, secteur } = await req.json()
    if (!org_id || !year) {
      return NextResponse.json({ error: 'org_id and year are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('guided_diagnostics')
      .upsert(
        { user_id: user.id, organisation_id: org_id, year, secteur: secteur ?? null },
        { onConflict: 'user_id,organisation_id,year', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
