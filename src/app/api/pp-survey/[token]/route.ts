/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─── GET — charge les données du questionnaire (public, sans auth) ─────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

    const admin = createAdminClient()

    // 1. Cherche dans pp_survey_tokens (share links)
    const { data: shareToken } = await admin
      .from('pp_survey_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (shareToken) {
      if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Ce lien a expiré.' }, { status: 410 })
      }

      const { data: session } = await admin
        .from('pp_sessions')
        .select('surveys, organisation, name, stakeholders')
        .eq('id', shareToken.session_id)
        .single()

      if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

      const surveys: any[] = session.surveys ?? []
      const survey = surveys.find((s: any) => s.id === shareToken.survey_id)
      if (!survey) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

      // Filtrer les parties prenantes ciblées (si spécifié dans l'enquête)
      const stakeholders = (session.stakeholders ?? []) as any[]
      const targetSH = survey.stakeholder_ids?.length
        ? stakeholders.filter((s: any) => survey.stakeholder_ids.includes(s.id))
        : stakeholders

      return NextResponse.json({
        data: {
          tokenType: 'share',
          token,
          sessionId: shareToken.session_id,
          surveyId: shareToken.survey_id,
          surveyName: survey.name,
          surveyDescription: survey.description ?? null,
          surveyType: survey.type ?? 'double',
          isAnonymous: shareToken.anonymous,
          sessionOrganisation: session.organisation ?? null,
          sessionName: session.name,
          prefillEmail: null,
          prefillName: null,
          questions: survey.questions ?? [],
          stakeholders: shareToken.anonymous ? [] : targetSH.map((s: any) => ({ id: s.id, name: s.name, organisation: s.organisation })),
        },
      })
    }

    // 2. Cherche dans pp_survey_invitations (invites individuelles)
    const { data: invite } = await admin
      .from('pp_survey_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (invite) {
      // Marquer comme cliqué si pas encore fait
      if (!invite.clicked_at) {
        await admin
          .from('pp_survey_invitations')
          .update({ clicked_at: new Date().toISOString() })
          .eq('id', invite.id)
      }

      const { data: session } = await admin
        .from('pp_sessions')
        .select('surveys, organisation, name, stakeholders')
        .eq('id', invite.session_id)
        .single()

      if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

      const surveys: any[] = session.surveys ?? []
      const survey = surveys.find((s: any) => s.id === invite.survey_id)
      if (!survey) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

      // Trouver la partie prenante par email dans la session
      const stakeholders = (session.stakeholders ?? []) as any[]
      const matchedSH = stakeholders.find((s: any) => s.email?.toLowerCase() === invite.email?.toLowerCase())

      return NextResponse.json({
        data: {
          tokenType: 'invite',
          token,
          trackingId: invite.tracking_id,
          sessionId: invite.session_id,
          surveyId: invite.survey_id,
          surveyName: survey.name,
          surveyDescription: survey.description ?? null,
          surveyType: survey.type ?? 'double',
          isAnonymous: false,
          sessionOrganisation: session.organisation ?? null,
          sessionName: session.name,
          prefillEmail: invite.email ?? null,
          prefillName: matchedSH?.name ?? null,
          prefillStakeholderId: matchedSH?.id ?? null,
          questions: survey.questions ?? [],
          stakeholders: [],
        },
      })
    }

    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST — soumettre les réponses (public, sans auth) ────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await req.json() as {
      sessionId: string
      surveyId: string
      respondentName: string
      respondentEmail?: string
      stakeholderId?: string
      trackingId?: string
      answers: Record<string, number>
    }

    if (!body.sessionId || !body.surveyId || !body.respondentName) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Valider le token (share ou invite)
    const isShareToken = await admin
      .from('pp_survey_tokens')
      .select('id, anonymous')
      .eq('token', token)
      .eq('session_id', body.sessionId)
      .eq('survey_id', body.surveyId)
      .maybeSingle()
      .then(r => !!r.data)

    const inviteRow = isShareToken ? null : await admin
      .from('pp_survey_invitations')
      .select('id, responded_at')
      .eq('token', token)
      .eq('session_id', body.sessionId)
      .eq('survey_id', body.surveyId)
      .maybeSingle()
      .then(r => r.data)

    if (!isShareToken && !inviteRow) {
      return NextResponse.json({ error: 'Token invalide pour ce questionnaire' }, { status: 403 })
    }

    // Charger la session
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id, surveys')
      .eq('id', body.sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    const surveys: any[] = session.surveys ?? []
    const surveyIndex = surveys.findIndex((s: any) => s.id === body.surveyId)
    if (surveyIndex === -1) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

    const survey = surveys[surveyIndex]
    const now = new Date().toISOString()

    // Déduplication : si stakeholder_id connu, remplacer la réponse existante
    const stakeholderId = body.stakeholderId ?? body.respondentEmail ?? `anon-${token.slice(0, 8)}-${Date.now()}`
    const existingResponses: any[] = survey.responses ?? []
    const existingIdx = body.stakeholderId
      ? existingResponses.findIndex((r: any) => r.stakeholder_id === body.stakeholderId)
      : -1

    const newResponse = {
      stakeholder_id: stakeholderId,
      stakeholder_name: body.respondentName,
      answers: body.answers,
      completed_at: now,
    }

    let updatedResponses: any[]
    if (existingIdx >= 0) {
      // Mise à jour (même répondant)
      updatedResponses = [...existingResponses]
      updatedResponses[existingIdx] = newResponse
    } else {
      // Nouvelle réponse
      updatedResponses = [...existingResponses, newResponse]
    }

    const updatedSurveys = [...surveys]
    updatedSurveys[surveyIndex] = { ...survey, responses: updatedResponses }

    const { error: updateError } = await admin
      .from('pp_sessions')
      .update({ surveys: updatedSurveys, updated_at: now })
      .eq('id', body.sessionId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Marquer l'invitation comme répondue
    if (inviteRow && !inviteRow.responded_at) {
      await admin
        .from('pp_survey_invitations')
        .update({ responded_at: now })
        .eq('id', inviteRow.id)
    }

    // Marquer le tracking si fourni
    if (body.trackingId) {
      await admin
        .from('pp_survey_invitations')
        .update({ responded_at: now })
        .eq('tracking_id', body.trackingId)
        .is('responded_at', null)
    }

    return NextResponse.json({ ok: true, updated: existingIdx >= 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
