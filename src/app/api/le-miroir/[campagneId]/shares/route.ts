import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function assertOwner(userId: string, campagneId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('le_miroir_campagnes').select('owner_id').eq('id', campagneId).single()
  if (data?.owner_id === userId) return true
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).single()
  return prof?.role === 'admin'
}

/** GET — liste des participants invités à la campagne */
export async function GET(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data } = await admin
      .from('le_miroir_campagne_shares')
      .select('id, created_at, shared_with_user_id, profiles!shared_with_user_id(email, full_name)')
      .eq('campagne_id', params.campagneId)
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { email } — inviter un participant (par e-mail) */
export async function POST(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: target } = await admin.from('profiles').select('id, email').eq('email', email).maybeSingle()
    if (!target) return NextResponse.json({ error: `Aucun compte trouvé pour ${email}. La personne doit d'abord créer son compte sur la plateforme.` }, { status: 404 })
    if (target.id === user.id) return NextResponse.json({ error: 'Vous êtes déjà le responsable de cette campagne.' }, { status: 400 })

    const { data, error } = await admin
      .from('le_miroir_campagne_shares')
      .upsert({ campagne_id: params.campagneId, shared_with_user_id: target.id }, { onConflict: 'campagne_id,shared_with_user_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?share_id= — retirer un participant */
export async function DELETE(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const shareId = req.nextUrl.searchParams.get('share_id')
    if (!shareId) return NextResponse.json({ error: 'share_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('le_miroir_campagne_shares').delete().eq('id', shareId).eq('campagne_id', params.campagneId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
