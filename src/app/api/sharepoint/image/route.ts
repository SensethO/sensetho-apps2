/**
 * GET /api/sharepoint/image?item_id=xxx&app=guided-diagnostic
 *
 * Fournisseur d'URL signée pour la visualisation inline (PDF, images, vidéos).
 *
 * Mise en conformité du 2026-08-30 (docs/RSE_APP_PATTERN.md §11) :
 * cette route était auparavant un proxy qui téléchargeait le fichier depuis
 * SharePoint et le réémettait au navigateur — les octets transitaient donc par
 * Vercel. Elle applique désormais le pattern « signed-url » standard de la
 * plateforme (cf. api/iso53001/[id]/notes/signed-url, api/budget-association/
 * pieces/signed-url) : seules des URL sont renvoyées, le navigateur va chercher
 * le contenu directement chez Microsoft. Aucun octet de fichier ne transite
 * plus par Vercel ni par Supabase.
 *
 * Retourne :
 *   url      — `@microsoft.graph.downloadUrl`, URL pré-authentifiée (~1 h),
 *              directement exploitable en <img src>, <video src> ou <a download>.
 *   embedUrl — URL de page d'aperçu Microsoft (action Graph `/preview`),
 *              destinée aux <iframe> : contrairement à `url`, elle rend le
 *              document inline au lieu de déclencher un téléchargement.
 *              `null` si l'aperçu n'est pas disponible pour ce fichier.
 *   name / mime — métadonnées de l'item.
 *
 * Les URL étant de courte durée, le client doit les redemander à chaque
 * ouverture de la visionneuse plutôt que les mémoriser.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('item_id')
    const app = searchParams.get('app') ?? 'guided-diagnostic'

    if (!itemId) return NextResponse.json({ error: 'item_id requis' }, { status: 400 })

    // 1. Métadonnées + URL de téléchargement pré-authentifiée
    const metaRes = await spGraphForApp(app, `/items/${itemId}`)
    if (!metaRes.ok) {
      const detail = await metaRes.text()
      return NextResponse.json({ error: 'Item SharePoint non trouvé', detail }, { status: 502 })
    }

    const meta = await metaRes.json() as Record<string, unknown>
    const url = meta['@microsoft.graph.downloadUrl'] as string | undefined
    const mime = (meta.file as Record<string, string> | undefined)?.mimeType ?? 'application/octet-stream'
    const name = (meta.name as string | undefined) ?? 'file'

    if (!url) {
      return NextResponse.json({ error: 'URL de téléchargement non disponible' }, { status: 502 })
    }

    // 2. URL d'aperçu embarquable (rendu inline en <iframe>).
    //    Best-effort : certains types ou certaines configurations de drive ne
    //    la fournissent pas — on retombe alors sur `url` côté client.
    let embedUrl: string | null = null
    try {
      const previewRes = await spGraphForApp(app, `/items/${itemId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (previewRes.ok) {
        const preview = await previewRes.json() as { getUrl?: string | null }
        embedUrl = preview.getUrl ?? null
      }
    } catch {
      embedUrl = null
    }

    return NextResponse.json({ url, embedUrl, name, mime })
  } catch (err) {
    console.error('[sharepoint/image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
