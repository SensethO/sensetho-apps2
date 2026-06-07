import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/invitations
 * Retourne l'historique des invitations email pour une enquête (tracking complet)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Vérifier la propriété de la session
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    // Récupérer toutes les invitations pour cette enquête, triées par date décroissante
    const { data: invitations, error } = await admin
      .from('pp_survey_invitations')
      .select('tracking_id, email, sent_at, opened_at, clicked_at, responded_at')
      .eq('session_id', params.id)
      .eq('survey_id', params.surveyId)
      .order('sent_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: invitations ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
