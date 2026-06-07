import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pp-track/[trackingId]
 * Pixel de tracking — marque l'email comme ouvert, retourne un pixel GIF transparent
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  try {
    const admin = createAdminClient()
    await admin
      .from('pp_survey_invitations')
      .update({ opened_at: new Date().toISOString() })
      .eq('tracking_id', params.trackingId)
      .is('opened_at', null)
  } catch {
    // Silencieux — ne pas bloquer l'affichage de l'email
  }

  // Pixel GIF 1x1 transparent
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  )
  return new NextResponse(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}

/**
 * PATCH /api/pp-track/[trackingId]
 * Marque le clic sur le lien email (appelé côté client depuis /enquete/[token])
 * Approche compatible antivirus : pas de redirect opaque, le client fait lui-même l'appel
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  try {
    const admin = createAdminClient()
    await admin
      .from('pp_survey_invitations')
      .update({ clicked_at: new Date().toISOString() })
      .eq('tracking_id', params.trackingId)
      .is('clicked_at', null)
  } catch {
    // Silencieux — le tracking ne doit pas bloquer l'affichage du questionnaire
  }

  return new NextResponse(null, { status: 204 })
}
