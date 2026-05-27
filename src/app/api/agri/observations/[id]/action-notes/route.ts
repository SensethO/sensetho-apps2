/**
 * GET /api/agri/observations/[id]/action-notes
 * Returns notes for an observation as { data: { notes: NoteSection[] } }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id: observationId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const svc = createAdminClient()
    const { data: row } = await svc
      .from('agri_observation_notes')
      .select('notes_sections')
      .eq('observation_id', observationId)
      .maybeSingle()

    return NextResponse.json({ data: { notes: row?.notes_sections ?? [] } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
