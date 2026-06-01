/**
 * POST /api/logs/duration
 * Body: { id: string, duration_seconds: number }
 *
 * Met à jour la durée d'une entrée de log existante.
 * Appelé via navigator.sendBeacon() — supporte POST uniquement.
 * Pas d'auth requise (ID opaque = protection suffisante).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string; duration_seconds?: number }
    const { id, duration_seconds } = body

    if (!id || typeof duration_seconds !== 'number' || duration_seconds < 0) {
      return NextResponse.json({ ok: false })
    }

    // Limiter à des durées raisonnables (max 8h)
    const clampedDuration = Math.min(Math.round(duration_seconds), 8 * 3600)
    if (clampedDuration < 1) return NextResponse.json({ ok: true })

    const admin = createAdminClient()
    await admin
      .from('app_logs')
      .update({ duration_seconds: clampedDuration })
      .eq('id', id)
      // Sécurité : ne mettre à jour que si duration_seconds est encore NULL
      // (évite qu'un rechargement réinitialise la durée)
      .is('duration_seconds', null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Silencieux
  }
}
