export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

// GET /api/agri/champs?plantation_id=xxx — liste des champs d'une plantation
export async function GET(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const plantationId = searchParams.get('plantation_id')
    if (!plantationId) return NextResponse.json({ error: 'plantation_id requis' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifie que l'utilisateur a accès à cette plantation
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      // Vérifie ownership ou accès acheteur
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

    const { data: champs } = await svc
      .from('champs')
      .select('*')
      .eq('plantation_id', plantationId)
      .order('created_at')

    return NextResponse.json({ champs: champs ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/agri/champs — créer un nouveau champ
export async function POST(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createAdminClient()
    const body = await req.json()
    const { plantation_id, nom, produit_faostat, produit_code, variete, superficie_ha, coordonnees } = body

    if (!plantation_id || !nom || !produit_faostat) {
      return NextResponse.json({ error: 'plantation_id, nom et produit_faostat requis' }, { status: 400 })
    }

    // Vérifie que l'utilisateur a le droit d'écrire sur cette plantation
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: plantation } = await svc
        .from('plantations').select('user_id').eq('id', plantation_id).single()
      if (plantation?.user_id !== user.id) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    const { data: champ, error } = await svc
      .from('champs')
      .insert({
        plantation_id,
        nom,
        produit_faostat,
        produit_code: produit_code || null,
        variete: variete || null,
        superficie_ha: superficie_ha ?? null,
        coordonnees: coordonnees ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ champ })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
