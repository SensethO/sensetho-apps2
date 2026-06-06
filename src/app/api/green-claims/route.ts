import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** GET /api/green-claims?org_id=&annee= — liste les diagnostics */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id')
    const annee = searchParams.get('annee')
    if (!org_id || !annee) return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })

    const admin = createAdminClient()
    const isAdmin = (await admin.from('profiles').select('role').eq('id', user.id).single()).data?.role === 'admin'

    let q = admin.from('green_claims_diagnostics').select('*').eq('org_id', org_id).eq('annee', parseInt(annee))
    if (!isAdmin) q = q.eq('user_id', user.id)
    const { data, error } = await q.order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/green-claims — créer un diagnostic */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { org_id: string; annee: number; titre?: string }
    if (!body.org_id || !body.annee) return NextResponse.json({ error: 'org_id et annee requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin.from('green_claims_diagnostics').insert({
      user_id: user.id,
      org_id: body.org_id,
      annee: body.annee,
      titre: body.titre ?? `Diagnostic Green Claims ${body.annee}`,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
