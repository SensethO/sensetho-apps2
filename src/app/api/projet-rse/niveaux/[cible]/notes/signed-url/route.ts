// URL de téléchargement SharePoint d'une pièce portée par un élément hors
// projet. Le navigateur va chercher le fichier directement à cette adresse :
// rien ne passe par Vercel.

import { NextRequest, NextResponse } from 'next/server'
import { requireCible } from '@/lib/projet-rse/cible'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { cible: string } }) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const itemId = req.nextUrl.searchParams.get('item_id')
    if (!itemId) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    const res = await spGraphForApp('projet-rse', '/items/' + itemId)
    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json({ error: 'Item SharePoint non trouvé', detail }, { status: 502 })
    }

    const item = await res.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL de téléchargement non disponible' }, { status: 502 })

    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
