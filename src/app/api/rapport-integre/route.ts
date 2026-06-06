import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function checkSubscription(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: app } = await admin.from('apps').select('id').eq('slug', 'rapport-integre').single()
  if (!app) return false
  const { data: sub } = await admin.from('app_subscriptions')
    .select('id').eq('user_id', userId).eq('app_id', app.id).eq('status', 'active').maybeSingle()
  return !!sub
}

/** GET /api/rapport-integre?org_id=&annee= — liste des rapports */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const org_id = req.nextUrl.searchParams.get('org_id')
    const annee = req.nextUrl.searchParams.get('annee')
    if (!org_id || !annee) return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('rapports_integres')
      .select('id, titre, template, statut, sources, score_completion, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .eq('annee', parseInt(annee))
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/rapport-integre — créer un nouveau rapport */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await checkSubscription(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      org_id: string; annee: number; titre?: string; template?: string
    }
    if (!body.org_id || !body.annee) return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('rapports_integres')
      .insert({
        user_id: user.id,
        org_id: body.org_id,
        annee: body.annee,
        titre: body.titre ?? `Rapport Intégré ${body.annee}`,
        template: body.template ?? 'iirc',
        statut: 'brouillon',
        sources: [],
        score_completion: 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
