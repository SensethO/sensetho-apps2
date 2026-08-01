/**
 * GET /api/admin/uptime — vérifie l'état (uptime) des sites Sens'ethO.
 * Admin uniquement. Lecture seule : requêtes HTTP GET côté serveur, aucun secret.
 */
import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const TARGETS: { url: string; label: string; project: string }[] = [
  { url: 'https://apps.sensetho.com/',          label: 'Plateforme (accueil)',   project: 'sensetho-apps2' },
  { url: 'https://apps.sensetho.com/catalogue', label: 'Catalogue',              project: 'sensetho-apps2' },
  { url: 'https://www.sensetho.com/',           label: 'Vitrine',                project: 'sensetho-vitrine' },
  { url: 'https://app.sensetho.fr/',            label: 'Ancienne plateforme',    project: 'sensetho-apps' },
]

async function check(target: { url: string; label: string; project: string }) {
  const started = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12_000)
    const res = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'Sensetho-Uptime/1.0' },
    })
    clearTimeout(timer)
    return { ...target, status: res.status, ok: res.ok, ms: Date.now() - started, error: null as string | null }
  } catch (e) {
    return { ...target, status: 0, ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET() {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const results = await Promise.all(TARGETS.map(check))
    const allOk = results.every(r => r.ok)

    return NextResponse.json({ checkedAt: new Date().toISOString(), allOk, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
