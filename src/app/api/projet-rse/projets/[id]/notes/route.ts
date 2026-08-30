// /api/projet-rse/projets/[id]/notes — Notes & documents de l’app
// « Plan Stratégique ». Sections Tiptap + métadonnées de pièces jointes en
// jsonb ; les fichiers eux-mêmes vivent dans SharePoint (jamais en base).
// Pattern marbre iso53001, garde requireProjet propre à l’app.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projet-rse/projets/[id]/notes[?action_key=xxx]
 * Retourne { data: { sections: Record<action_key, NoteSection[]>, notes: Record<action_key, string> } }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const admin = createAdminClient()
    let query = admin
      .from('projet_rse_notes')
      .select('action_key, content, sections')
      .eq('projet_id', params.id)
    const actionKey = req.nextUrl.searchParams.get('action_key')
    if (actionKey) query = query.eq('action_key', actionKey)

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const sections: Record<string, unknown[]> = {}
    const notes: Record<string, string> = {}
    for (const row of (rows ?? [])) {
      if (row.sections) sections[row.action_key] = row.sections
      if (row.content)  notes[row.action_key]   = row.content
    }

    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT /api/projet-rse/projets/[id]/notes
 * Body: { action_key: string, sections?: NoteSection[], content?: string }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard

    const body = await req.json() as { action_key?: string; sections?: unknown[]; content?: string }
    const { action_key, sections, content } = body
    if (!action_key) return NextResponse.json({ error: 'action_key requis' }, { status: 400 })

    const admin = createAdminClient()
    const upsertRow: Record<string, unknown> = {
      projet_id: params.id,
      action_key,
      updated_at: new Date().toISOString(),
    }
    if (sections !== undefined) upsertRow.sections = sections
    if (content  !== undefined) upsertRow.content  = content

    const { error } = await admin
      .from('projet_rse_notes')
      .upsert(upsertRow, { onConflict: 'projet_id,action_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
