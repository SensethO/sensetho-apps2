/**
 * PUT    /api/agri/photos/[id]/action-notes/[key]  → save notes sections
 * DELETE /api/agri/photos/[id]/action-notes/[key]  → clear notes (set to [])
 *
 * Migration SQL (run once):
 *   ALTER TABLE photos_terrain ADD COLUMN IF NOT EXISTS notes_sections jsonb DEFAULT '[]';
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; key: string }> }

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    // Verify photo exists and user has access
    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id')
      .eq('id', id)
      .single()

    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    const { data: plantation } = await serviceClient
      .from('plantations')
      .select('user_id')
      .eq('id', photo.plantation_id)
      .single()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation?.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { sections } = body
    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections[] requis' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from('photos_terrain')
      .update({ notes_sections: sections })
      .eq('id', id)
      .select('id, notes_sections')
      .single()

    if (updateErr) throw new Error(updateErr.message)
    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id')
      .eq('id', id)
      .single()

    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    const { data: plantation } = await serviceClient
      .from('plantations')
      .select('user_id')
      .eq('id', photo.plantation_id)
      .single()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation?.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from('photos_terrain')
      .update({ notes_sections: [] })
      .eq('id', id)
      .select('id, notes_sections')
      .single()

    if (updateErr) throw new Error(updateErr.message)
    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
