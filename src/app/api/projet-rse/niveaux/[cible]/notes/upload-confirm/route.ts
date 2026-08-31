// Confirme un envoi direct navigateur → SharePoint pour un élément hors
// projet. Les métadonnées de la pièce vivent dans les sections jsonb de
// projet_rse_notes, écrites par le panneau ; cette route ne fait que rendre
// la pièce mise en forme, avec la même signature que celle des projets.

import { NextRequest, NextResponse } from 'next/server'
import { requireCible } from '@/lib/projet-rse/cible'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { cible: string } }) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const b = await req.json() as {
      actionKey?: string
      attachmentId?: string
      spItemId?: string
      name?: string
      mime?: string
      size?: number
      annexeIndex?: number
    }

    if (!b.spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    if (!b.name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    return NextResponse.json({
      data: {
        id: b.attachmentId ?? crypto.randomUUID(),
        name: b.name,
        sharepoint_item_id: b.spItemId,
        mime: b.mime ?? null,
        size: b.size ?? null,
        annexe_index: b.annexeIndex ?? null,
        action_key: b.actionKey ?? null,
        cible: cible.niveau + ':' + cible.id,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
