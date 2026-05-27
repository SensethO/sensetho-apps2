export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

// GET /api/agri/observations?plantation_id=xxx
export async function GET(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const plantationId = searchParams.get('plantation_id')
    if (!plantationId) return NextResponse.json({ error: 'plantation_id requis' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifie accès à la plantation
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: plantation } = await svc
        .from('plantations').select('user_id').eq('id', plantationId).single()
      const isOwner = plantation?.user_id === user.id
      if (!isOwner) {
        const { data: acces } = await svc
          .from('acces_acheteurs')
          .select('plantation_id')
          .eq('acheteur_user_id', user.id)
          .eq('plantation_id', plantationId)
          .maybeSingle()
        if (!acces) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    const { data: observations } = await svc
      .from('observations_meteo')
      .select('*')
      .eq('plantation_id', plantationId)
      .order('date', { ascending: false })
      .limit(500)

    return NextResponse.json({ observations: observations ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/agri/observations — upsert une observation météo
export async function POST(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createAdminClient()
    const body = await req.json()
    const { plantation_id, date, periode } = body

    if (!plantation_id || !date || !periode) {
      return NextResponse.json({ error: 'plantation_id, date et periode requis' }, { status: 400 })
    }

    // Vérifie droit d'écriture (owner ou admin)
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: plantation } = await svc
        .from('plantations').select('user_id').eq('id', plantation_id).single()
      if (plantation?.user_id !== user.id) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    const { error } = await svc
      .from('observations_meteo')
      .upsert(body, { onConflict: 'plantation_id,date,periode' })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
