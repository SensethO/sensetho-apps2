import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

/**
 * Règle universelle RSE : aucun transit de fichier par Vercel ou Supabase.
 * Cet endpoint retourne UNIQUEMENT des métadonnées + URLs SharePoint directes.
 * Le téléchargement réel se fait navigateur → SharePoint, sans passer par Vercel.
 */

interface Attachment {
  id: string
  name: string
  sharepoint_item_id: string
  mime: string | null
  size: number | null
  action_key: string
  annexe_index: number | null
}

async function canRead(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id, iso26000_diagnostic_shares(shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).iso26000_diagnostic_shares as
    Array<{ shared_with_user_id: string }> | undefined
  return shares?.some(s => s.shared_with_user_id === userId) ?? false
}

/**
 * GET /api/iso26000-diagnostic/[id]/notes/annexes-urls
 *
 * Retourne toutes les pièces jointes du diagnostic avec leur URL de téléchargement
 * SharePoint directe (@microsoft.graph.downloadUrl).
 *
 * Flux de téléchargement :
 *   1. Frontend appelle cet endpoint → reçoit { data: [{ name, url, ... }] }  (JSON léger)
 *   2. Frontend crée un <a href=url download> pour chaque fichier
 *   3. Le navigateur télécharge directement depuis SharePoint
 *   → Zéro octet de données de fichier ne transite par Vercel ou Supabase
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canRead(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Récupérer toutes les pièces jointes du diagnostic (métadonnées uniquement)
    const admin = createAdminClient()
    const { data: attachments, error: dbErr } = await admin
      .from('iso26000_attachments')
      .select('id, name, sharepoint_item_id, mime, size, action_key, annexe_index')
      .eq('diagnostic_id', params.id)
      .order('annexe_index', { ascending: true, nullsFirst: false })

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    if (!attachments?.length) {
      return NextResponse.json({ data: [] })
    }

    // 2. Obtenir les URLs SharePoint directes en parallèle
    //    @microsoft.graph.downloadUrl = URL pré-authentifiée, valide ~1h
    //    Le fichier est téléchargé navigateur → SharePoint, sans passer par Vercel
    const results = await Promise.allSettled(
      (attachments as Attachment[]).map(async att => {
        const res = await spGraphForApp(
          'iso26000',
          `/items/${att.sharepoint_item_id}`,
        )
        if (!res.ok) {
          console.warn(`[annexes-urls] SP item not found: ${att.sharepoint_item_id}`)
          return null
        }
        const item = await res.json() as Record<string, unknown>
        const url = item['@microsoft.graph.downloadUrl'] as string | undefined
        if (!url) return null

        return {
          id: att.id,
          name: att.name,
          url,                       // URL directe SharePoint — téléchargement côté navigateur
          mime: att.mime,
          size: att.size,
          action_key: att.action_key,
          annexe_index: att.annexe_index,
        }
      }),
    )

    const data = results
      .filter((r): r is PromiseFulfilledResult<NonNullable<ReturnType<typeof Object.create>>> =>
        r.status === 'fulfilled' && r.value !== null,
      )
      .map(r => r.value)

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
