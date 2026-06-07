/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─── GET — récupère les infos du questionnaire via token (invite ou share) ─────

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

    const admin = createAdminClient()

    // 1. Cherche d'abord dans pp_survey_invites (token individuel)
    const { data: invite } = await admin
      .from('pp_survey_invites')
      .select('session_id, survey_id, email, token_expires_at')
      .eq('token', token)
      .maybeSingle()

    if (invite) {
      // Vérifie l'expiration si présente
      if (invite.token_expires_at && new Date(invite.token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'Ce lien a expiré.' }, { status: 410 })
      }

      // Charge la session pour extraire l'enquête
      const { data: session } = await admin
        .from('pp_sessions')
        .select('surveys, organisation, name, materiality_type')
        .eq('id', invite.session_id)
        .single()

      if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

      const surveys: any[] = session.surveys ?? []
      const survey = surveys.find((s: any) => s.id === invite.survey_id)
      if (!survey) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

      // Marquer comme cliqué si pas encore fait
      await admin
        .from('pp_survey_invites')
        .update({ clicked_at: new Date().toISOString() })
        .eq('token', token)
        .is('clicked_at', null)

      return NextResponse.json({
        data: {
          tokenType: 'invite',
          token,
          sessionId: invite.session_id,
          surveyId: invite.survey_id,
          surveyName: survey.name,
          surveyDescription: survey.description ?? null,
          surveyType: survey.type ?? 'double',
          isAnonymous: survey.is_anonymous ?? false,
          sessionOrganisation: session.organisation ?? null,
          sessionName: session.name,
          prefillEmail: invite.email ?? null,
          questions: survey.questions ?? [],
        },
      })
    }

    // 2. Sinon cherche dans les surveys JSONB (share_token générique)
    // On doit scanner tous les pp_sessions qui ont un survey avec ce share_token.
    // Utilise une requête Postgres via la fonction jsonb_path_query_array (non dispo en PostgREST simple)
    // On fait un filtre .contains sur JSONB en passant par admin client raw:
    // SELECT id, surveys, organisation, name FROM pp_sessions WHERE surveys @> '[{"share_token":"<token>"}]'
    const { data: sessionRows } = await admin.rpc('find_session_by_share_token', { p_token: token }).single()

    if (!sessionRows) {
      // Fallback: scan (moins efficace mais fiable sans RPC)
      // Fetche les sessions récentes et filtre côté serveur
      const { data: allSessions } = await admin
        .from('pp_sessions')
        .select('id, surveys, organisation, name, materiality_type')
        .order('updated_at', { ascending: false })
        .limit(200)

      let foundSession: any = null
      let foundSurvey: any = null

      for (const s of allSessions ?? []) {
        const surveys: any[] = s.surveys ?? []
        const match = surveys.find(
          (sv: any) => sv.share_token === token && sv.status !== 'archivé'
        )
        if (match) {
          // Vérifie expiration
          if (match.token_expires_at && new Date(match.token_expires_at) < new Date()) {
            return NextResponse.json({ error: 'Ce lien de partage a expiré.' }, { status: 410 })
          }
          foundSession = s
          foundSurvey = match
          break
        }
      }

      if (!foundSession || !foundSurvey) {
        return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 404 })
      }

      return NextResponse.json({
        data: {
          tokenType: 'share',
          token,
          sessionId: foundSession.id,
          surveyId: foundSurvey.id,
          surveyName: foundSurvey.name,
          surveyDescription: foundSurvey.description ?? null,
          surveyType: foundSurvey.type ?? 'double',
          isAnonymous: foundSurvey.is_anonymous ?? false,
          sessionOrganisation: foundSession.organisation ?? null,
          sessionName: foundSession.name,
          prefillEmail: null,
          questions: foundSurvey.questions ?? [],
        },
      })
    }

    // Si RPC disponible (cas idéal) — même retour structuré
    return NextResponse.json({ data: sessionRows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST — soumettre une réponse ──────────────────────────────────────────────

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
      answers: Record<string, number>
    }

    if (!body.sessionId || !body.surveyId || !body.respondentName) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Charge la session
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id, surveys, user_id')
      .eq('id', body.sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    const surveys: any[] = session.surveys ?? []
    const surveyIndex = surveys.findIndex((s: any) => s.id === body.surveyId)
    if (surveyIndex === -1) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

    const survey = surveys[surveyIndex]

    // Vérifie que le token donne bien accès à ce questionnaire
    const isShareToken = survey.share_token === token
    const isInviteToken = !isShareToken && await (async () => {
      const { data: inv } = await admin
        .from('pp_survey_invites')
        .select('id, token_expires_at')
        .eq('token', token)
        .eq('session_id', body.sessionId)
        .eq('survey_id', body.surveyId)
        .maybeSingle()
      return !!inv
    })()

    if (!isShareToken && !isInviteToken) {
      return NextResponse.json({ error: 'Token invalide pour ce questionnaire' }, { status: 403 })
    }

    // Construit la réponse
    const now = new Date().toISOString()
    const newResponse = {
      stakeholder_id: body.respondentEmail ?? `anon-${token.slice(0, 8)}`,
      stakeholder_name: body.respondentName,
      answers: body.answers,
      completed_at: now,
    }

    // Ajoute la réponse au tableau des réponses de l'enquête
    const updatedSurveys = [...surveys]
    updatedSurveys[surveyIndex] = {
      ...survey,
      responses: [...(survey.responses ?? []), newResponse],
    }

    // Calcule les scores de matérialité (simplifiés — sera recalculé côté client aussi)
    const { error: updateError } = await admin
      .from('pp_sessions')
      .update({ surveys: updatedSurveys, updated_at: now })
      .eq('id', body.sessionId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Marque l'invite comme complétée
    if (isInviteToken) {
      await admin
        .from('pp_survey_invites')
        .update({ completed_at: now })
        .eq('token', token)
        .is('completed_at', null)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
