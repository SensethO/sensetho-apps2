/**
 * GET /api/ecgt/contenus/signed-url?contenu_id=xxx
 * (ou ?diagnostic_id=xxx&item_id=yyy pour un item non encore enregistré)
 *
 * Renvoie une URL de téléchargement SharePoint signée : le navigateur va
 * chercher le fichier directement chez Microsoft. Aucun octet ne transite par
 * Vercel (docs/RSE_APP_PATTERN.md §11).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'ecgt'
const TABLE = 'ecgt_diagnostics'
const APP_KEY = 'ecgt-diagnostic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contenuId = req.nextUrl.searchParams.get('contenu_id')
    let itemId = req.nextUrl.searchParams.get('item_id')
    let diagnosticId = req.nextUrl.searchParams.get('diagnostic_id')

    const admin = createAdminClient()

    if (contenuId) {
      const { data: contenu } = await admin
        .from('ecgt_contenus')
        .select('diagnostic_id, sharepoint_item_id')
        .eq('id', contenuId)
        .maybeSingle()
      if (!contenu) return NextResponse.json({ error: 'Contenu non trouvé' }, { status: 404 })
      diagnosticId = contenu.diagnostic_id
      itemId = contenu.sharepoint_item_id
    }

    if (!diagnosticId) return NextResponse.json({ error: 'contenu_id ou diagnostic_id requis' }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: 'Aucun fichier associé à ce contenu' }, { status: 400 })
    if (!await canAccessDiagnostic(APP_SLUG, TABLE, user.id, diagnosticId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const res = await spGraphForApp(APP_KEY, `/items/${itemId}`)
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
