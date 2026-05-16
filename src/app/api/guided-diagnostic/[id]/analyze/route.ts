import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

const SCORE_LABELS = ['Non évalué', 'Initiale', 'Engagée', 'Structurée', 'Avancée', 'Exemplaire']
const DOMAIN_NAMES: Record<string, string> = {
  'DA1.1': 'Gouvernance organisationnelle',
  'DA2.1': 'Devoir de vigilance',
  'DA3.1': 'Emploi et relations de travail',
  'DA3.4': 'Santé et sécurité au travail',
  'DA3.5': 'Formation et éducation',
  'DA3.6': 'Égalité professionnelle',
  'DA4.1': 'Prévention de la pollution',
  'DA4.2': 'Utilisation durable des ressources',
  'DA4.3': 'Atténuation des changements climatiques',
  'DA5.1': 'Lutte contre la corruption',
  'DA5.4': 'Pratiques d\'achat responsables',
  'DA6.5': 'Protection des données',
  'DA7.1': 'Implication auprès des communautés',
}

/** POST /api/guided-diagnostic/[id]/analyze */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: diag } = await admin
      .from('guided_diagnostics')
      .select('*, organisations(denomination, secteur:activite_principale, ville)')
      .eq('id', params.id)
      .single()

    if (!diag || diag.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Lire le paramètre force depuis le body
    let force = false
    try {
      const body = await req.json()
      force = body?.force === true
    } catch { /* body vide ou non-JSON — on ignore */ }

    const scores: Record<string, number> = diag.scores ?? {}
    const evaluated = Object.entries(scores).filter(([, v]) => v > 0)

    if (evaluated.length === 0) {
      return NextResponse.json({ error: 'Aucun domaine évalué' }, { status: 400 })
    }

    // Vérifier si régénération nécessaire (sauf si force=true)
    if (!force) {
      const prevScores: Record<string, number> = diag.ai_scores ?? {}
      const changed = evaluated.filter(([k, v]) => prevScores[k] !== v).length
      const newEvaluated = evaluated.filter(([k]) => !prevScores[k]).length

      if (diag.ai_analysis && changed < 2 && newEvaluated < 2) {
        return NextResponse.json({
          analysis: diag.ai_analysis,
          generated_at: diag.ai_generated_at,
          cached: true,
          regenerated: false,
        })
      }
    }

    // Générer avec Claude
    const org = (diag as Record<string, unknown>).organisations as Record<string, unknown>
    const scoreLines = evaluated
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `- ${DOMAIN_NAMES[k] ?? k} : ${v}/5 (${SCORE_LABELS[v]})`)
      .join('\n')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Tu es un expert RSE ISO 26000. Analyse ce diagnostic initial pour ${org?.denomination ?? 'cette organisation'} (secteur: ${org?.secteur ?? diag.secteur ?? 'non précisé'}, année ${diag.year}).

Scores (sur 5) :
${scoreLines}

Rédige une analyse structurée en 5 parties courtes (3-4 phrases chacune) :
1. **Synthèse globale** — niveau de maturité RSE général
2. **Points forts** — domaines bien maîtrisés
3. **Axes de progrès prioritaires** — domaines les plus critiques à améliorer
4. **Recommandations concrètes** — 3 actions immédiates
5. **Prochaines étapes** — cap à 6 mois

Réponds en français, ton professionnel mais accessible.`,
      }],
    })

    const analysis = (msg.content[0] as { text: string }).text
    const now = new Date().toISOString()

    await admin
      .from('guided_diagnostics')
      .update({ ai_analysis: analysis, ai_scores: scores, ai_generated_at: now })
      .eq('id', params.id)

    return NextResponse.json({ analysis, generated_at: now, regenerated: true })
  } catch (err) {
    console.error('[guided/analyze]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
