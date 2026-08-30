// /api/projet-rse/projets/[id]/notes/signed-url — URL de téléchargement
// SharePoint directe. Le téléchargement se fait navigateur → SharePoint,
// sans transiter par Vercel.

import { NextRequest, NextResponse } from 'next/server'
import { requireProjet } from '@/lib/projet-rse/auth'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

const APP_KEY = 'projet-rse'

/** GET /api/projet-rse/projets/[id]/notes/signed-url?item_id=xxx */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const item_id = req.nextUrl.searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    const res = await spGraphForApp(APP_KEY, `/items/${item_id}`)
    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Item SharePoint non trouvé', detail: errText }, { status: 502 })
    }

    const item = await res.json() as Record<string, unknown>
    const downloadUrl = item['@microsoft.graph.downloadUrl'] as string | undefined

    if (!downloadUrl) {
      return NextResponse.json({ error: 'URL de téléchargement non disponible' }, { status: 502 })
    }

    return NextResponse.json({ url: downloadUrl })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
