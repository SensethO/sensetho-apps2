import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, diagId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('green_claims_diagnostics').select('user_id').eq('id', diagId).single()
  return data?.user_id === userId
}

// Score computation (mirrors client-side logic)
function computeScore(a: Record<string, string | boolean | null>): number {
  let score = 0
  const ev: Record<string, number> = { 'acv-complete': 30, 'mesure-directe': 25, 'certification-reconnue': 20, 'declaration-fournisseur': 10, aucune: 0 }
  score += ev[String(a.evidence_method)] ?? 0
  if (a.third_party_verified === 'oui') score += 20
  else if (a.third_party_verified === 'nsp') score += 5
  if (a.scope_clear === 'claire') score += 20
  else if (a.scope_clear === 'nsp') score += 5
  if (a.no_compensation_only === 'correct') score += 20
  else if (a.no_compensation_only === 'nsp') score += 5
  if (a.no_hidden_impact === 'transparent') score += 10
  else if (a.no_hidden_impact === 'nsp') score += 3
  if (a.type === 'generique') score = Math.max(0, score - 20)
  if (a.type === 'label-certification' && a.evidence_method === 'certification-reconnue') score = Math.min(100, score + 10)
  return Math.min(100, score)
}

function getStatus(score: number) {
  if (score >= 75) return 'conforme'
  if (score >= 40) return 'risque'
  return 'non-conforme'
}

async function updateDiagStats(diagId: string) {
  const admin = createAdminClient()
  const { data: allegations } = await admin.from('green_claims_allegations').select('*').eq('diagnostic_id', diagId)
  const all = allegations ?? []
  const scores = all.map(a => computeScore(a as Record<string, string | boolean | null>))
  const statuts = scores.map(getStatus)
  await admin.from('green_claims_diagnostics').update({
    nb_total: all.length,
    nb_conformes: statuts.filter(s => s === 'conforme').length,
    nb_risque: statuts.filter(s => s === 'risque').length,
    nb_non_conformes: statuts.filter(s => s === 'non-conforme').length,
    score_global: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', diagId)
}

/** GET /api/green-claims/[id]/allegations */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin.from('green_claims_allegations').select('*').eq('diagnostic_id', params.id).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/green-claims/[id]/allegations — créer */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    if (!body.allegation_text) return NextResponse.json({ error: 'allegation_text requis' }, { status: 400 })

    // Récupérer org_id depuis le diagnostic
    const admin = createAdminClient()
    const { data: diag } = await admin.from('green_claims_diagnostics').select('org_id, annee').eq('id', params.id).single()

    const { data, error } = await admin.from('green_claims_allegations').insert({
      diagnostic_id: params.id,
      user_id: user.id,
      org_id: diag?.org_id,
      year: diag?.annee,
      allegation_text: body.allegation_text,
      type: body.type ?? 'explicite',
      domain: body.domain ?? 'general',
      scope: body.scope ?? 'produit-entier',
      evidence_method: body.evidence_method ?? 'aucune',
      third_party_verified: body.third_party_verified ?? 'nsp',
      scope_clear: body.scope_clear ?? 'nsp',
      no_compensation_only: body.no_compensation_only ?? 'nsp',
      no_hidden_impact: body.no_hidden_impact ?? 'nsp',
      is_comparative: body.is_comparative ?? false,
      notes: body.notes ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await updateDiagStats(params.id)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT /api/green-claims/[id]/allegations — mettre à jour (body.allegation_id) */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    if (!body.allegation_id) return NextResponse.json({ error: 'allegation_id requis' }, { status: 400 })

    const { allegation_id, ...fields } = body
    const allowed = ['allegation_text', 'type', 'domain', 'scope', 'evidence_method', 'third_party_verified', 'scope_clear', 'no_compensation_only', 'no_hidden_impact', 'is_comparative', 'notes']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) { if (k in fields) update[k] = fields[k] }

    const admin = createAdminClient()
    const { data, error } = await admin.from('green_claims_allegations').update(update).eq('id', allegation_id).eq('diagnostic_id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await updateDiagStats(params.id)
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/green-claims/[id]/allegations?allegation_id= */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allegation_id = new URL(req.url).searchParams.get('allegation_id')
    if (!allegation_id) return NextResponse.json({ error: 'allegation_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('green_claims_allegations').delete().eq('id', allegation_id).eq('diagnostic_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await updateDiagStats(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
