// /api/projet-rse/programmes — CRUD des programmes (Système de création de valeur PMI).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** Garde par programme : charge la ligne puis vérifie le propriétaire de l'organisation. */
async function requireProgramme(id: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projet_rse_programmes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(data.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, programme: data }
}

/** GET /api/projet-rse/programmes?organisation_id= → { programmes } (avec compteur projets) */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: programmes, error } = await admin
      .from('projet_rse_programmes')
      .select('*')
      .eq('organisation_id', organisationId!)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (programmes ?? []).map(p => p.id)
    const projetsCount: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: projets } = await admin
        .from('projet_rse_projets')
        .select('programme_id')
        .in('programme_id', ids)
      for (const row of projets ?? []) {
        if (row.programme_id) {
          projetsCount[row.programme_id] = (projetsCount[row.programme_id] ?? 0) + 1
        }
      }
    }

    const enriched = (programmes ?? []).map(p => ({
      ...p,
      nb_projets: projetsCount[p.id] ?? 0,
    }))
    return NextResponse.json({ programmes: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/projet-rse/programmes — { organisation_id, nom, description?, portefeuille_id? } → { programme } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { organisation_id: organisationId, nom }
    for (const key of ['description', 'portefeuille_id'] as const) {
      if (key in body) insert[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_programmes')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ programme: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/projet-rse/programmes — { id, …champs, portefeuille_id? (null accepté) } → { programme } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireProgramme(id)
    if (guard instanceof NextResponse) return guard

    const allowed = ['nom', 'description', 'portefeuille_id']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_programmes')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ programme: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/projet-rse/programmes?id= → { ok: true } (projets rattachés repassent à NULL) */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireProgramme(id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_programmes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
