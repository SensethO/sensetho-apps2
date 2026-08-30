// /api/projet-rse/acteurs/historique — ce qui a changé sur un acteur, quand,
// et pourquoi. Lecture seule : l'historique s'écrit par les routes qui
// modifient, jamais à la main.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/** GET ?acteur_id= [&limite=] → { historique } */
export async function GET(req: NextRequest) {
  try {
    const acteurId = req.nextUrl.searchParams.get('acteur_id')
    if (!acteurId) return NextResponse.json({ error: 'acteur_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: acteur } = await admin
      .from('projet_rse_acteurs').select('organisation_id').eq('id', acteurId).maybeSingle()
    if (!acteur) return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })
    const guard = await requireOrgOwner(acteur.organisation_id)
    if (guard instanceof NextResponse) return guard

    const limite = Math.min(Number(req.nextUrl.searchParams.get('limite') ?? 100) || 100, 500)
    const { data, error } = await admin
      .from('projet_rse_acteur_historique').select('*')
      .eq('acteur_id', acteurId).order('created_at', { ascending: false }).limit(limite)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ historique: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
