import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function canAccess(userId: string, diagId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('green_claims_diagnostics').select('user_id').eq('id', diagId).single()
  return data?.user_id === userId
}

const EV: Record<string, number> = { 'acv-complete': 30, 'mesure-directe': 25, 'certification-reconnue': 20, 'declaration-fournisseur': 10, aucune: 0 }
function computeScore(a: Record<string, string | boolean | null>): number {
  let s = EV[String(a.evidence_method)] ?? 0
  if (a.third_party_verified === 'oui') s += 20; else if (a.third_party_verified === 'nsp') s += 5
  if (a.scope_clear === 'claire') s += 20; else if (a.scope_clear === 'nsp') s += 5
  if (a.no_compensation_only === 'correct') s += 20; else if (a.no_compensation_only === 'nsp') s += 5
  if (a.no_hidden_impact === 'transparent') s += 10; else if (a.no_hidden_impact === 'nsp') s += 3
  if (a.type === 'generique') s = Math.max(0, s - 20)
  if (a.type === 'label-certification' && a.evidence_method === 'certification-reconnue') s = Math.min(100, s + 10)
  return Math.min(100, s)
}
const statutOf = (s: number) => (s >= 75 ? 'CONFORME' : s >= 40 ? 'À RISQUE' : 'NON CONFORME')

const TYPE_L: Record<string, string> = { explicite: 'Explicite', generique: 'Générique', comparative: 'Comparative', 'label-certification': 'Label/Certification' }
const EV_L: Record<string, string> = { 'acv-complete': 'ACV complète', 'mesure-directe': 'Mesure directe', 'certification-reconnue': 'Certification reconnue', 'declaration-fournisseur': 'Déclaration fournisseur', aucune: 'Aucune preuve' }

/** POST /api/green-claims/[id]/analyze — analyse IA du diagnostic (Directive UE 2024/825) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Analyse IA non configurée (clé absente).' }, { status: 503 })

    const admin = createAdminClient()
    const { data: diag } = await admin.from('green_claims_diagnostics').select('*, organisations(denomination)').eq('id', params.id).single()
    if (!diag) return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })

    const { data: allegationsRaw } = await admin.from('green_claims_allegations').select('*').eq('diagnostic_id', params.id).order('created_at')
    const allegations = allegationsRaw ?? []
    if (allegations.length === 0) return NextResponse.json({ error: 'Aucune allégation à analyser' }, { status: 400 })

    let force = false
    try { const b = await req.json(); force = b?.force === true } catch { /* body vide */ }

    // Cache : empreinte des allégations (id:score). Ignoré si colonnes IA absentes.
    const fingerprint = allegations.map((a) => `${a.id}:${computeScore(a as Record<string, string | boolean | null>)}`).sort().join('|')
    if (!force && diag.ai_analysis && diag.ai_fingerprint === fingerprint) {
      return NextResponse.json({ data: { ai_analysis: diag.ai_analysis, ai_generated_at: diag.ai_generated_at }, cached: true })
    }

    const org = (diag as Record<string, unknown>).organisations as Record<string, unknown> | null
    const orgName = (org?.denomination as string) ?? diag.titre ?? 'cette organisation'
    let nc = 0, ar = 0
    const lines = allegations.map((a, i) => {
      const sc = computeScore(a as Record<string, string | boolean | null>)
      const st = statutOf(sc)
      if (st === 'NON CONFORME') nc++
      else if (st === 'À RISQUE') ar++
      return `${i + 1}. "${a.allegation_text}" — Type: ${TYPE_L[a.type] ?? a.type}, Domaine: ${a.domain}, Score: ${sc}/100 (${st}), Preuve: ${EV_L[a.evidence_method] ?? a.evidence_method}, Vérification tierce: ${a.third_party_verified}`
    }).join('\n')

    const prompt = `Tu es un expert juridique spécialisé dans la Directive Green Claims de l'Union Européenne (Directive 2024/825/EU et proposition COM/2023/0166).

Analyse les allégations environnementales suivantes de "${orgName}" :

${lines}

Résumé : ${allegations.length} allégations dont ${nc} non conformes et ${ar} à risque.

Fournis une analyse structurée en 4 parties :
1. **Synthèse** (2-3 phrases sur l'état général de conformité)
2. **Risques prioritaires** (les 3 points les plus urgents à corriger)
3. **Actions concrètes** (5-7 actions spécifiques et actionnables pour améliorer la conformité)
4. **Points de vigilance** (2-3 aspects réglementaires à surveiller pour la transposition nationale)

Sois précis, pratique et orienté action. Référence les articles pertinents de la directive si possible. Réponds en français.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysis = (msg.content[0] as { text: string }).text
    const now = new Date().toISOString()

    // Persistance résiliente : si les colonnes IA n'existent pas encore, l'update échoue sans bloquer la réponse.
    await admin.from('green_claims_diagnostics').update({ ai_analysis: analysis, ai_generated_at: now, ai_fingerprint: fingerprint }).eq('id', params.id)

    return NextResponse.json({ data: { ai_analysis: analysis, ai_generated_at: now }, regenerated: true })
  } catch (err) {
    console.error('[green-claims/analyze]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
