/**
 * PUT    /api/agri/observations/[id]/action-notes/[key]  → upsert notes sections
 * DELETE /api/agri/observations/[id]/action-notes/[key]  → clear notes
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; key: string }> }

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id: observationId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { sections, plantation_id } = body
    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections[] requis' }, { status: 400 })
    }

    const svc = createAdminClient()

    // Vérifier si l'enregistrement existe déjà pour ne pas écraser plantation_id avec null
    const { data: existing } = await svc
      .from('agri_observation_notes')
      .select('id')
      .eq('observation_id', observationId)
      .maybeSingle()

    let updated
    let dbErr
    if (existing) {
      // UPDATE — ne touche qu'aux notes, préserve plantation_id
      ;({ data: updated, error: dbErr } = await svc
        .from('agri_observation_notes')
        .update({ notes_sections: sections, updated_at: new Date().toISOString() })
        .eq('observation_id', observationId)
        .select('observation_id, notes_sections')
        .single())
    } else {
      // INSERT — avec plantation_id si fourni
      ;({ data: updated, error: dbErr } = await svc
        .from('agri_observation_notes')
        .insert({ observation_id: observationId, plantation_id: plantation_id ?? null, notes_sections: sections })
        .select('observation_id, notes_sections')
        .single())
    }

    if (dbErr) throw new Error(dbErr.message)
    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id: observationId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const svc = createAdminClient()
    const { error } = await svc
      .from('agri_observation_notes')
      .update({ notes_sections: [], updated_at: new Date().toISOString() })
      .eq('observation_id', observationId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { observation_id: observationId, notes_sections: [] } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
