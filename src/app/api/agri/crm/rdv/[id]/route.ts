export const dynamic = 'force-dynamic'
import { NextResponse, NextRequest } from 'next/server'
import { makeSvc, getUser, checkPlantationAccess } from '../../_auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const svc = makeSvc()
    const { data: existing } = await svc.from('agri_crm_rdv').select('plantation_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 })
    const { allowed } = await checkPlantationAccess(svc, user.id, existing.plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of ['titre','date_rdv','heure','duree_min','type','lieu','lien','statut','compte_rendu']) {
      if (key in body) updates[key] = body[key]
    }
    if ('compte_rendu' in body) updates.compte_rendu_updated_at = new Date().toISOString()
    const { data, error } = await svc.from('agri_crm_rdv').update(updates).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ rdv: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const svc = makeSvc()
    const { data: existing } = await svc.from('agri_crm_rdv').select('plantation_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'RDV introuvable' }, { status: 404 })
    const { allowed } = await checkPlantationAccess(svc, user.id, existing.plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    await svc.from('agri_crm_rdv').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
