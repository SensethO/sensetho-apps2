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
    const { data: existing } = await svc.from('agri_crm_notes').select('plantation_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
    const { allowed } = await checkPlantationAccess(svc, user.id, existing.plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('titre' in body) updates.titre = body.titre
    if ('contenu' in body) updates.contenu = body.contenu
    const { data, error } = await svc.from('agri_crm_notes').update(updates).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ note: data })
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
    const { data: existing } = await svc.from('agri_crm_notes').select('plantation_id').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
    const { allowed } = await checkPlantationAccess(svc, user.id, existing.plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    await svc.from('agri_crm_notes').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
