import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const SCORE_LABELS = ['Non évalué', 'Inexistant', 'Initié', 'En développement', 'Maîtrisé', 'Exemplaire']

const QC_NAMES: Record<string, string> = {
  QC1: "Gouvernance de l'organisation",
  QC2: "Droits de l'Homme",
  QC3: 'Relations et conditions de travail',
  QC4: 'Environnement',
  QC5: 'Loyauté des pratiques',
  QC6: 'Questions relatives aux consommateurs',
  QC7: 'Communautés et développement local',
}

const DOMAIN_QC: Record<string, string> = {
  'DA1.1': 'QC1',
  'DA2.1': 'QC2', 'DA2.2': 'QC2', 'DA2.3': 'QC2', 'DA2.4': 'QC2', 'DA2.5': 'QC2', 'DA2.6': 'QC2', 'DA2.7': 'QC2', 'DA2.8': 'QC2',
  'DA3.1': 'QC3', 'DA3.2': 'QC3', 'DA3.3': 'QC3', 'DA3.4': 'QC3', 'DA3.5': 'QC3',
  'DA4.1': 'QC4', 'DA4.2': 'QC4', 'DA4.3': 'QC4', 'DA4.4': 'QC4',
  'DA5.1': 'QC5', 'DA5.2': 'QC5', 'DA5.3': 'QC5', 'DA5.4': 'QC5', 'DA5.5': 'QC5',
  'DA6.1': 'QC6', 'DA6.2': 'QC6', 'DA6.3': 'QC6', 'DA6.4': 'QC6', 'DA6.5': 'QC6', 'DA6.6': 'QC6', 'DA6.7': 'QC6',
  'DA7.1': 'QC7', 'DA7.2': 'QC7', 'DA7.3': 'QC7', 'DA7.4': 'QC7', 'DA7.5': 'QC7', 'DA7.6': 'QC7', 'DA7.7': 'QC7',
}

const DOMAIN_NAMES: Record<string, string> = {
  'DA1.1': 'Gouvernance organisationnelle',
  'DA2.1': 'Devoir de vigilance',
  'DA2.2': 'Situations à risque pour les droits de l\'Homme',
  'DA2.3': 'Prévention de la complicité',
  'DA2.4': 'Remédier aux atteintes aux droits de l\'Homme',
  'DA2.5': 'Discrimination et groupes vulnérables',
  'DA2.6': 'Droits civils et politiques',
  'DA2.7': 'Droits économiques, sociaux et culturels',
  'DA2.8': 'Principes fondamentaux et droits au travail',
  'DA3.1': 'Emploi et relations employeur/employé',
  'DA3.2': 'Conditions de travail et protection sociale',
  'DA3.3': 'Dialogue social',
  'DA3.4': 'Santé et sécurité au travail',
  'DA3.5': 'Développement du capital humain',
  'DA4.1': 'Prévention de la pollution',
  'DA4.2': 'Utilisation durable des ressources',
  'DA4.3': 'Atténuation des changements climatiques et adaptation',
  'DA4.4': "Protection de l'environnement, biodiversité et habitats naturels",
  'DA5.1': 'Lutte contre la corruption',
  'DA5.2': 'Engagement politique responsable',
  'DA5.3': 'Concurrence loyale',
  'DA5.4': 'Promotion de la RSE dans la chaîne de valeur',
  'DA5.5': 'Respect des droits de propriété',
  'DA6.1': "Pratiques loyales en matière de commercialisation",
  'DA6.2': 'Protection de la santé et de la sécurité des consommateurs',
  'DA6.3': 'Consommation durable',
  'DA6.4': 'Service après-vente et résolution des réclamations',
  'DA6.5': 'Protection des données et de la vie privée des consommateurs',
  'DA6.6': 'Accès aux services essentiels',
  'DA6.7': 'Éducation et sensibilisation',
  'DA7.1': 'Implication auprès des communautés',
  'DA7.2': 'Éducation et culture',
  'DA7.3': "Création d'emplois et développement des compétences",
  'DA7.4': 'Développement des technologies et accès à la technologie',
  'DA7.5': 'Création de richesses et de revenus',
  'DA7.6': 'La santé',
  'DA7.7': 'Investissement à impact social',
}

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id')
    .eq('id', diagnosticId)
    .single()
  return data?.user_id === userId
}

/** POST /api/iso26000/[id]/analyze */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await canWrite(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: diag } = await admin
      .from('iso26000_diagnostics')
      .select('*, organisations(nom, secteur:activite_principale, ville)')
      .eq('id', params.id)
      .single()

    if (!diag) return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })

    let force = false
    try {
      const body = await req.json()
      force = body?.force === true
    } catch { /* body vide */ }

    const scores: Record<string, number> = diag.scores ?? {}
    const evaluated = Object.entries(scores).filter(([, v]) => v > 0)

    if (evaluated.length === 0) {
      return NextResponse.json({ error: 'Aucun domaine évalué' }, { status: 400 })
    }

    // Cache check
    if (!force) {
      const prevScores: Record<string, number> = diag.ai_scores ?? {}
      const changed = evaluated.filter(([k, v]) => prevScores[k] !== v).length
      const newEvaluated = evaluated.filter(([k]) => !prevScores[k]).length
      if (diag.ai_analysis && changed < 2 && newEvaluated < 2) {
        return NextResponse.json({
          data: {
            ai_analysis: diag.ai_analysis,
            ai_scores: diag.ai_scores,
            ai_generated_at: diag.ai_generated_at,
          },
          cached: true,
        })
      }
    }

    // Grouper par QC pour le prompt
    const byQc: Record<string, string[]> = {}
    for (const [domainId, score] of evaluated.sort(([, a], [, b]) => b - a)) {
      const qcId = DOMAIN_QC[domainId] ?? 'QC?'
      if (!byQc[qcId]) byQc[qcId] = []
      byQc[qcId].push(`  • ${DOMAIN_NAMES[domainId] ?? domainId} : ${score}/5 (${SCORE_LABELS[score]})`)
    }

    const scoreBlock = Object.entries(byQc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([qcId, lines]) => `${QC_NAMES[qcId] ?? qcId} :\n${lines.join('\n')}`)
      .join('\n\n')

    const org = (diag as Record<string, unknown>).organisations as Record<string, unknown>
    const orgName = org?.nom ?? 'cette organisation'
    const secteur = org?.secteur ?? diag.secteur ?? 'non précisé'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Tu es un expert RSE spécialiste de la norme ISO 26000. Analyse ce diagnostic RSE complet pour ${orgName} (secteur : ${secteur}, année ${diag.year}).

Ce diagnostic couvre ${evaluated.length} domaines sur les 7 questions centrales ISO 26000 :

${scoreBlock}

Rédige une analyse structurée en 5 parties (3-5 phrases chacune) :

1. **Synthèse globale** — niveau de maturité RSE général sur les 7 questions centrales ISO 26000
2. **Points forts** — questions centrales et domaines bien maîtrisés (score ≥ 3)
3. **Axes de progrès prioritaires** — domaines critiques à améliorer (score ≤ 2), par ordre d'importance
4. **Recommandations concrètes** — 3 à 5 actions immédiates et réalistes
5. **Prochaines étapes** — cap à 6-12 mois pour progresser dans la démarche ISO 26000

Réponds en français, ton professionnel mais accessible. Réfère-toi explicitement aux questions centrales (QC1-QC7) dans ton analyse.`,
      }],
    })

    const analysis = (msg.content[0] as { text: string }).text
    const now = new Date().toISOString()

    await admin
      .from('iso26000_diagnostics')
      .update({ ai_analysis: analysis, ai_scores: scores, ai_generated_at: now })
      .eq('id', params.id)

    return NextResponse.json({
      data: {
        ai_analysis: analysis,
        ai_scores: scores,
        ai_generated_at: now,
      },
      regenerated: true,
    })
  } catch (err) {
    console.error('[iso26000/analyze]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
