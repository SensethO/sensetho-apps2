// /api/projet-rse/acteurs — registre des parties prenantes au niveau de
// l'organisation. Une entité par acteur, référencée par les éléments qui la
// concernent. Toute modification est datée, motivée, et reportée dans le fil
// d'avancement de chaque élément rattaché.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { structureAbsente } from '@/lib/projet-rse/compat'
import { lireIdentifiant } from '@/lib/projet-rse/request'
import { CHAMPS_ACTEUR, consignerModification, elementsRattaches } from '@/lib/projet-rse/acteurs'

export const dynamic = 'force-dynamic'

/** Stratégie d'engagement déduite du quadrant pouvoir × intérêt (seuil > 3). */
function strategieQuadrant(pouvoir: number, interet: number): string {
  if (pouvoir > 3 && interet > 3) return 'Engager pleinement'
  if (pouvoir > 3) return 'Garder satisfait'
  if (interet > 3) return 'Tenir informé'
  return 'Information minimale'
}

async function requireActeur(id: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('projet_rse_acteurs').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(data.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, acteur: data as Record<string, unknown> }
}

/**
 * GET ?organisation_id= [&avec_liens=1] [&id=] → { acteurs }
 * Avec `avec_liens`, chaque acteur porte la liste de ses rattachements.
 */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const un = req.nextUrl.searchParams.get('id')
    let q = admin.from('projet_rse_acteurs').select('*').eq('organisation_id', organisationId!)
    if (un) q = q.eq('id', un)
    const { data, error } = await q.order('nom', { ascending: true })
    if (error) {
      if (structureAbsente(error)) return NextResponse.json({ acteurs: [], migration_requise: true })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (req.nextUrl.searchParams.get('avec_liens') !== '1')
      return NextResponse.json({ acteurs: data ?? [] })

    const acteurs = await Promise.all((data ?? []).map(async a => ({
      ...a, liens: await elementsRattaches(a.id),
    })))
    return NextResponse.json({ acteurs })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { organisation_id, nom, …champs } → { acteur } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { organisation_id: organisationId, nom }
    for (const k of CHAMPS_ACTEUR) if (k in body && k !== 'nom') insert[k] = body[k]
    if (typeof insert.strategie !== 'string' || !insert.strategie) {
      const p = typeof insert.pouvoir === 'number' ? insert.pouvoir : 3
      const i = typeof insert.interet === 'number' ? insert.interet : 3
      insert.strategie = strategieQuadrant(p, i)
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_acteurs').insert(insert).select().single()
    if (error) {
      const doublon = error.message.includes('idx_projet_rse_acteurs_nom')
      return NextResponse.json(
        { error: doublon ? `« ${nom} » figure déjà au registre de cette organisation.` : error.message },
        { status: doublon ? 409 : 500 })
    }

    await admin.from('projet_rse_acteur_historique').insert({
      acteur_id: data.id, type: 'creation',
      motif: typeof body.motif === 'string' ? body.motif : null,
      auteur_id: guard.userId,
    })
    return NextResponse.json({ acteur: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PATCH { id, …champs, motif? } → { acteur, propagation }
 *
 * Le changement de nom d'un acteur de type « personne » est un remplacement
 * d'interlocuteur : le motif devient obligatoire, parce que c'est lui qui
 * rendra le changement lisible dans le fil de chaque élément rattaché.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireActeur(id)
    if (guard instanceof NextResponse) return guard
    const avant = guard.acteur

    const patch: Record<string, unknown> = {}
    for (const k of CHAMPS_ACTEUR) if (k in body) patch[k] = body[k]
    if (!Object.keys(patch).length)
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

    const motif = typeof body.motif === 'string' && body.motif.trim() ? body.motif.trim() : null
    const remplacement =
      'nom' in patch && patch.nom !== avant.nom && avant.type === 'personne'
    if (remplacement && !motif) {
      return NextResponse.json({
        error: 'Remplacement d’une personne physique : le motif est requis. Il sera reporté '
             + 'dans le fil d’avancement de chaque élément rattaché.',
      }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_acteurs').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const propagation = await consignerModification({
      acteurId: id,
      organisationId: avant.organisation_id as string,
      nomActeur: avant.nom as string,
      avant, apres: patch, motif, auteurId: guard.userId, remplacement,
    })
    return NextResponse.json({ acteur: data, propagation })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * DELETE ?id= — refuse la suppression si l'acteur est rattaché quelque part.
 * Retirer du registre se fait par `actif = false`, ce qui préserve l'historique.
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireActeur(id)
    if (guard instanceof NextResponse) return guard

    const liens = await elementsRattaches(id)
    if (liens.length) {
      return NextResponse.json({
        error: `« ${guard.acteur.nom} » est rattaché à ${liens.length} élément(s). `
             + 'Détachez-le d’abord, ou retirez-le du registre en le passant à inactif — '
             + 'ce qui conserve son historique.',
        liens,
      }, { status: 409 })
    }
    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_acteurs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
