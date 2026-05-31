import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('ecovadis_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * POST /api/ecovadis/[id]/notes/upload-confirm
 * Body: { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex }
 * Stocke les métadonnées dans ecovadis_documents — le fichier est dans SharePoint.
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

    const admin = createAdminClient()
    const id = attachmentId ?? crypto.randomUUID()

    // Utilise ecovadis_documents avec critere_id = actionKey (stockage cohérent)
    const { data: row, error: dbErr } = await admin
      .from('ecovadis_documents')
      .insert({
        id,
        diagnostic_id: params.id,
        critere_id: actionKey ?? null,
        nom: name,
        type_doc: 'note',
        sp_item_id: spItemId,
        size: size ?? null,
        annexe_index: annexeIndex ?? null,
      })
      .select('id, nom, sp_item_id, size, annexe_index')
      .single()

    if (dbErr) {
      console.error('[ecovadis/notes/upload-confirm/db]', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    // Retourne le format attendu par GuidedActionNotePanel
    return NextResponse.json({
      data: {
        id: row?.id ?? id,
        name: row?.nom ?? name,
        sharepoint_item_id: row?.sp_item_id ?? spItemId,
        mime: mime ?? null,
        size: row?.size ?? size ?? null,
        annexe_index: row?.annexe_index ?? annexeIndex ?? null,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
