// /api/projet-rse/projets/[id]/parties — vue « parties prenantes » d'un projet.
//
// Depuis le passage au registre d'organisation, cette route ne détient plus de
// données propres : elle lit et écrit les acteurs du registre à travers leurs
// rattachements. Conséquences voulues :
//   — modifier une partie prenante ici la modifie partout où elle est référencée,
//     et le changement est reporté dans le fil d'avancement de chaque élément ;
//   — la supprimer ici la détache de ce projet sans l'effacer du registre.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'
import { CHAMPS_ACTEUR, consignerLien, consignerModification, elementsRattaches }
  from '@/lib/projet-rse/acteurs'
import { structureAbsente } from '@/lib/projet-rse/compat'

export const dynamic = 'force-dynamic'

/** Stratégie d'engagement déduite du quadrant pouvoir × intérêt (seuil > 3). */
function strategieQuadrant(pouvoir: number, interet: number): string {
  if (pouvoir > 3 && interet > 3) return 'Engager pleinement'
  if (pouvoir > 3) return 'Garder satisfait'
  if (interet > 3) return 'Tenir informé'
  return 'Information minimale'
}

/** GET → { parties } — acteurs rattachés au projet, enrichis du rôle local. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: liens, error } = await admin
      .from('projet_rse_acteur_liens').select('*').eq('projet_id', params.id)
    if (error) {
      // Migration non encore appliquee : on sert l'ancien modele plutot que
      // d'afficher un ecran vide, qui ressemblerait a une perte de donnees.
      if (structureAbsente(error)) {
        const { data: legacy } = await admin
          .from('projet_rse_parties').select('*').eq('projet_id', params.id)
          .order('created_at', { ascending: true })
        return NextResponse.json({ parties: legacy ?? [], modele: 'legacy' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!liens?.length) return NextResponse.json({ parties: [] })

    const { data: acteurs } = await admin
      .from('projet_rse_acteurs').select('*').in('id', liens.map(l => l.acteur_id))

    const parties = (acteurs ?? []).map(a => {
      const l = liens.find(x => x.acteur_id === a.id)!
      return { ...a, projet_id: params.id, lien_id: l.id,
               role_local: l.role_local, criticite: l.criticite }
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return NextResponse.json({ parties })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST (champs de l'acteur) → { partie }
 * Si un acteur du même nom existe déjà au registre de l'organisation, il est
 * réutilisé plutôt que dupliqué : c'est tout l'objet du registre.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard
    const orgId = guard.projet.organisation_id

    const body = await req.json() as Record<string, unknown>
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existant, error: eRegistre } = await admin
      .from('projet_rse_acteurs').select('*')
      .eq('organisation_id', orgId).ilike('nom', nom).maybeSingle()
    if (eRegistre && structureAbsente(eRegistre)) {
      const insertL: Record<string, unknown> = { projet_id: params.id, nom }
      for (const k of CHAMPS_ACTEUR)
        if (k in body && k !== 'nom' && k !== 'type' && k !== 'actif') insertL[k] = body[k]
      if (typeof insertL.strategie !== 'string' || !insertL.strategie) {
        const pv = typeof insertL.pouvoir === 'number' ? insertL.pouvoir : 3
        const it = typeof insertL.interet === 'number' ? insertL.interet : 3
        insertL.strategie = strategieQuadrant(pv, it)
      }
      const { data, error } = await admin
        .from('projet_rse_parties').insert(insertL).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ partie: data, modele: 'legacy' })
    }

    let acteur = existant
    if (!acteur) {
      const insert: Record<string, unknown> = { organisation_id: orgId, nom }
      for (const k of CHAMPS_ACTEUR) if (k in body && k !== 'nom') insert[k] = body[k]
      if (typeof insert.strategie !== 'string' || !insert.strategie) {
        const p = typeof insert.pouvoir === 'number' ? insert.pouvoir : 3
        const i = typeof insert.interet === 'number' ? insert.interet : 3
        insert.strategie = strategieQuadrant(p, i)
      }
      const { data, error } = await admin
        .from('projet_rse_acteurs').insert(insert).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      acteur = data
      await admin.from('projet_rse_acteur_historique').insert({
        acteur_id: acteur.id, type: 'creation',
        motif: `Créé depuis le projet « ${guard.projet.nom} ».`, auteur_id: guard.userId })
    }

    const { data: lien, error: eL } = await admin
      .from('projet_rse_acteur_liens')
      .insert({ acteur_id: acteur.id, projet_id: params.id,
                role_local: typeof body.role_local === 'string' ? body.role_local : null,
                criticite: typeof body.criticite === 'string' ? body.criticite : 'concernee' })
      .select().single()
    if (eL) {
      const doublon = eL.message.includes('idx_projet_rse_liens_unique')
      return NextResponse.json(
        { error: doublon ? `« ${nom} » est déjà rattaché à ce projet.` : eL.message },
        { status: doublon ? 409 : 500 })
    }

    const elements = await elementsRattaches(acteur.id)
    const el = elements.find(e => e.id === params.id)
    if (el) await consignerLien({
      acteurId: acteur.id, organisationId: orgId, nomActeur: acteur.nom,
      element: el, sens: 'rattachement',
      motif: existant ? 'Rattachement d’un acteur déjà inscrit au registre.' : null,
      auteurId: guard.userId })

    return NextResponse.json({
      partie: { ...acteur, projet_id: params.id, lien_id: lien.id,
                role_local: lien.role_local, criticite: lien.criticite },
      reutilise: Boolean(existant),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PATCH { id, … } → { partie, propagation }
 * `id` est l'identifiant de l'acteur. La modification vaut pour tous les
 * éléments qui le référencent, et elle y est journalisée.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as Record<string, unknown>
    const acteurId = typeof body.id === 'string' ? body.id : ''
    if (!acteurId) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: avant, error: eAvant } = await admin
      .from('projet_rse_acteurs').select('*').eq('id', acteurId).maybeSingle()
    if (eAvant && structureAbsente(eAvant)) {
      const patchL: Record<string, unknown> = {}
      for (const k of CHAMPS_ACTEUR)
        if (k in body && k !== 'type' && k !== 'actif') patchL[k] = body[k]
      if (!Object.keys(patchL).length)
        return NextResponse.json({ error: 'Aucun champ a mettre a jour' }, { status: 400 })
      const { data, error } = await admin.from('projet_rse_parties').update(patchL)
        .eq('id', acteurId).eq('projet_id', params.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ partie: data, modele: 'legacy',
        propagation: { champs: Object.keys(patchL), elements: 0 } })
    }
    if (!avant || avant.organisation_id !== guard.projet.organisation_id)
      return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })

    // Le rôle local et la criticité appartiennent au lien, pas à l'acteur.
    if ('role_local' in body || 'criticite' in body) {
      const patchLien: Record<string, unknown> = {}
      if ('role_local' in body) patchLien.role_local = body.role_local
      if ('criticite' in body) patchLien.criticite = body.criticite
      await admin.from('projet_rse_acteur_liens').update(patchLien)
        .eq('acteur_id', acteurId).eq('projet_id', params.id)
    }

    const patch: Record<string, unknown> = {}
    for (const k of CHAMPS_ACTEUR) if (k in body) patch[k] = body[k]
    if (!Object.keys(patch).length) {
      const { data: apres } = await admin
        .from('projet_rse_acteurs').select('*').eq('id', acteurId).single()
      return NextResponse.json({ partie: apres, propagation: { champs: [], elements: 0 } })
    }

    const motif = typeof body.motif === 'string' && body.motif.trim() ? body.motif.trim() : null
    const remplacement = 'nom' in patch && patch.nom !== avant.nom && avant.type === 'personne'
    if (remplacement && !motif)
      return NextResponse.json({
        error: 'Remplacement d’une personne physique : le motif est requis. Il sera reporté '
             + 'dans le fil d’avancement de chaque élément rattaché.' }, { status: 400 })

    const { data, error } = await admin
      .from('projet_rse_acteurs').update(patch).eq('id', acteurId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const propagation = await consignerModification({
      acteurId, organisationId: avant.organisation_id, nomActeur: avant.nom,
      avant, apres: patch, motif, auteurId: guard.userId, remplacement })
    return NextResponse.json({ partie: data, propagation })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * DELETE ?id= — `id` est l'acteur : le lien avec ce projet est retiré,
 * l'acteur reste au registre et sur ses autres rattachements.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const acteurId = await lireIdentifiant(req)
    if (!acteurId) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: acteur, error: eActeur } = await admin
      .from('projet_rse_acteurs').select('*').eq('id', acteurId).maybeSingle()
    if (eActeur && structureAbsente(eActeur)) {
      const { error } = await admin.from('projet_rse_parties').delete()
        .eq('id', acteurId).eq('projet_id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, modele: 'legacy' })
    }
    if (!acteur || acteur.organisation_id !== guard.projet.organisation_id)
      return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })

    const elements = await elementsRattaches(acteurId)
    const el = elements.find(e => e.id === params.id)

    await admin.from('projet_rse_engagements').delete()
      .eq('projet_id', params.id).eq('acteur_id', acteurId)
    const { error } = await admin.from('projet_rse_acteur_liens').delete()
      .eq('acteur_id', acteurId).eq('projet_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (el) await consignerLien({
      acteurId, organisationId: acteur.organisation_id, nomActeur: acteur.nom,
      element: el, sens: 'detachement', motif: null, auteurId: guard.userId })

    const restants = (await elementsRattaches(acteurId)).length
    return NextResponse.json({ ok: true, acteur_conserve: true, rattachements_restants: restants })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
