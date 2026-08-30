// /api/projet-rse/smp — plan de management de la durabilité.
//
// Attaché au programme, et non au projet : un plan par projet serait
// vingt-neuf fois le même. Un rattachement au projet reste possible pour les
// projets autonomes, hors programme.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner, requireProjet } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'

export const dynamic = 'force-dynamic'

const CHAMPS = ['libelle', 'axe', 'unite', 'valeur_depart', 'cible', 'echeance',
  'seuil_alerte', 'instance_escalade', 'frequence', 'proprietaire_acteur_id'] as const

/** Garde : par le programme (via son organisation) ou par le projet. */
async function garde(programmeId: string | null, projetId: string | null) {
  if (programmeId) {
    const admin = createAdminClient()
    const { data: pg } = await admin
      .from('projet_rse_programmes').select('organisation_id').eq('id', programmeId).maybeSingle()
    if (!pg) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
    return requireOrgOwner(pg.organisation_id)
  }
  if (projetId) return requireProjet(projetId)
  return NextResponse.json({ error: 'programme_id ou projet_id requis' }, { status: 400 })
}

/** GET ?programme_id= | ?projet_id= → { kpi } */
export async function GET(req: NextRequest) {
  try {
    const programmeId = req.nextUrl.searchParams.get('programme_id')
    const projetId = req.nextUrl.searchParams.get('projet_id')
    const g = await garde(programmeId, projetId)
    if (g instanceof NextResponse) return g

    const admin = createAdminClient()
    let q = admin.from('projet_rse_smp').select('*')
    q = programmeId ? q.eq('programme_id', programmeId) : q.eq('projet_id', projetId!)
    const { data, error } = await q.order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ kpi: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { programme_id | projet_id, libelle, … } → { kpi } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const programmeId = typeof body.programme_id === 'string' ? body.programme_id : null
    const projetId = typeof body.projet_id === 'string' ? body.projet_id : null
    const g = await garde(programmeId, projetId)
    if (g instanceof NextResponse) return g

    const libelle = typeof body.libelle === 'string' ? body.libelle.trim() : ''
    if (!libelle) return NextResponse.json({ error: 'libelle requis' }, { status: 400 })

    const insert: Record<string, unknown> = programmeId
      ? { programme_id: programmeId } : { projet_id: projetId }
    for (const c of CHAMPS) if (c in body) insert[c] = body[c]
    insert.libelle = libelle

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_smp').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ kpi: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, … } → { kpi } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: ligne } = await admin
      .from('projet_rse_smp').select('programme_id, projet_id').eq('id', id).maybeSingle()
    if (!ligne) return NextResponse.json({ error: 'Indicateur introuvable' }, { status: 404 })
    const g = await garde(ligne.programme_id, ligne.projet_id)
    if (g instanceof NextResponse) return g

    const patch: Record<string, unknown> = {}
    for (const c of CHAMPS) if (c in body) patch[c] = body[c]
    if (!Object.keys(patch).length)
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

    const { data, error } = await admin
      .from('projet_rse_smp').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ kpi: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= */
export async function DELETE(req: NextRequest) {
  try {
    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const admin = createAdminClient()
    const { data: ligne } = await admin
      .from('projet_rse_smp').select('programme_id, projet_id').eq('id', id).maybeSingle()
    if (!ligne) return NextResponse.json({ error: 'Indicateur introuvable' }, { status: 404 })
    const g = await garde(ligne.programme_id, ligne.projet_id)
    if (g instanceof NextResponse) return g

    const { error } = await admin.from('projet_rse_smp').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
