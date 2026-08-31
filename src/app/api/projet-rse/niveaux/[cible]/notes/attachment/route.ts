// Renomme ou supprime une pièce jointe d'un élément hors projet, côté
// SharePoint. Les métadonnées vivent dans les sections jsonb : c'est le
// panneau qui les met à jour ; ici on ne touche qu'au fichier, retrouvé en
// balayant les notes de la cible.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCible, filtreDeCible, type Cible } from '@/lib/projet-rse/cible'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

interface SectionLite { attachments?: Array<{ id?: string; path?: string }> }

/** Retrouve l'item SharePoint d'une pièce en balayant les notes de la cible. */
async function trouverItem(cible: Cible, attachmentId: string): Promise<string | null> {
  const admin = createAdminClient()
  let q = admin.from('projet_rse_notes').select('sections')
  for (const [col, val] of Object.entries(filtreDeCible(cible))) {
    q = val === null ? q.is(col, null) : q.eq(col, val)
  }
  const { data: rows } = await q
  for (const r of (rows ?? [])) {
    for (const s of ((r.sections ?? []) as SectionLite[])) {
      for (const a of (s.attachments ?? [])) {
        if (a.id === attachmentId && a.path) return a.path
      }
    }
  }
  return null
}

/** PATCH ?attachment_id= — corps { fileName } */
export async function PATCH(req: NextRequest, { params }: { params: { cible: string } }) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const id = req.nextUrl.searchParams.get('attachment_id')
    if (!id) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })
    const { fileName } = await req.json() as { fileName?: string }
    if (!fileName) return NextResponse.json({ error: 'fileName requis' }, { status: 400 })

    const item = await trouverItem(cible, id)
    if (!item) return NextResponse.json({ error: 'Pièce jointe introuvable' }, { status: 404 })

    const res = await spGraphForApp('projet-rse', '/items/' + item, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName }),
    })
    if (!res.ok && res.status !== 404) {
      const detail = await res.text()
      return NextResponse.json({ error: 'Échec renommage SharePoint', detail }, { status: 502 })
    }
    return NextResponse.json({ ok: true, name: fileName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?attachment_id= */
export async function DELETE(req: NextRequest, { params }: { params: { cible: string } }) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const id = req.nextUrl.searchParams.get('attachment_id')
    if (!id) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })

    const item = await trouverItem(cible, id)
    // Déjà retirée des sections : il n'y a rien à supprimer côté SharePoint.
    if (!item) return NextResponse.json({ ok: true })

    const res = await spGraphForApp('projet-rse', '/items/' + item, { method: 'DELETE' })
    // 204 = succès, 404 = déjà supprimée.
    if (!res.ok && res.status !== 404) {
      const detail = await res.text()
      return NextResponse.json({ error: 'Échec suppression SharePoint', detail }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
