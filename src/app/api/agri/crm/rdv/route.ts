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
    const { data } = await svc
      .from('agri_crm_rdv')
      .select('*')
      .eq('plantation_id', plantationId)
      .order('date_rdv', { ascending: false })
    return NextResponse.json({ rdvs: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { plantation_id, titre, date_rdv, heure, duree_min, type, lieu, lien } = body
    if (!plantation_id || !titre || !date_rdv) return NextResponse.json({ error: 'Champs requis' }, { status: 400 })
    const svc = makeSvc()
    const { allowed } = await checkPlantationAccess(svc, user.id, plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const { data, error } = await svc
      .from('agri_crm_rdv')
      .insert({ plantation_id, titre, date_rdv, heure: heure || null, duree_min: duree_min || null, type: type || 'sur_place', lieu: lieu || null, lien: lien || null, statut: 'planifie', created_by: user.id })
      .select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ rdv: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
