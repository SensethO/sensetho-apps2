// /api/projet-rse/projets/[id]/notes/attachment — renomme ou supprime une
// pièce jointe côté SharePoint. Les métadonnées vivent dans les sections
// jsonb de projet_rse_notes : c’est la sauvegarde débouncée du panneau qui
// les met à jour ; ici on ne touche qu’au fichier SharePoint, retrouvé en
// balayant les sections du projet (pas de table de pièces dédiée).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

const APP_KEY = 'projet-rse'

interface SectionLite { attachments?: Array<{ id?: string; path?: string }> }

/** Retrouve l’item SharePoint d’une pièce en balayant les sections du projet. */
async function trouverItemSharepoint(projetId: string, attachmentId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('projet_rse_notes')
    .select('sections')
    .eq('projet_id', projetId)
  for (const row of (rows ?? [])) {
    const sections = (row.sections ?? []) as SectionLite[]
    for (const section of sections) {
      for (const att of (section.attachments ?? [])) {
        if (att.id === attachmentId && att.path) return att.path
      }
    }
  }
  return null
}

/**
 * PATCH /api/projet-rse/projets/[id]/notes/attachment?attachment_id=xxx
 * Body: { fileName: string } — renomme le fichier sur SharePoint.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })

    const body = await req.json() as { fileName?: string }
    if (!body.fileName) return NextResponse.json({ error: 'fileName requis' }, { status: 400 })

    const spItemId = await trouverItemSharepoint(params.id, attachment_id)
    if (!spItemId) return NextResponse.json({ error: 'Pièce jointe introuvable' }, { status: 404 })

    const spRes = await spGraphForApp(APP_KEY, `/items/${spItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: body.fileName }),
    })
    if (!spRes.ok && spRes.status !== 404) {
      const errText = await spRes.text()
      console.error('[projet-rse/notes/attachment/rename]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec renommage SharePoint', detail: errText }, { status: 502 })
    }

    return NextResponse.json({ ok: true, name: body.fileName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/projet-rse/projets/[id]/notes/attachment?attachment_id=xxx */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const attachment_id = req.nextUrl.searchParams.get('attachment_id')
    if (!attachment_id) return NextResponse.json({ error: 'attachment_id requis' }, { status: 400 })

    const spItemId = await trouverItemSharepoint(params.id, attachment_id)
    if (!spItemId) {
      // Déjà retirée des sections : rien à supprimer côté SharePoint.
      return NextResponse.json({ ok: true })
    }

    const spRes = await spGraphForApp(APP_KEY, `/items/${spItemId}`, { method: 'DELETE' })
    // 204 = succès, 404 = déjà supprimé → on continue quand même
    if (!spRes.ok && spRes.status !== 404) {
      const errText = await spRes.text()
      console.error('[projet-rse/notes/attachment/delete]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec suppression SharePoint', detail: errText }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
