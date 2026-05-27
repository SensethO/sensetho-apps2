/**
 * POST /api/agri/photos/upload-confirm
 *
 * Étape 3 du flux direct : reçoit le SharePoint item ID après upload direct client→SP,
 * insère l'enregistrement dans photos_terrain et retourne la photo créée.
 *
 * Body JSON : { spItemId, fileName, mime, size, plantation_id, observation_id?,
 *               date_prise, champ_id?, type_sujet?, produit?, commentaire?,
 *               latitude?, longitude? }
 * Retourne  : { photo }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json() as {
      spItemId: string; fileName: string; mime: string; size: number
      plantation_id: string; observation_id?: string; date_prise: string
      champ_id?: string; type_sujet?: string; produit?: string
      commentaire?: string; latitude?: string; longitude?: string
    }
    const { spItemId, fileName, plantation_id, date_prise } = body

    if (!spItemId)      return NextResponse.json({ error: 'spItemId manquant' }, { status: 400 })
    if (!fileName)      return NextResponse.json({ error: 'fileName manquant' }, { status: 400 })
    if (!plantation_id) return NextResponse.json({ error: 'plantation_id manquant' }, { status: 400 })
    if (!date_prise)    return NextResponse.json({ error: 'date_prise manquant' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifier accès plantation
    const { data: plantation } = await svc.from('plantations').select('id, user_id').eq('id', plantation_id).single()
    if (!plantation) return NextResponse.json({ error: 'Plantation introuvable' }, { status: 404 })

    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && plantation.user_id !== user.id)
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { data: photo, error: insertErr } = await svc
      .from('photos_terrain')
      .insert({
        plantation_id,
        champ_id:       body.champ_id       || null,
        date_prise,
        url_sharepoint: spItemId,
        filename:       fileName,
        type_sujet:     body.type_sujet     || null,
        produit:        body.produit        || null,
        commentaire:    body.commentaire    || null,
        latitude:       body.latitude ? parseFloat(body.latitude) : null,
        longitude:      body.longitude ? parseFloat(body.longitude) : null,
        observation_id: body.observation_id || null,
      })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json({ photo })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
