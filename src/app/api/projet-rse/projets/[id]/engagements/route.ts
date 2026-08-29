// /api/projet-rse/projets/[id]/engagements — plan d'engagement des parties prenantes.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

const CHAMPS = [
  'partie_id', 'action', 'responsable', 'canal', 'frequence', 'echeance', 'statut', 'mode',
] as const

/** GET ?partie_id= (optionnel) → { engagements } */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    let query = admin
      .from('projet_rse_engagements')
      .select('*')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: true })
    const partieId = req.nextUrl.searchParams.get('partie_id')
    if (partieId) query = query.eq('partie_id', partieId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ engagements: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { partie_id, action, … } → { engagement } */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as Record<string, unknown>
    const partieId = typeof body.partie_id === 'string' ? body.partie_id : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!partieId) return NextResponse.json({ error: 'partie_id requis' }, { status: 400 })
    if (!action) return NextResponse.json({ error: 'action requise' }, { status: 400 })

    const admin = createAdminClient()
    // La partie prenante doit appartenir au même projet.
    const { data: partie } = await admin
      .from('projet_rse_parties')
      .select('id')
      .eq('id', partieId)
      .eq('projet_id', params.id)
      .maybeSingle()
    if (!partie) return NextResponse.json({ error: 'Partie prenante introuvable dans ce projet' }, { status: 404 })

    const insert: Record<string, unknown> = { projet_id: params.id }
    for (const key of CHAMPS) {
      if (key in body) insert[key] = body[key]
    }
    insert.action = action

    const { data, error } = await admin
      .from('projet_rse_engagements')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ engagement: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, … } → { engagement } */
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
      .from('projet_rse_engagements')
      .update(patch)
      .eq('id', id)
      .eq('projet_id', params.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ engagement: data })
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
      .from('projet_rse_engagements')
      .delete()
      .eq('id', id)
      .eq('projet_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
