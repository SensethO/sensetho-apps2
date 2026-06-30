import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { ESPECES, HABITATS, catalogueForAI } from '@/lib/leMiroir'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/le-miroir/analyse
 * Body: { etreLabel: string, answers: Record<string,string>, quizTags?: string[] }
 * Analyse, via Claude, l'activité décrite et propose un portrait éthologique :
 * espèce + habitat marché + habitat cité + verdicts + justification.
 */
export async function PATCH() { return NextResponse.json({ error: 'Use POST' }, { status: 405 }) }

export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 503 })

    const { etreLabel, answers, quizTags } = await req.json()
    const lignes = Object.entries(answers ?? {})
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `- ${k} : ${v}`)
      .join('\n')

    const system = `Tu es un éthologue d'entreprise (méthode Sens'ethO). On observe une organisation (ou un service) comme un être vivant : on lui associe une ESPÈCE (mode de fonctionnement) et un HABITAT par milieu — le MARCHÉ (sa niche économique) et la CITÉ (sa place sociale/territoriale) — puis un verdict d'adéquation (1=inadéquat … 4=pleinement adéquat) par milieu. Tu choisis STRICTEMENT parmi les ids fournis.\n\n${catalogueForAI()}\n\nEn t'appuyant sur ta connaissance du secteur déclaré, établis aussi un PROFIL SECTORIEL indicatif (attractivité, forces, faiblesses, turnover, stress/burn-out, niveau de rémunération et part fixe vs variable). Sers-toi de ces signaux pour éclairer le choix du milieu et des verdicts : turnover élevé, stress fort ou secteur en déclin → milieu plus hostile et adéquation plus basse ; secteur attractif et porteur → milieu plus ouvert. Donne des ordres de grandeur réalistes, jamais une fausse précision inventée.\n\nRéponds UNIQUEMENT par un objet JSON valide, sans texte autour :\n{"especeId":"<id>","habitatMarcheId":"<id>","habitatCiteId":"<id>","verdictMarche":<1-4>,"verdictCite":<1-4>,"justification":"<2-3 phrases>","secteur":{"nom":"<secteur identifié>","attractivite":"<niveau + 1 phrase>","forces":["<2-3 items>"],"faiblesses":["<2-3 items>"],"turnover":"<ordre de grandeur + commentaire>","stress_burnout":"<niveau + commentaire>","remuneration":"<niveau de salaire et part fixe/variable typiques du secteur>"}}`

    const userMsg = `Être à analyser : « ${etreLabel} »\n\nÉléments fournis :\n${lignes || '(peu d\'éléments)'}\n${quizTags?.length ? `\nIndices comportementaux : ${quizTags.join(', ')}` : ''}\n\nPropose le portrait éthologique le plus juste. L'habitat marché doit être un habitat plutôt « marché », l'habitat cité plutôt « cité ».`

    const client = new Anthropic({ apiKey })
    let text = ''
    try {
      const msg = await client.messages.create({
        model: 'claude-opus-4-5', max_tokens: 800, system,
        messages: [{ role: 'user', content: userMsg }],
      })
      text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    } catch (primaryErr) {
      console.warn('[le-miroir/analyse] opus indisponible, fallback sonnet:', primaryErr)
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5', max_tokens: 800, system,
        messages: [{ role: 'user', content: userMsg }],
      })
      text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    }

    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'Réponse IA non interprétable', raw: text }, { status: 502 })
    const parsed = JSON.parse(m[0]) as Record<string, unknown>

    // Validation stricte des ids + clamp des verdicts
    const especeId = ESPECES.some((e) => e.id === parsed.especeId) ? (parsed.especeId as string) : ''
    const habitatMarcheId = HABITATS.some((h) => h.id === parsed.habitatMarcheId) ? (parsed.habitatMarcheId as string) : ''
    const habitatCiteId = HABITATS.some((h) => h.id === parsed.habitatCiteId) ? (parsed.habitatCiteId as string) : ''
    const clamp = (v: unknown) => Math.min(4, Math.max(1, Math.round(Number(v) || 3)))

    const secteur = parsed.secteur && typeof parsed.secteur === 'object' ? parsed.secteur : null

    return NextResponse.json({
      suggestion: {
        especeId, habitatMarcheId, habitatCiteId,
        verdictMarche: clamp(parsed.verdictMarche), verdictCite: clamp(parsed.verdictCite),
        justification: typeof parsed.justification === 'string' ? parsed.justification : '',
        secteur,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
