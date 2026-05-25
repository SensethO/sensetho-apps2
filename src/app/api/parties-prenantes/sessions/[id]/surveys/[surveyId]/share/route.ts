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
 *  Génère un token de partage valide 30 jours */
export async function POST(
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

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    surveys[surveyIndex] = {
      ...surveys[surveyIndex],
      share_token: token,
      token_expires_at: expiresAt,
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('pp_sessions')
      .update({ surveys })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    surveys[surveyIndex] = {
      ...surveys[surveyIndex],
      share_token: null,
      token_expires_at: null,
    }

    const admin = createAdminClient()
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
