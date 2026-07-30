import { NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { backupDatabaseToSharepoint } from '@/lib/backupToSharepoint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // l'export parcourt toutes les tables

/** POST — déclenche un export de sauvegarde de la base vers SharePoint (admin uniquement). */
export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const { data: { user } } = await createUserClient().auth.getUser()
    const report = await backupDatabaseToSharepoint(user?.email ?? null)
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error).message ?? err) }, { status: 500 })
  }
}
