// /api/projet-rse/portefeuilles — CRUD des portefeuilles (Système de création de valeur PMI).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** Garde par portefeuille : charge la ligne puis vérifie le propriétaire de l'organisation. */
async function requirePortefeuille(id: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projet_rse_portefeuilles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(data.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, portefeuille: data }
}

/** GET /api/projet-rse/portefeuilles?organisation_id= → { portefeuilles } (avec compteurs programmes/projets) */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: portefeuilles, error } = await admin
      .from('projet_rse_portefeuilles')
      .select('*')
      .eq('organisation_id', organisationId!)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (portefeuilles ?? []).map(p => p.id)
    const programmesCount: Record<string, number> = {}
    const projetsCount: Record<string, number> = {}
    if (ids.length > 0) {
      const [{ data: programmes }, { data: projets }] = await Promise.all([
        admin.from('projet_rse_programmes').select('portefeuille_id').in('portefeuille_id', ids),
        admin.from('projet_rse_projets').select('portefeuille_id').in('portefeuille_id', ids),
      ])
      for (const row of programmes ?? []) {
        if (row.portefeuille_id) {
          programmesCount[row.portefeuille_id] = (programmesCount[row.portefeuille_id] ?? 0) + 1
        }
      }
      for (const row of projets ?? []) {
        if (row.portefeuille_id) {
          projetsCount[row.portefeuille_id] = (projetsCount[row.portefeuille_id] ?? 0) + 1
        }
      }
    }

    const enriched = (portefeuilles ?? []).map(p => ({
      ...p,
      nb_programmes: programmesCount[p.id] ?? 0,
      nb_projets: projetsCount[p.id] ?? 0,
    }))
    return NextResponse.json({ portefeuilles: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/projet-rse/portefeuilles — { organisation_id, nom, description?, objectifs_strategiques? } → { portefeuille } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { organisation_id: organisationId, nom }
    for (const key of ['description', 'objectifs_strategiques'] as const) {
      if (key in body) insert[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_portefeuilles')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ portefeuille: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/projet-rse/portefeuilles — { id, …champs } → { portefeuille } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requirePortefeuille(id)
    if (guard instanceof NextResponse) return guard

    const allowed = ['nom', 'description', 'objectifs_strategiques']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_portefeuilles')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ portefeuille: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/projet-rse/portefeuilles?id= → { ok: true } (programmes/projets rattachés repassent à NULL) */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requirePortefeuille(id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_portefeuilles').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
