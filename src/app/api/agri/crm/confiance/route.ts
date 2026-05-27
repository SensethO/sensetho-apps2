export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { makeSvc, getUser, checkPlantationAccess } from '../_auth'

export async function GET(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const plantationId = searchParams.get('plantation_id')
    if (!plantationId) return NextResponse.json({ error: 'plantation_id requis' }, { status: 400 })
    const svc = makeSvc()
    const { allowed } = await checkPlantationAccess(svc, user.id, plantationId)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    // Confiance = acheteur only, scoped to current user
    const { data } = await svc
      .from('agri_crm_confiance')
      .select('*')
      .eq('plantation_id', plantationId)
      .eq('acheteur_user_id', user.id)
      .order('created_at', { ascending: false })
    // Score global = moyenne
    const rows = data ?? []
    const score = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.score as number), 0) / rows.length) : null
    return NextResponse.json({ entries: rows, score })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { plantation_id, score, note, interaction_ref } = await req.json()
    if (!plantation_id || !score) return NextResponse.json({ error: 'Champs requis' }, { status: 400 })
    const svc = makeSvc()
    const { allowed } = await checkPlantationAccess(svc, user.id, plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const { data, error } = await svc
      .from('agri_crm_confiance')
      .insert({ plantation_id, acheteur_user_id: user.id, score, note: note || null, interaction_ref: interaction_ref || null })
      .select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ entry: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const svc = makeSvc()
    await svc.from('agri_crm_confiance').delete().eq('id', id).eq('acheteur_user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
