// /api/projet-rse/projets/[id]/import-parties — import des parties prenantes
// d'une session de l'app Parties Prenantes (pp_sessions.stakeholders, jsonb).
// Mapping best-effort : name → nom, organisation → organisation,
// influence → pouvoir, interest → interet, notes → attentes, catégorie « bleue ».
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

interface PPStakeholder {
  id?: string
  name?: string
  organisation?: string
  notes?: string
  influence?: number
  interest?: number
}

function clamp15(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 3
  return Math.min(5, Math.max(1, n))
}

/** POST { pp_session_id } → { imported } */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard
    const { userId } = guard

    const body = await req.json() as Record<string, unknown>
    const ppSessionId = typeof body.pp_session_id === 'string' ? body.pp_session_id : ''
    if (!ppSessionId) return NextResponse.json({ error: 'pp_session_id requis' }, { status: 400 })

    const admin = createAdminClient()
    // pp_sessions est indexée par utilisateur : la session doit appartenir à l'appelant.
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id, stakeholders')
      .eq('id', ppSessionId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Session parties prenantes introuvable' }, { status: 404 })

    const stakeholders: PPStakeholder[] = Array.isArray(session.stakeholders) ? session.stakeholders : []
    if (stakeholders.length === 0) return NextResponse.json({ imported: 0 })

    // Anti-doublon par nom (insensible à la casse, espaces normalisés).
    const { data: existing } = await admin
      .from('projet_rse_parties')
      .select('nom')
      .eq('projet_id', params.id)
    const seen = new Set((existing ?? []).map(p => String(p.nom).trim().toLowerCase()))

    const rows: Record<string, unknown>[] = []
    for (const s of stakeholders) {
      const nom = typeof s.name === 'string' ? s.name.trim() : ''
      if (!nom) continue
      const key = nom.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        projet_id: params.id,
        nom,
        organisation: typeof s.organisation === 'string' && s.organisation ? s.organisation : null,
        categorie: 'bleue',
        pouvoir: clamp15(s.influence),
        interet: clamp15(s.interest),
        attentes: typeof s.notes === 'string' && s.notes ? s.notes : null,
      })
    }
    if (rows.length === 0) return NextResponse.json({ imported: 0 })

    const { error } = await admin.from('projet_rse_parties').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imported: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
