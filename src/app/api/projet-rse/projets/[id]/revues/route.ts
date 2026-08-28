// /api/projet-rse/projets/[id]/revues — revues de phase go/no-go (méthode PRiSM).
// Un « go » avance automatiquement le projet à la phase suivante
// (pre_project → discovery → design → delivery → closure ; closure + go → statut « clos »).
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet, PHASES } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** GET → { revues } */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_revues')
      .select('*')
      .eq('projet_id', params.id)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ revues: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST { phase, decision, commentaire?, business_case_valide?, seuils_respectes? }
 * → { revue, projet } (projet après avancement automatique éventuel)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard
    const { projet } = guard

    const body = await req.json() as Record<string, unknown>
    const phase = typeof body.phase === 'string' ? body.phase : ''
    const decision = typeof body.decision === 'string' ? body.decision : ''
    if (!(PHASES as readonly string[]).includes(phase)) {
      return NextResponse.json({ error: 'phase invalide' }, { status: 400 })
    }
    if (!['go', 'no_go', 'conditionnel'].includes(decision)) {
      return NextResponse.json({ error: 'decision invalide' }, { status: 400 })
    }

    const insert: Record<string, unknown> = { projet_id: params.id, phase, decision }
    for (const key of ['commentaire', 'business_case_valide', 'seuils_respectes', 'decide_le'] as const) {
      if (key in body) insert[key] = body[key]
    }

    const admin = createAdminClient()
    const { data: revue, error } = await admin
      .from('projet_rse_revues')
      .insert(insert)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Avancement automatique en cas de « go » sur la phase revue.
    let projetFinal = projet
    if (decision === 'go') {
      const idx = PHASES.indexOf(phase as (typeof PHASES)[number])
      const patch: Record<string, unknown> = {}
      if (phase === 'closure') {
        patch.statut = 'clos'
      } else if (idx >= 0 && idx < PHASES.length - 1) {
        patch.phase = PHASES[idx + 1]
      }
      if (Object.keys(patch).length > 0) {
        const { data: updated, error: upErr } = await admin
          .from('projet_rse_projets')
          .update(patch)
          .eq('id', params.id)
          .select()
          .single()
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
        projetFinal = updated
      }
    }

    return NextResponse.json({ revue, projet: projetFinal })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
