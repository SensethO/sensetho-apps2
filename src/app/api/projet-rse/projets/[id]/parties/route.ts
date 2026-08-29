// /api/projet-rse/projets/[id]/parties — parties prenantes du projet
// (matrice pouvoir × intérêt, catégories verte/orange/bleue de la méthode du cours).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

const CHAMPS = [
  'nom', 'organisation', 'categorie', 'role', 'pouvoir', 'interet',
  'attitude', 'attentes', 'verbatims', 'strategie', 'statut_suivi', 'legitimite', 'urgence', 'engagement_actuel', 'engagement_souhaite',
] as const

/** Stratégie d'engagement déduite du quadrant pouvoir × intérêt (seuil > 3).
 *  Libellés alignés sur la matrice de la sous-app (Practice Guide §7.1). */
function strategieQuadrant(pouvoir: number, interet: number): string {
  if (pouvoir > 3 && interet > 3) return 'Engager pleinement'
  if (pouvoir > 3) return 'Garder satisfait'
  if (interet > 3) return 'Tenir informé'
  return 'Information minimale'
}

/** GET → { parties } */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_parties')
      .select('*')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ parties: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST (champs de la table) → { partie } — strategie déduite du quadrant si absente */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as Record<string, unknown>
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { projet_id: params.id }
    for (const key of CHAMPS) {
      if (key in body) insert[key] = body[key]
    }
    insert.nom = nom
    if (typeof insert.strategie !== 'string' || !insert.strategie) {
      const pouvoir = typeof insert.pouvoir === 'number' ? insert.pouvoir : 3
      const interet = typeof insert.interet === 'number' ? insert.interet : 3
      insert.strategie = strategieQuadrant(pouvoir, interet)
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_parties')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ partie: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, … } → { partie } */
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
      .from('projet_rse_parties')
      .update(patch)
      .eq('id', id)
      .eq('projet_id', params.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ partie: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= → { ok: true } */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('projet_rse_parties')
      .delete()
      .eq('id', id)
      .eq('projet_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
