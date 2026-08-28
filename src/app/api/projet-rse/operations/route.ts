// /api/projet-rse/operations — CRUD des opérations (activités permanentes
// recevant les livrables des projets — Système de création de valeur PMI).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** Garde par opération : charge la ligne puis vérifie le propriétaire de l'organisation. */
async function requireOperation(id: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('projet_rse_operations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'Opération introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(data.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, operation: data }
}

/** Joint le projet source ({ id, nom } | null) à chaque opération. */
function withProjetSource(
  operations: Record<string, unknown>[],
  projets: { id: string; nom: string }[]
) {
  const byId = new Map(projets.map(p => [p.id, p]))
  return operations.map(op => ({
    ...op,
    projet_source: op.projet_source_id
      ? (byId.get(op.projet_source_id as string) ?? null)
      : null,
  }))
}

/** GET /api/projet-rse/operations?organisation_id= → { operations } (avec projet_source: { id, nom } | null) */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: operations, error } = await admin
      .from('projet_rse_operations')
      .select('*')
      .eq('organisation_id', organisationId!)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const sourceIds = Array.from(new Set(
      (operations ?? []).map(op => op.projet_source_id).filter((v): v is string => Boolean(v))
    ))
    let projets: { id: string; nom: string }[] = []
    if (sourceIds.length > 0) {
      const { data } = await admin
        .from('projet_rse_projets')
        .select('id, nom')
        .in('id', sourceIds)
      projets = data ?? []
    }

    return NextResponse.json({ operations: withProjetSource(operations ?? [], projets) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/projet-rse/operations — { organisation_id, nom, description?, projet_source_id? } → { operation } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { organisation_id: organisationId, nom }
    for (const key of ['description', 'projet_source_id', 'statut'] as const) {
      if (key in body) insert[key] = body[key]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_operations')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ operation: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/projet-rse/operations — { id, …champs } → { operation } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireOperation(id)
    if (guard instanceof NextResponse) return guard

    const allowed = ['nom', 'description', 'projet_source_id', 'statut']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_operations')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ operation: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/projet-rse/operations?id= → { ok: true } */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireOperation(id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_operations').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
