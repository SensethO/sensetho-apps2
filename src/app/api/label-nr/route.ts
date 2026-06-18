import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findSharedDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'label-nr'
const TABLE = 'label_nr_diagnostics'

async function checkSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', 'label-nr')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

/** GET /api/label-nr?org_id=xxx&annee=2025 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id')
    const annee = parseInt(searchParams.get('annee') ?? '')
    if (!org_id || isNaN(annee)) {
      return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })
    }

    const subscribed = await checkSubscription(user.id)
    const admin = createAdminClient()

    // 1. Diagnostic propre (nécessite un abonnement)
    let data = null
    if (subscribed) {
      const own = await admin
        .from(TABLE).select('*')
        .eq('user_id', user.id).eq('org_id', org_id).eq('annee', annee)
        .maybeSingle()
      data = own.data
    }

    // 2. Sinon, diagnostic partagé avec l'utilisateur (pas d'abonnement requis)
    if (!data) {
      data = await findSharedDiagnostic(APP_SLUG, TABLE, user.id, org_id, annee)
    }

    // Ni abonné, ni destinataire d'un partage → accès refusé
    if (!data && !subscribed) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/label-nr — créer ou upsert un diagnostic */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) {
      return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const { org_id, annee } = await req.json()
    if (!org_id || !annee) {
      return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('label_nr_diagnostics')
      .upsert(
        { user_id: user.id, org_id, annee },
        { onConflict: 'user_id,org_id,annee', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
