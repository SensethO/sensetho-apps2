/**
 * POST /api/ecgt/contenus/upload-session
 * Body    : { diagnostic_id, filename, size }
 * Réponse : { uploadUrl, finalName, annexeIndex }
 *
 * Crée une session d'upload SharePoint pour un contenu à auditer (document ou
 * visuel publicitaire). Le navigateur envoie ensuite les octets DIRECTEMENT à
 * `uploadUrl`, puis transmet le `sharepoint_item_id` renvoyé par Microsoft à
 * POST /api/ecgt/contenus.
 *
 * Règle absolue (docs/RSE_APP_PATTERN.md §11) : aucun fichier ne transite par
 * Vercel ni par Supabase. Le préfixe A00x_ vient de la fonction atomique
 * increment_ecgt_notes_counter, partagée avec les annexes des notes : le
 * compteur reste séquentiel et unique pour tout le diagnostic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'ecgt'
const TABLE = 'ecgt_diagnostics'
const APP_KEY = 'ecgt-diagnostic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { diagnostic_id?: string; filename?: string; size?: number }
    const { diagnostic_id, filename, size } = body
    if (!diagnostic_id) return NextResponse.json({ error: 'diagnostic_id requis' }, { status: 400 })
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })
    if (!await canAccessDiagnostic(APP_SLUG, TABLE, user.id, diagnostic_id, { requireEdit: true })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const safeName = filename.replace(/[/\\:*?"<>|]/g, '_').trim()

    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_ecgt_notes_counter', { p_id: diagnostic_id })
    if (counterError || counterData == null) {
      console.error('[ecgt/contenus/upload-session/counter]', counterError)
      return NextResponse.json({ error: 'Échec génération index annexe' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const finalName = 'A' + String(annexeIndex).padStart(3, '0') + '_' + safeName

    const config = await getConfigForApp(APP_KEY)
    const spPath = `/root:/${config.rootFolder}/${diagnostic_id}/contenus/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp(APP_KEY, spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[ecgt/contenus/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
