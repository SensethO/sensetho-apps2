/**
 * GET  /api/agri/analyses?plantation_id=xxx
 *      Retourne la dernière analyse IA sauvegardée pour une plantation.
 *
 * POST /api/agri/analyses
 *      Corps: { plantation_id, plantation_nom, analyse, existing_id? }
 *      Upsert dans saved_simulations (app_id='agri-analyse', name=plantation_id).
 *      Retourne { id, created_at }.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

const APP_ID = 'agri-analyse'

// GET /api/agri/analyses?plantation_id=xxx
export async function GET(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const plantationId = searchParams.get('plantation_id')
    if (!plantationId) return NextResponse.json({ error: 'plantation_id requis' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifier accès à la plantation (owner, admin ou acheteur autorisé)
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

    // Récupérer la dernière analyse pour cette plantation
    const { data: row } = await svc
      .from('saved_simulations')
      .select('id, data, created_at, updated_at')
      .eq('app_id', APP_ID)
      .eq('name', plantationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row) return NextResponse.json({ analyse: null })

    // data JSONB contient { plantation_id, plantation_nom, analyse }
    const payload = row.data as { analyse?: unknown } | null
    return NextResponse.json({
      id: row.id,
      analyse: payload?.analyse ?? null,
      created_at: row.updated_at ?? row.created_at,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/agri/analyses
export async function POST(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plantation_id, plantation_nom, analyse, existing_id } = await req.json()
    if (!plantation_id || !analyse) {
      return NextResponse.json({ error: 'plantation_id et analyse requis' }, { status: 400 })
    }

    const svc = createAdminClient()

    // Vérifier que l'utilisateur a accès à cette plantation (owner ou admin)
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: plantation } = await svc
        .from('plantations').select('user_id').eq('id', plantation_id).single()
      if (plantation?.user_id !== user.id) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    const now = new Date().toISOString()
    const payload = { plantation_id, plantation_nom, analyse }

    let id: string | null = null

    if (existing_id) {
      // Mise à jour
      const { data: row, error } = await svc
        .from('saved_simulations')
        .update({ data: payload, updated_at: now })
        .eq('id', existing_id)
        .select('id, updated_at')
        .single()
      if (error) throw new Error(error.message)
      id = row?.id ?? null
      return NextResponse.json({ id, created_at: row?.updated_at ?? now })
    } else {
      // Insertion — ou mise à jour si une entrée existe déjà pour cette plantation
      const { data: existing } = await svc
        .from('saved_simulations')
        .select('id')
        .eq('app_id', APP_ID)
        .eq('name', plantation_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing?.id) {
        // Mettre à jour l'existant
        const { data: row, error } = await svc
          .from('saved_simulations')
          .update({ data: payload, updated_at: now })
          .eq('id', existing.id)
          .select('id, updated_at')
          .single()
        if (error) throw new Error(error.message)
        id = row?.id ?? null
        return NextResponse.json({ id, created_at: row?.updated_at ?? now })
      } else {
        // Nouvelle entrée
        const { data: row, error } = await svc
          .from('saved_simulations')
          .insert({
            app_id: APP_ID,
            user_id: user.id,
            name: plantation_id,
            year: new Date().getFullYear(),
            data: payload,
          })
          .select('id, created_at')
          .single()
        if (error) throw new Error(error.message)
        id = row?.id ?? null
        return NextResponse.json({ id, created_at: row?.created_at ?? now })
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
