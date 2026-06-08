import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** PATCH /api/gestion-temps/time-entries/[id] */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: entry } = await admin.from('gt_time_entries').select('user_id').eq('id', params.id).single()
    if (!entry) return NextResponse.json({ error: 'Saisie introuvable' }, { status: 404 })
    if (entry.user_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const patch: Record<string, unknown> = {}
    if ('hours' in body) patch.hours = Number(body.hours)
    if ('date'  in body) patch.date  = body.date
    if ('note'  in body) patch.note  = body.note || null

    const { data, error } = await admin.from('gt_time_entries').update(patch).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/gestion-temps/time-entries/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: entry } = await admin.from('gt_time_entries').select('user_id').eq('id', params.id).single()
    if (!entry) return NextResponse.json({ error: 'Saisie introuvable' }, { status: 404 })
    if (entry.user_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    await admin.from('gt_time_entries').delete().eq('id', params.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
