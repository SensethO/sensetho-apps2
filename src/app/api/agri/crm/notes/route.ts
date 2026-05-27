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
      .from('agri_crm_notes')
      .select('*')
      .eq('plantation_id', plantationId)
      .order('updated_at', { ascending: false })
    return NextResponse.json({ notes: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { plantation_id, titre, contenu } = await req.json()
    if (!plantation_id || !titre) return NextResponse.json({ error: 'Champs requis' }, { status: 400 })
    const svc = makeSvc()
    const { allowed } = await checkPlantationAccess(svc, user.id, plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const { data: profile } = await svc.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle()
    const nom = (profile as { full_name?: string; email?: string } | null)?.full_name || (profile as { full_name?: string; email?: string } | null)?.email || user.email || 'Inconnu'
    const { data, error } = await svc
      .from('agri_crm_notes')
      .insert({ plantation_id, titre, contenu: contenu || '', fichiers: [], created_by: user.id, created_by_nom: nom })
      .select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ note: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
