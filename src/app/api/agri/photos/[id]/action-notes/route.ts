/**
 * GET /api/agri/photos/[id]/action-notes
 * Returns notes for a photo as { data: { notes: NoteSection[] } }
 *
 * Migration SQL (run once):
 *   ALTER TABLE photos_terrain ADD COLUMN IF NOT EXISTS notes_sections jsonb DEFAULT '[]';
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    const { data: photo, error } = await serviceClient
      .from('photos_terrain')
      .select('id, notes_sections')
      .eq('id', id)
      .single()

    if (error || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    const notesSections = photo.notes_sections ?? []
    return NextResponse.json({ data: { notes: notesSections } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
