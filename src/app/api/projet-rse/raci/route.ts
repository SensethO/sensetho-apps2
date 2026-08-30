// /api/projet-rse/raci — matrice des responsabilités d'un lot de travail.
// Réalise, Approuve, Consulté, Informé. Les titulaires sont des acteurs du
// registre, jamais des noms recopiés : une succession suit donc jusqu'ici.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'
import { messageErreur, structureAbsente } from '@/lib/projet-rse/erreurs'

export const dynamic = 'force-dynamic'

/** Charge le lot, puis vérifie le propriétaire par son projet. */
async function requireLot(lotId: string) {
  const admin = createAdminClient()
  const { data: lot } = await admin
    .from('projet_rse_lots').select('id, projet_id').eq('id', lotId).maybeSingle()
  if (!lot) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
  const guard = await requireProjet(lot.projet_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, lot }
}

/** GET ?projet_id= → { raci } — toutes les affectations du projet. */
export async function GET(req: NextRequest) {
  try {
    const projetId = req.nextUrl.searchParams.get('projet_id')
    if (!projetId) return NextResponse.json({ error: 'projet_id requis' }, { status: 400 })
    const guard = await requireProjet(projetId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: lots, error: eLots } = await admin
      .from('projet_rse_lots').select('id').eq('projet_id', projetId)
    // Sans ce contrôle, l'absence de table se traduirait par une liste vide —
    // c'est-à-dire par un silence, alors qu'il faut agir.
    if (eLots && structureAbsente(eLots))
      return NextResponse.json({ error: messageErreur(eLots) }, { status: 500 })
    const ids = (lots ?? []).map(l => l.id)
    if (!ids.length) return NextResponse.json({ raci: [] })

    const { data, error } = await admin
      .from('projet_rse_raci').select('*').in('lot_id', ids)
    if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
    return NextResponse.json({ raci: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST { lot_id, acteur_id, role } → { affectation }
 * Un lot ne peut avoir qu'un seul « A » : c'est la règle qui donne son sens à
 * la matrice — une responsabilité partagée n'est portée par personne.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const lotId = typeof body.lot_id === 'string' ? body.lot_id : ''
    const acteurId = typeof body.acteur_id === 'string' ? body.acteur_id : ''
    const role = typeof body.role === 'string' ? body.role : ''
    if (!lotId || !acteurId || !role)
      return NextResponse.json({ error: 'lot_id, acteur_id et role requis' }, { status: 400 })
    const guard = await requireLot(lotId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    if (role === 'A') {
      const { data: deja } = await admin
        .from('projet_rse_raci').select('id').eq('lot_id', lotId).eq('role', 'A').maybeSingle()
      if (deja) return NextResponse.json({
        error: 'Ce lot a déjà un approbateur. Une responsabilité d’approbation partagée '
             + 'n’est portée par personne : retirez l’actuel avant d’en désigner un autre.',
      }, { status: 409 })
    }

    const { data, error } = await admin
      .from('projet_rse_raci').insert({ lot_id: lotId, acteur_id: acteurId, role })
      .select().single()
    if (error) {
      const doublon = error.message.includes('idx_projet_rse_raci_unique')
      return NextResponse.json(
        { error: doublon ? 'Cette affectation existe déjà.' : error.message },
        { status: doublon ? 409 : 500 })
    }
    return NextResponse.json({ affectation: data })
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
      .from('projet_rse_raci').select('lot_id').eq('id', id).maybeSingle()
    if (!ligne) return NextResponse.json({ error: 'Affectation introuvable' }, { status: 404 })
    const guard = await requireLot(ligne.lot_id)
    if (guard instanceof NextResponse) return guard

    const { error } = await admin.from('projet_rse_raci').delete().eq('id', id)
    if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
