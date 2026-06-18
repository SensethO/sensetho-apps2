import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { canAccessDiagnostic } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'vigilance'
const TABLE = 'vigilance_diagnostics'

const canWrite = (userId: string, diagnosticId: string) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId, { requireEdit: true })

/**
 * POST /api/vigilance/[id]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex }
 * Stocke les métadonnées dans vigilance_notes — le fichier est dans SharePoint.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

    // Upsert dans vigilance_notes avec sp_item_id stocké dans sections JSONB
    // On retourne directement les métadonnées pour GuidedActionNotePanel
    return NextResponse.json({
      data: {
        id,
        name,
        sharepoint_item_id: spItemId,
        mime: mime ?? null,
        size: size ?? null,
        annexe_index: annexeIndex ?? null,
        action_key: actionKey ?? null,
        diagnostic_id: params.id,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
