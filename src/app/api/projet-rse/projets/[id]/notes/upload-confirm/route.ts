// /api/projet-rse/projets/[id]/notes/upload-confirm — confirme un upload
// direct navigateur → SharePoint. Les métadonnées de la pièce sont portées
// par les sections jsonb de projet_rse_notes (sauvegarde débouncée du
// panneau) ; le fichier lui-même est dans SharePoint.

import { NextRequest, NextResponse } from 'next/server'
import { requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projet-rse/projets/[id]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as {
      actionKey?: string
      attachmentId?: string
      spItemId?: string
      name?: string
      mime?: string
      size?: number
      annexeIndex?: number
    }
    const { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex } = body

    if (!spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const id = attachmentId ?? crypto.randomUUID()

    return NextResponse.json({
      data: {
        id,
        name,
        sharepoint_item_id: spItemId,
        mime: mime ?? null,
        size: size ?? null,
        annexe_index: annexeIndex ?? null,
        action_key: actionKey ?? null,
        projet_id: params.id,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
