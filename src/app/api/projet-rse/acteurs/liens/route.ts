// /api/projet-rse/acteurs/liens — rattachement d'un acteur du registre à un
// élément : portefeuille, programme, sous-programme ou projet. Un lien porte le
// rôle local, c'est-à-dire la raison pour laquelle cet acteur est concerné par
// cet élément précis — ce qui distingue un rattachement utile d'une liste
// recopiée.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'
import { consignerLien, elementsRattaches } from '@/lib/projet-rse/acteurs'

export const dynamic = 'force-dynamic'

const CIBLES = ['portefeuille_id', 'programme_id', 'sous_programme_id', 'projet_id'] as const

async function requireActeur(id: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('projet_rse_acteurs').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(data.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, acteur: data as Record<string, unknown> }
}

/**
 * GET ?projet_id= | ?sous_programme_id= | ?programme_id= | ?portefeuille_id=
 *   → { acteurs } — les acteurs rattachés à cet élément, attributs complets.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const cible = CIBLES.find(c => sp.get(c))
    if (!cible) return NextResponse.json({ error: 'une cible est requise' }, { status: 400 })
    const cibleId = sp.get(cible)!

    const admin = createAdminClient()
    const { data: liens } = await admin
      .from('projet_rse_acteur_liens').select('*').eq(cible, cibleId)
    if (!liens?.length) return NextResponse.json({ acteurs: [] })

    const { data: acteurs } = await admin
      .from('projet_rse_acteurs').select('*').in('id', liens.map(l => l.acteur_id))
    if (!acteurs?.length) return NextResponse.json({ acteurs: [] })

    const guard = await requireOrgOwner(acteurs[0].organisation_id)
    if (guard instanceof NextResponse) return guard

    const enrichis = acteurs.map(a => {
      const l = liens.find(x => x.acteur_id === a.id)!
      return { ...a, lien_id: l.id, role_local: l.role_local, criticite: l.criticite }
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return NextResponse.json({ acteurs: enrichis })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { acteur_id, <une cible>, role_local?, criticite?, motif? } → { lien } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const acteurId = typeof body.acteur_id === 'string' ? body.acteur_id : ''
    if (!acteurId) return NextResponse.json({ error: 'acteur_id requis' }, { status: 400 })
    const guard = await requireActeur(acteurId)
    if (guard instanceof NextResponse) return guard

    const cibles = CIBLES.filter(c => typeof body[c] === 'string' && body[c])
    if (cibles.length !== 1)
      return NextResponse.json({ error: 'exactement une cible est requise' }, { status: 400 })

    const insert: Record<string, unknown> = {
      acteur_id: acteurId,
      [cibles[0]]: body[cibles[0]],
      role_local: typeof body.role_local === 'string' ? body.role_local : null,
      criticite: typeof body.criticite === 'string' ? body.criticite : 'concernee',
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_acteur_liens').insert(insert).select().single()
    if (error) {
      const doublon = error.message.includes('idx_projet_rse_liens_unique')
      return NextResponse.json(
        { error: doublon ? 'Cet acteur est déjà rattaché à cet élément.' : error.message },
        { status: doublon ? 409 : 500 })
    }

    const elements = await elementsRattaches(acteurId)
    const el = elements.find(e => e.id === body[cibles[0]])
    if (el) await consignerLien({
      acteurId, organisationId: guard.acteur.organisation_id as string,
      nomActeur: guard.acteur.nom as string, element: el, sens: 'rattachement',
      motif: typeof body.motif === 'string' ? body.motif : null, auteurId: guard.userId,
    })
    return NextResponse.json({ lien: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, role_local?, criticite? } → { lien } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: lien } = await admin
      .from('projet_rse_acteur_liens').select('acteur_id').eq('id', id).maybeSingle()
    if (!lien) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
    const guard = await requireActeur(lien.acteur_id)
    if (guard instanceof NextResponse) return guard

    const patch: Record<string, unknown> = {}
    for (const k of ['role_local', 'criticite']) if (k in body) patch[k] = body[k]
    if (!Object.keys(patch).length)
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

    const { data, error } = await admin
      .from('projet_rse_acteur_liens').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lien: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= — détache l'acteur de l'élément ; l'acteur reste au registre. */
export async function DELETE(req: NextRequest) {
  try {
    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: lien } = await admin
      .from('projet_rse_acteur_liens').select('*').eq('id', id).maybeSingle()
    if (!lien) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
    const guard = await requireActeur(lien.acteur_id)
    if (guard instanceof NextResponse) return guard

    const elements = await elementsRattaches(lien.acteur_id)
    const cible = CIBLES.find(c => lien[c])
    const el = elements.find(e => e.id === (cible ? lien[cible] : null))

    const { error } = await admin.from('projet_rse_acteur_liens').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (el) await consignerLien({
      acteurId: lien.acteur_id, organisationId: guard.acteur.organisation_id as string,
      nomActeur: guard.acteur.nom as string, element: el, sens: 'detachement',
      motif: null, auteurId: guard.userId,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
