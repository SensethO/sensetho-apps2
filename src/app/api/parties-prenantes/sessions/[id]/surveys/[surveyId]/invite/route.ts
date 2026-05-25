import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** POST /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/invite
 *  Reçoit { emails, message? }, stocke les invitations en DB (sans envoi réel) */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Vérifier propriété de la session
    const admin = createAdminClient()
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { emails?: string[]; message?: string }
    const emails = body.emails ?? []
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array required' }, { status: 400 })
    }

    const sent: string[] = []
    const failed: string[] = []

    for (const email of emails) {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) { failed.push(email); continue }
      try {
        const token = crypto.randomUUID()
        await admin.from('pp_survey_invites').insert({
          session_id: params.id,
          survey_id: params.surveyId,
          email: trimmed,
          token,
        })
        sent.push(trimmed)
      } catch {
        failed.push(email)
      }
    }

    return NextResponse.json({ data: { sent, failed } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
