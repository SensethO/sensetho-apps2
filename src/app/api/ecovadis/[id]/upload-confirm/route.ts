import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin
    .from('ecovadis_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * POST /api/ecovadis/[id]/upload-confirm
 * Body: { critere_id, attachmentId, spItemId, name, mime, size, type_doc, description, annexeIndex }
 * Stocke les métadonnées dans ecovadis_documents — aucun fichier ne transite par Vercel.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      critere_id?: string
      attachmentId?: string
      spItemId?: string
      name?: string
      mime?: string
      size?: number
      type_doc?: string
      description?: string
      annexeIndex?: number
    }

    const { critere_id, attachmentId, spItemId, name, mime, size, type_doc, description, annexeIndex } = body

    if (!spItemId) return NextResponse.json({ error: 'spItemId requis' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const admin = createAdminClient()
    const id = attachmentId ?? crypto.randomUUID()

    const { data: row, error: dbErr } = await admin
      .from('ecovadis_documents')
      .insert({
        id,
        diagnostic_id: params.id,
        critere_id: critere_id ?? null,
        nom: name,
        description: description ?? null,
        type_doc: type_doc ?? null,
        sp_item_id: spItemId,
        size: size ?? null,
        annexe_index: annexeIndex ?? null,
      })
      .select()
      .single()

    if (dbErr) {
      console.error('[ecovadis/upload-confirm/db]', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
