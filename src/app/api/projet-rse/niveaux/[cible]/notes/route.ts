// /api/projet-rse/niveaux/[cible]/notes — notes & documents des niveaux
// autres que le projet : portefeuille, programme, sous-programme, acteur du
// registre, et l'organisation elle-même.
//
// Même table, même forme de charge utile et même éditeur que les notes de
// projet : seule l'adresse change. La cible s'écrit « programme:<uuid> », ce
// qui permet de réutiliser GuidedActionNotePanel sans le modifier.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCible, filtreDeCible } from '@/lib/projet-rse/cible'
import { messageErreur, structureAbsente } from '@/lib/projet-rse/erreurs'

export const dynamic = 'force-dynamic'

type Contexte = { params: { cible: string } }

/**
 * GET /api/projet-rse/niveaux/[cible]/notes[?action_key=xxx]
 * → { data: { sections: Record<action_key, NoteSection[]>, notes: Record<action_key, string> } }
 */
export async function GET(req: NextRequest, { params }: Contexte) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const admin = createAdminClient()
    let q = admin.from('projet_rse_notes').select('action_key, content, sections')
    for (const [col, val] of Object.entries(filtreDeCible(cible))) {
      q = val === null ? q.is(col, null) : q.eq(col, val)
    }
    const actionKey = req.nextUrl.searchParams.get('action_key')
    if (actionKey) q = q.eq('action_key', actionKey)

    const { data: rows, error } = await q
    if (error) {
      // Sans les colonnes de la migration, on dit pourquoi plutôt que de
      // renvoyer une liste vide qui ferait croire à une absence de contenu.
      if (structureAbsente(error))
        return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const sections: Record<string, unknown[]> = {}
    const notes: Record<string, string> = {}
    for (const r of (rows ?? [])) {
      if (r.sections) sections[r.action_key as string] = r.sections as unknown[]
      if (r.content) notes[r.action_key as string] = r.content as string
    }
    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT { action_key, sections?, content? } — crée ou met à jour la note. */
export async function PUT(req: NextRequest, { params }: Contexte) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const body = await req.json() as {
      action_key?: string; sections?: unknown[]; content?: string }
    if (!body.action_key)
      return NextResponse.json({ error: 'action_key requis' }, { status: 400 })

    const filtre = filtreDeCible(cible)
    const admin = createAdminClient()

    // Pas de clé unique unique sur cinq cibles : on cherche puis on écrit.
    let q = admin.from('projet_rse_notes').select('id').eq('action_key', body.action_key)
    for (const [col, val] of Object.entries(filtre)) {
      q = val === null ? q.is(col, null) : q.eq(col, val)
    }
    const { data: existante, error: eLecture } = await q.maybeSingle()
    if (eLecture) {
      if (structureAbsente(eLecture))
        return NextResponse.json({ error: messageErreur(eLecture) }, { status: 500 })
      return NextResponse.json({ error: eLecture.message }, { status: 500 })
    }

    const champs: Record<string, unknown> = {}
    if (body.sections !== undefined) champs.sections = body.sections
    if (body.content !== undefined) champs.content = body.content

    const { data, error } = existante
      ? await admin.from('projet_rse_notes').update(champs)
          .eq('id', existante.id).select('id').single()
      : await admin.from('projet_rse_notes')
          .insert({ ...filtre, action_key: body.action_key, ...champs })
          .select('id').single()

    if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
