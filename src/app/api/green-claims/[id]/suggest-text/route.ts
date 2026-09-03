import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { aiErrorResponse } from '@/lib/aiError'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

/** POST /api/green-claims/[id]/suggest-text — { allegation } → 2 reformulations conformes */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Analyse IA non configurée (clé absente).' }, { status: 503 })

    const body = await req.json()
    const a = body?.allegation as Record<string, string | boolean | null> | undefined
    if (!a?.allegation_text) return NextResponse.json({ error: 'allegation requise' }, { status: 400 })

    const score = computeScore(a)
    const statut = score >= 75 ? 'Conforme' : score >= 40 ? 'À risque' : 'Non conforme'

    const issues: string[] = []
    if (a.type === 'generique') issues.push('Allégation générique/vague — interdite sans preuve de performance environnementale excellente (Annexe I)')
    if (a.evidence_method === 'aucune') issues.push('Aucune preuve scientifique (Art. 3.1)')
    if (a.third_party_verified !== 'oui') issues.push('Pas de vérification par un tiers indépendant (Art. 4)')
    if (a.scope_clear !== 'claire') issues.push('Portée non délimitée précisément (Art. 3.2)')
    if (a.no_compensation_only === 'offsets-seuls') issues.push('Basée uniquement sur des compensations carbone (Art. 3.3)')
    if (a.no_hidden_impact === 'impacts-caches') issues.push('Impacts environnementaux négatifs dissimulés (Annexe I)')
    const issuesList = issues.length ? issues.map((i) => `• ${i}`).join('\n') : 'Non précisés'

    const prompt = `Tu es un expert en communication RSE et en conformité à la Directive Green Claims UE 2024/825/EU.

Une entreprise utilise l'allégation suivante :
"${a.allegation_text}"

Problèmes de conformité identifiés :
${issuesList}

Score de conformité actuel : ${score}/100 (${statut})
Type d'allégation : ${a.type}
Domaine environnemental : ${a.domain}

L'entreprise ne peut pas (ou pas encore) apporter toutes les preuves scientifiques requises pour cette allégation.

Propose 2 alternatives :
1. **Version prudente** : une formulation plus sobre et honnête qui reste vraie sans preuve externe (indiquer une démarche, un objectif ou une action concrète plutôt qu'un résultat)
2. **Version ambitieuse** : une formulation conforme à la directive, qui nécessiterait des preuves raisonnables à obtenir à court terme

Pour chaque version, explique en 1 phrase pourquoi elle est plus conforme.

Sois concis et pratique. Réponds en français.`

    let suggestion: string
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 700,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      })
      suggestion = (msg.content[0] as { text: string }).text
    } catch (err) {
      console.error('[green-claims/suggest-text] AI', err)
      const { message, status } = aiErrorResponse(err)
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({ data: { suggestion } })
  } catch (err) {
    console.error('[green-claims/suggest-text]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
