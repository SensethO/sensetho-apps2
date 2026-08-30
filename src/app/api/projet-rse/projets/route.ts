// /api/projet-rse/projets — CRUD des projets RSE (méthode PRiSM).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner, requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** GET /api/projet-rse/projets?organisation_id= → { projets } (avec compteurs) */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: projets, error } = await admin
      .from('projet_rse_projets')
      .select('*')
      .eq('organisation_id', organisationId!)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (projets ?? []).map(p => p.id)
    const partiesCount: Record<string, number> = {}
    const engagementsCount: Record<string, number> = {}
    if (ids.length > 0) {
      const [{ data: parties }, { data: engagements }] = await Promise.all([
        // Les parties prenantes d'un projet sont ses rattachements au registre.
        admin.from('projet_rse_acteur_liens').select('projet_id').in('projet_id', ids),
        admin.from('projet_rse_engagements').select('projet_id').in('projet_id', ids),
      ])
      for (const row of parties ?? []) {
        partiesCount[row.projet_id] = (partiesCount[row.projet_id] ?? 0) + 1
      }
      for (const row of engagements ?? []) {
        engagementsCount[row.projet_id] = (engagementsCount[row.projet_id] ?? 0) + 1
      }
    }

    const enriched = (projets ?? []).map(p => ({
      ...p,
      nb_parties: partiesCount[p.id] ?? 0,
      nb_engagements: engagementsCount[p.id] ?? 0,
    }))
    return NextResponse.json({ projets: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/projet-rse/projets — { organisation_id, nom, … } → { projet } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { organisation_id: organisationId, nom }
    for (const key of ['description', 'contexte', 'date_debut', 'date_fin_prevue',
                       'sous_programme_id', 'programme_id', 'portefeuille_id'] as const) {
      if (key in body) insert[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_projets')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ projet: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/projet-rse/projets — { id, …champs } → { projet } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireProjet(id)
    if (guard instanceof NextResponse) return guard

    const allowed = [
      'nom', 'description', 'contexte', 'statut', 'phase',
      'date_debut', 'date_fin_prevue', 'business_case',
      // Rattachement au Système de création de valeur (null accepté pour détacher).
      'programme_id', 'portefeuille_id', 'sous_programme_id',
    ]
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_projets')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ projet: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/projet-rse/projets?id= → { ok: true } */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireProjet(id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_projets').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
