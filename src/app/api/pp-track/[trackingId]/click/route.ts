import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pp-track/[trackingId]/click
 * Enregistre le clic sur le lien email et redirige vers la page de l'enquête
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  try {
    const admin = createAdminClient()

    // Récupère le token associé au tracking pour la redirection
    const { data: invite } = await admin
      .from('pp_survey_invitations')
      .select('token, clicked_at')
      .eq('tracking_id', params.trackingId)
      .maybeSingle()

    // Marque le clic
    if (invite && !invite.clicked_at) {
      await admin
        .from('pp_survey_invitations')
        .update({ clicked_at: new Date().toISOString() })
        .eq('tracking_id', params.trackingId)
    }

    if (!invite?.token) {
      return NextResponse.redirect(new URL('https://app.sensetho.fr'))
    }

    // Redirige vers la page publique de l'enquête avec le tracking_id en query
    const url = `https://app.sensetho.fr/enquete/${invite.token}?tid=${params.trackingId}`
    return NextResponse.redirect(url, { status: 302 })
  } catch {
    return NextResponse.redirect(new URL('https://app.sensetho.fr'))
  }
}
