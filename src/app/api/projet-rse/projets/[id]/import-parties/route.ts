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

    // L'import alimente le registre de l'organisation, pas une copie propre au
    // projet : un acteur déjà inscrit est réutilisé et simplement rattaché.
    const orgId = guard.projet.organisation_id
    const { data: registre } = await admin
      .from('projet_rse_acteurs').select('id, nom').eq('organisation_id', orgId)
    const parNom = new Map((registre ?? []).map(a => [String(a.nom).trim().toLowerCase(), a.id]))

    const { data: dejaLies } = await admin
      .from('projet_rse_acteur_liens').select('acteur_id').eq('projet_id', params.id)
    const lies = new Set((dejaLies ?? []).map(l => l.acteur_id))

    let importes = 0, reutilises = 0
    for (const s of stakeholders) {
      const nom = typeof s.name === 'string' ? s.name.trim() : ''
      if (!nom) continue
      const cle = nom.toLowerCase()

      let acteurId = parNom.get(cle)
      if (acteurId) {
        reutilises++
      } else {
        const { data: cree, error: eA } = await admin.from('projet_rse_acteurs').insert({
          organisation_id: orgId,
          nom,
          organisation: typeof s.organisation === 'string' && s.organisation ? s.organisation : null,
          categorie: 'bleue',
          pouvoir: clamp15(s.influence),
          interet: clamp15(s.interest),
          attentes: typeof s.notes === 'string' && s.notes ? s.notes : null,
        }).select('id').single()
        if (eA || !cree) continue
        acteurId = cree.id
        parNom.set(cle, acteurId)
        await admin.from('projet_rse_acteur_historique').insert({
          acteur_id: acteurId, type: 'creation',
          motif: 'Importé depuis une session « Parties prenantes & Matérialité ».',
          auteur_id: userId })
      }

      if (lies.has(acteurId)) continue
      const { error: eL } = await admin.from('projet_rse_acteur_liens')
        .insert({ acteur_id: acteurId, projet_id: params.id, criticite: 'concernee' })
      if (eL) continue
      lies.add(acteurId)
      importes++
    }
    return NextResponse.json({ imported: importes, reutilises })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
