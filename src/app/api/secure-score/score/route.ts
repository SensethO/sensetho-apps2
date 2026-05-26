import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Obtenir un token OAuth2 via client credentials
async function getToken(tenantId: string, clientId: string, clientSecret: string, scope: string) {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Auth échouée: ${err}`)
  }
  const json = await res.json()
  return json.access_token as string
}

// POST — lire le Secure Score d'un tenant
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tenantDbId } = await request.json() as { tenantDbId: string }

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('m365_tenants')
    .select('*')
    .eq('id', tenantDbId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  if (!tenant.client_secret) return NextResponse.json({ error: 'Client secret manquant' }, { status: 400 })

  try {
    const token = await getToken(
      tenant.tenant_id,
      tenant.client_id,
      tenant.client_secret,
      'https://graph.microsoft.com/.default'
    )

    const res = await fetch(
      'https://graph.microsoft.com/v1.0/security/secureScores?$top=1',
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Graph API: ${err}`)
    }

    const json = await res.json()
    const ss = json.value?.[0]
    if (!ss) throw new Error('Aucun score retourné')

    // Analyser gel du pipeline
    const controls: Array<{ controlName: string; lastSynced: string }> = ss.controlScores ?? []
    const dates = controls
      .map(c => new Date(c.lastSynced).toISOString().slice(0, 10))
      .filter(Boolean)
    const uniqueDates = Array.from(new Set(dates)).sort()
    const oldest = uniqueDates[0]
    const daysOld = oldest
      ? Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000)
      : 0
    const frozenSince = daysOld > 30 ? oldest : null

    // Mettre à jour le cache dans la DB
    await admin.from('m365_tenants').update({
      last_score: ss.currentScore,
      last_max_score: ss.maxScore,
      last_status: frozenSince ? 'frozen' : 'ok',
      last_run_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', tenantDbId)

    return NextResponse.json({
      score: ss.currentScore,
      maxScore: ss.maxScore,
      createdDateTime: ss.createdDateTime,
      frozenSince,
      daysOld,
      controlsByDate: uniqueDates.map(d => ({
        date: d,
        count: dates.filter(x => x === d).length,
        daysAgo: Math.floor((Date.now() - new Date(d).getTime()) / 86400000),
      })).sort((a, b) => b.date.localeCompare(a.date)),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    await admin.from('m365_tenants').update({
      last_status: 'error',
      updated_at: new Date().toISOString(),
    }).eq('id', tenantDbId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
