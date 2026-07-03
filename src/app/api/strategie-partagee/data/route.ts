import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessOrgDossier } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP_SLUG = 'strategie-partagee'
const TABLE = 'strategie_partagee'

// Champs (modules) modifiables côté client.
const FIELDS = ['horizon', 'mission', 'swot', 'attentes', 'vision', 'valeurs', 'axes', 'strategie_activite', 'hoshin', 'bsc', 'master_plan', 'pilotage', 'kotter']

async function getRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

async function checkSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  if (await getRole(userId) === 'admin') return true
  const { data } = await admin
    .from('app_subscriptions')
    .select('id, expires_at, apps!inner(slug)')
    .eq('apps.slug', APP_SLUG)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of FIELDS) if (k in body) out[k] = body[k]
  return out
}

/** GET ?org_id=xxx — document stratégique de l'organisation (créé vide si absent). */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })

    const orgId = req.nextUrl.searchParams.get('org_id')
    if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canAccessOrgDossier(APP_SLUG, user.id, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.from(TABLE).select('*').eq('org_id', orgId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT { org_id, ...modules } — sauvegarde (upsert) le document. Droit d'édition requis. */
export async function PUT(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })

    const body = await req.json() as Record<string, unknown>
    const orgId = body.org_id as string | undefined
    if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canAccessOrgDossier(APP_SLUG, user.id, orgId, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    // Préserve le créateur d'origine (un collaborateur en édition ne « s'approprie » pas le document).
    const { data: existing } = await admin.from(TABLE).select('user_id').eq('org_id', orgId).maybeSingle()
    const { error } = await admin.from(TABLE).upsert({
      org_id: orgId,
      user_id: (existing?.user_id as string) ?? user.id,
      ...pick(body),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
