/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildSurveyInviteEmail } from '@/lib/msGraph'

export const dynamic = 'force-dynamic'

/** POST /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/invite
 *  Reçoit { emails, message? }, génère un token par email, enregistre en DB
 *  et envoie l'invitation par email via Microsoft Graph */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Vérifier propriété + récupérer les données de l'enquête
    const admin = createAdminClient()
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id, surveys, organisation')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Trouver l'enquête dans le JSONB
    const surveys: any[] = session.surveys ?? []
    const survey = surveys.find((s: any) => s.id === params.surveyId)
    if (!survey) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

    const body = await req.json() as { emails?: string[]; message?: string }
    const emails = body.emails ?? []
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array required' }, { status: 400 })
    }

    const sent: string[] = []
    const failed: string[] = []
    const emailErrors: string[] = []

    for (const email of emails) {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed || !trimmed.includes('@')) { failed.push(email); continue }

      try {
        // Token individuel (UUID) pour la page enquête
        const token = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        // Enregistrement dans pp_survey_invitations avec tracking_id auto-généré
        const { data: inviteRow, error: inviteErr } = await admin
          .from('pp_survey_invitations')
          .insert({
            session_id: params.id,
            survey_id: params.surveyId,
            email: trimmed,
            token,
          })
          .select('tracking_id')
          .single()

        if (inviteErr || !inviteRow) { failed.push(email); continue }

        // Lien direct vers l'enquête (avec tracking_id en query param — pas de redirect opaque)
        // Évite d'être bloqué par les filtres antivirus/Safe Links des serveurs de messagerie
        const directUrl = `https://app.sensetho.fr/enquete/${token}?tid=${inviteRow.tracking_id}`

        // Envoi email (non bloquant — l'invite est enregistrée même si l'email échoue)
        try {
          const html = buildSurveyInviteEmail({
            surveyName: survey.name,
            sessionOrganisation: session.organisation ?? undefined,
            surveyUrl: directUrl,
            personalMessage: body.message ?? undefined,
            expiresAt,
          })
          await sendEmail(
            trimmed,
            `Invitation : ${survey.name} — Enquête de matérialité`,
            html,
            { fromName: "Sens'ethO Apps" }
          )
        } catch (emailErr) {
          console.error(`[invite] Email send failed for ${trimmed}:`, emailErr)
          emailErrors.push(trimmed)
        }

        sent.push(trimmed)
      } catch {
        failed.push(email)
      }
    }

    return NextResponse.json({
      data: {
        sent,
        failed,
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
        note: emailErrors.length > 0
          ? "Invitations enregistrées, mais certains emails n'ont pu être envoyés (vérifiez la permission Mail.Send dans Azure AD)"
          : undefined,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
