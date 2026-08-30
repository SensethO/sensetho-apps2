// /api/projet-rse/sous-programmes — niveau intermédiaire entre le programme et
// le projet. Un sous-programme ne produit pas de livrable : il regroupe les
// projets qui concourent au même bénéfice, et c'est à ce niveau que
// l'arbitrage entre projets se fait.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'

export const dynamic = 'force-dynamic'

const CHAMPS = ['code', 'nom', 'fonction', 'description', 'ordre'] as const

/** Charge le sous-programme puis vérifie le propriétaire via son programme. */
async function requireSousProgramme(id: string) {
  const admin = createAdminClient()
  const { data: sp } = await admin
    .from('projet_rse_sous_programmes').select('*').eq('id', id).maybeSingle()
  if (!sp) return NextResponse.json({ error: 'Sous-programme introuvable' }, { status: 404 })
  const { data: pg } = await admin
    .from('projet_rse_programmes').select('organisation_id').eq('id', sp.programme_id).maybeSingle()
  if (!pg) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  const guard = await requireOrgOwner(pg.organisation_id)
  if (guard instanceof NextResponse) return guard
  return { userId: guard.userId, sousProgramme: sp, organisationId: pg.organisation_id as string }
}

/**
 * GET ?organisation_id= [&programme_id=] → { sous_programmes }
 * Chaque sous-programme porte le décompte de ses projets par statut.
 */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const programmeId = req.nextUrl.searchParams.get('programme_id')
    const guard = await requireOrgOwner(organisationId)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { data: programmes } = await admin
      .from('projet_rse_programmes').select('id').eq('organisation_id', organisationId!)
    const ids = (programmes ?? []).map(p => p.id)
    if (!ids.length) return NextResponse.json({ sous_programmes: [] })

    let q = admin.from('projet_rse_sous_programmes').select('*').in('programme_id', ids)
    if (programmeId) q = q.eq('programme_id', programmeId)
    const { data, error } = await q.order('ordre', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: projets } = await admin
      .from('projet_rse_projets')
      .select('id, sous_programme_id, statut')
      .eq('organisation_id', organisationId!)

    const enrichis = (data ?? []).map(sp => {
      const miens = (projets ?? []).filter(p => p.sous_programme_id === sp.id)
      return {
        ...sp,
        nb_projets: miens.length,
        nb_actifs: miens.filter(p => p.statut === 'actif').length,
        nb_suspendus: miens.filter(p => p.statut === 'suspendu').length,
        nb_clos: miens.filter(p => p.statut === 'clos').length,
      }
    })
    return NextResponse.json({ sous_programmes: enrichis })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { programme_id, code, nom, fonction?, description?, ordre? } → { sous_programme } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const programmeId = typeof body.programme_id === 'string' ? body.programme_id : ''
    if (!programmeId) return NextResponse.json({ error: 'programme_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: pg } = await admin
      .from('projet_rse_programmes').select('organisation_id').eq('id', programmeId).maybeSingle()
    if (!pg) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
    const guard = await requireOrgOwner(pg.organisation_id)
    if (guard instanceof NextResponse) return guard

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    if (!code) return NextResponse.json({ error: 'code requis' }, { status: 400 })
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 })

    const insert: Record<string, unknown> = { programme_id: programmeId, code, nom }
    for (const k of CHAMPS) if (k in body && k !== 'code' && k !== 'nom') insert[k] = body[k]

    const { data, error } = await admin
      .from('projet_rse_sous_programmes').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('projet_rse_journal').insert({
      organisation_id: pg.organisation_id,
      programme_id: programmeId,
      type: 'structure',
      texte: `Sous-programme créé : ${code} — ${nom}.`,
      auteur_id: guard.userId,
    })
    return NextResponse.json({ sous_programme: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH { id, …champs } → { sous_programme } */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireSousProgramme(id)
    if (guard instanceof NextResponse) return guard

    const patch: Record<string, unknown> = {}
    for (const k of CHAMPS) if (k in body) patch[k] = body[k]
    if (!Object.keys(patch).length)
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projet_rse_sous_programmes').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sous_programme: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?id= — les projets rattachés sont détachés, non supprimés. */
export async function DELETE(req: NextRequest) {
  try {
    const id = await lireIdentifiant(req)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const guard = await requireSousProgramme(id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    const { error } = await admin.from('projet_rse_sous_programmes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
