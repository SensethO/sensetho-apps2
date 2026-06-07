import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Survey } from '@/types/parties-prenantes'

export const dynamic = 'force-dynamic'

async function getOwnedSession(sessionId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('pp_sessions')
    .select('id, surveys')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()
  return data
}

/** POST /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/share
 *  Génère un token de partage dans pp_survey_tokens (table dédiée, RLS public SELECT)
 *  et stocke aussi le token dans le JSONB pour affichage dans l'UI */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await getOwnedSession(params.id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const surveys = (session.surveys ?? []) as Survey[]
    const surveyIndex = surveys.findIndex((s) => s.id === params.surveyId)
    if (surveyIndex === -1) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

    // Lire les options de la requête (anonymous ?)
    let isAnonymous = surveys[surveyIndex].anonymous ?? false
    try { const b = await req.json(); isAnonymous = b.anonymous ?? isAnonymous } catch { /* pas de body */ }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const admin = createAdminClient()

    // Supprimer l'ancien token s'il existait déjà
    if (surveys[surveyIndex].share_token) {
      await admin
        .from('pp_survey_tokens')
        .delete()
        .eq('token', surveys[surveyIndex].share_token!)
    }

    // Créer le token dans la table dédiée (token généré par Postgres : hex 32 bytes)
    const { data: tokenRow, error: tokenError } = await admin
      .from('pp_survey_tokens')
      .insert({
        session_id: params.id,
        survey_id: params.surveyId,
        anonymous: isAnonymous,
        expires_at: expiresAt,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: tokenError?.message ?? 'Erreur création token' }, { status: 500 })
    }

    const token = tokenRow.token

    // Mettre à jour aussi le JSONB pour affichage dans l'UI
    surveys[surveyIndex] = {
      ...surveys[surveyIndex],
      share_token: token,
      token_expires_at: expiresAt,
    }

    await admin
      .from('pp_sessions')
      .update({ surveys })
      .eq('id', params.id)
      .eq('user_id', user.id)

    const url = `https://app.sensetho.fr/enquete/${token}`
    return NextResponse.json({ data: { token, url, expires_at: expiresAt } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/share
 *  Révoque le token de partage */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session = await getOwnedSession(params.id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const surveys = (session.surveys ?? []) as Survey[]
    const surveyIndex = surveys.findIndex((s) => s.id === params.surveyId)
    if (surveyIndex === -1) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

    const admin = createAdminClient()

    // Supprimer le token de la table dédiée
    if (surveys[surveyIndex].share_token) {
      await admin
        .from('pp_survey_tokens')
        .delete()
        .eq('token', surveys[surveyIndex].share_token!)
    }

    // Nettoyer le JSONB
    surveys[surveyIndex] = {
      ...surveys[surveyIndex],
      share_token: null,
      token_expires_at: null,
    }

    const { error } = await admin
      .from('pp_sessions')
      .update({ surveys })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
