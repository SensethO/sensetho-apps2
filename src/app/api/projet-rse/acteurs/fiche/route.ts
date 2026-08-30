// /api/projet-rse/acteurs/fiche — un acteur et ses rattachements, par son seul
// identifiant. L'organisation est retrouvée depuis l'acteur, ce qui évite de la
// faire transiter par l'interface.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { elementsRattaches } from '@/lib/projet-rse/acteurs'

export const dynamic = 'force-dynamic'

/** GET ?id= → { acteur } — attributs complets et liste des rattachements. */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_acteurs').select('*').eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Acteur introuvable' }, { status: 404 })

    const guard = await requireOrgOwner(data.organisation_id)
    if (guard instanceof NextResponse) return guard

    return NextResponse.json({ acteur: { ...data, liens: await elementsRattaches(id) } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
