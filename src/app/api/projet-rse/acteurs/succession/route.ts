// /api/projet-rse/acteurs/succession — remplacer le titulaire d'une partie prenante.
//
// À distinguer du simple renommage : la succession crée un nouvel acteur,
// transfère les rattachements et les actions à mener, et clôt le prédécesseur
// sans effacer ce qu'il a produit.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { succeder, successionsDeLOrganisation } from '@/lib/projet-rse/succession'

export const dynamic = 'force-dynamic'

/** GET ?organisation_id= → { successions } — prédécesseur et successeur par acteur. */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard
    return NextResponse.json({ successions: await successionsDeLOrganisation(organisationId!) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST { acteur_id, nouveau_nom, motif, date_effet?, engagement_initial?, attributs? }
 *   → { succession }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const acteurId = typeof body.acteur_id === 'string' ? body.acteur_id : ''
    if (!acteurId) return NextResponse.json({ error: 'acteur_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: a } = await admin
      .from('projet_rse_acteurs').select('organisation_id').eq('id', acteurId).maybeSingle()
    if (!a) return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })
    const guard = await requireOrgOwner(a.organisation_id)
    if (guard instanceof NextResponse) return guard

    const r = await succeder({
      acteurId,
      nouveauNom: typeof body.nouveau_nom === 'string' ? body.nouveau_nom : '',
      motif: typeof body.motif === 'string' ? body.motif : '',
      dateEffet: typeof body.date_effet === 'string' && body.date_effet
        ? body.date_effet : new Date().toISOString().slice(0, 10),
      auteurId: guard.userId,
      engagementInitial: typeof body.engagement_initial === 'string'
        ? body.engagement_initial : undefined,
      attributs: typeof body.attributs === 'object' && body.attributs
        ? body.attributs as Record<string, unknown> : undefined,
    })
    if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: r.statut })
    return NextResponse.json({ succession: r })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
