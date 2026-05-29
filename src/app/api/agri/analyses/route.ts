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
    // On utilise created_at pour l'ordre (toujours présent, pas besoin de updated_at)
    const { data: row, error: fetchErr } = await svc
      .from('saved_simulations')
      .select('id, data, created_at')
      .eq('app_id', APP_ID)
      .eq('name', plantationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchErr) {
      console.error('[analyses GET] DB error:', fetchErr.message)
      return NextResponse.json({ analyse: null })
    }

    if (!row) return NextResponse.json({ analyse: null })

    // data JSONB contient { plantation_id, plantation_nom, analyse }
    const payload = row.data as { analyse?: unknown } | null
    return NextResponse.json({
      id: row.id,
      analyse: payload?.analyse ?? null,
      created_at: row.created_at,
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

    const payload = { plantation_id, plantation_nom, analyse }

    // Chercher un enregistrement existant par (app_id, name) — sans filtre user_id
    // pour éviter les doublons quand admin et owner génèrent tous les deux
    const { data: existing, error: lookupErr } = await svc
      .from('saved_simulations')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('name', plantation_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lookupErr) {
      console.error('[analyses POST] lookup error:', lookupErr.message)
    }

    const targetId = existing_id ?? existing?.id ?? null

    if (targetId) {
      // Mettre à jour l'existant — utiliser data uniquement (pas updated_at si colonne absente)
      const { data: row, error } = await svc
        .from('saved_simulations')
        .update({ data: payload })
        .eq('id', targetId)
        .select('id, created_at')
        .single()
      if (error) {
        console.error('[analyses POST] update error:', error.message)
        throw new Error(error.message)
      }
      return NextResponse.json({ id: row?.id ?? targetId, created_at: row?.created_at })
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
      if (error) {
        console.error('[analyses POST] insert error:', error.message)
        throw new Error(error.message)
      }
      return NextResponse.json({ id: row?.id, created_at: row?.created_at })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
