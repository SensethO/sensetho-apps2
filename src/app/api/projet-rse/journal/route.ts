// /api/projet-rse/journal — fil d'avancement d'un élément.
// Y sont reportés les changements de parties prenantes, les décisions de
// structure et les notes libres. C'est ce qui permet, en relisant un projet
// six mois plus tard, de savoir qu'un interlocuteur a changé et pourquoi.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { structureAbsente } from '@/lib/projet-rse/compat'
import { lireIdentifiant } from '@/lib/projet-rse/request'

export const dynamic = 'force-dynamic'

const CIBLES = ['portefeuille_id', 'programme_id', 'sous_programme_id', 'projet_id'] as const

/**
 * GET ?organisation_id= [&projet_id= | &sous_programme_id= | …] [&limite=]
 *   → { entrees } — sans cible, renvoie le fil de toute l'organisation.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const organisationId = sp.get('organisation_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    let q = admin.from('projet_rse_journal').select('*').eq('organisation_id', organisationId!)
    const cible = CIBLES.find(c => sp.get(c))
    if (cible) q = q.eq(cible, sp.get(cible)!)

    const limite = Math.min(Number(sp.get('limite') ?? 100) || 100, 500)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limite)
    if (error) {
      if (structureAbsente(error)) return NextResponse.json({ entrees: [] })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ entrees: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { organisation_id, <une cible>, texte, type? } → { entree } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const organisationId = typeof body.organisation_id === 'string' ? body.organisation_id : null
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const texte = typeof body.texte === 'string' ? body.texte.trim() : ''
    if (!texte) return NextResponse.json({ error: 'texte requis' }, { status: 400 })

    const insert: Record<string, unknown> = {
      organisation_id: organisationId,
      type: typeof body.type === 'string' ? body.type : 'note',
      texte, auteur_id: guard.userId,
    }
    for (const c of CIBLES) if (typeof body[c] === 'string' && body[c]) insert[c] = body[c]
    if (typeof body.acteur_id === 'string' && body.acteur_id) insert.acteur_id = body.acteur_id

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_journal').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entree: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= — retire une note. Les entrées automatiques restent supprimables. */
export async function DELETE(req: NextRequest) {
  try {
    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: e } = await admin
      .from('projet_rse_journal').select('organisation_id').eq('id', id).maybeSingle()
    if (!e) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
    const guard = await requireOrgOwner(e.organisation_id)
    if (guard instanceof NextResponse) return guard

    const { error } = await admin.from('projet_rse_journal').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
