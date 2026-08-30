// /api/projet-rse/projets/[id]/engagements — plan d'engagement des parties prenantes.
//
// Depuis le passage au registre d'organisation, un engagement pointe vers
// l'acteur (`acteur_id`) et non vers une copie propre au projet. `partie_id`
// reste accepté et renvoyé comme alias, pour ne pas casser l'interface.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'

export const dynamic = 'force-dynamic'

const CHAMPS = [
  'acteur_id', 'action', 'responsable', 'canal', 'frequence', 'echeance', 'statut', 'mode',
] as const

/** GET ?partie_id= (optionnel) → { engagements } */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    let query = admin
      .from('projet_rse_engagements')
      .select('*')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: true })
    const cible = req.nextUrl.searchParams.get('acteur_id')
      ?? req.nextUrl.searchParams.get('partie_id')
    if (cible) query = query.eq('acteur_id', cible)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // `partie_id` reste exposé comme alias, l'interface s'en sert encore.
    const engagements = (data ?? []).map(e => ({ ...e, partie_id: e.acteur_id }))
    return NextResponse.json({ engagements })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { partie_id, action, … } → { engagement } */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as Record<string, unknown>
    const acteurId = typeof body.acteur_id === 'string' ? body.acteur_id
      : typeof body.partie_id === 'string' ? body.partie_id : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!acteurId) return NextResponse.json({ error: 'acteur_id requis' }, { status: 400 })
    if (!action) return NextResponse.json({ error: 'action requise' }, { status: 400 })

    const admin = createAdminClient()
    // L'acteur doit être rattaché à ce projet : on n'engage pas quelqu'un
    // qui ne figure pas au registre des parties prenantes du projet.
    const { data: lien } = await admin
      .from('projet_rse_acteur_liens')
      .select('id')
      .eq('acteur_id', acteurId)
      .eq('projet_id', params.id)
      .maybeSingle()
    if (!lien) return NextResponse.json(
      { error: 'Cette partie prenante n’est pas rattachée à ce projet.' }, { status: 404 })

    const insert: Record<string, unknown> = { projet_id: params.id, acteur_id: acteurId }
    for (const key of CHAMPS) {
      if (key in body && key !== 'acteur_id') insert[key] = body[key]
    }
    insert.action = action

    const { data, error } = await admin
      .from('projet_rse_engagements')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ engagement: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, … } → { engagement } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    for (const key of CHAMPS) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_engagements')
      .update(patch)
      .eq('id', id)
      .eq('projet_id', params.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ engagement: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= (identifiant accepté aussi dans le corps JSON) → { ok: true } */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('projet_rse_engagements')
      .delete()
      .eq('id', id)
      .eq('projet_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
