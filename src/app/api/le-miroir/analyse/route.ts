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

    const system = `Tu es un éthologue d'entreprise (méthode Sens'ethO). L'entreprise vit dans DEUX milieux à la fois : son MARCHÉ (sa niche économique) et sa place dans la CITÉ (territoire, emploi, ce qu'elle prélève et rend à la société). Elle peut y être DEUX ANIMAUX TOTALEMENT DIFFÉRENTS — un requin sur son marché peut être un ver de terre dans la cité. Tu proposes donc : une ESPÈCE pour le marché, une ESPÈCE pour la cité (identique seulement si c'est vraiment justifié), un HABITAT par milieu, et un verdict d'adéquation (1=inadéquat … 4=pleinement adéquat) par milieu. Le portrait-cité est aussi la marque employeur réelle : demande-toi si cet animal est attractif, quelles valeurs et quelle raison d'être il renvoie. Tu choisis STRICTEMENT parmi les ids fournis.\n\n${catalogueForAI()}\n\nEn t'appuyant sur ta connaissance du secteur déclaré, établis aussi un PROFIL SECTORIEL indicatif (attractivité, forces, faiblesses, turnover, stress/burn-out, niveau de rémunération et part fixe vs variable). Sers-toi de ces signaux pour éclairer le choix du milieu et des verdicts : turnover élevé, stress fort ou secteur en déclin → milieu plus hostile et adéquation plus basse ; secteur attractif et porteur → milieu plus ouvert. Donne des ordres de grandeur réalistes, jamais une fausse précision inventée.\n\nRÈGLES DE RÉDACTION, impératives :\n- Chaque champ texte fait AU PLUS 2 phrases courtes. Sois dense, jamais bavard.\n- Un seul sujet par champ : le turnover va dans « turnover » et NULLE PART ailleurs ; le salaire dans « remuneration » et nulle part ailleurs. Ne répète jamais dans un champ ce que tu as déjà écrit dans un autre.\n- Ne répète jamais une formulation ou un ordre de grandeur deux fois. Un chiffre est donné UNE fois, puis on passe au champ suivant.\n- « forces » et « faiblesses » : 2 à 3 items courts, une ligne chacun.\n\nRéponds UNIQUEMENT par un objet JSON valide, sans texte autour :\n{"especeId":"<id espèce marché>","especeCiteId":"<id espèce cité>","habitatMarcheId":"<id>","habitatCiteId":"<id>","verdictMarche":<1-4>,"verdictCite":<1-4>,"justification":"<2-3 phrases, dont un mot sur la paire des deux animaux : tension féconde ou écartèlement ?>","secteur":{"nom":"<secteur identifié>","attractivite":"<niveau + 1 phrase>","forces":["<2-3 items>"],"faiblesses":["<2-3 items>"],"turnover":"<ordre de grandeur + commentaire>","stress_burnout":"<niveau + commentaire>","remuneration":"<niveau de salaire et part fixe/variable typiques du secteur>"}}`

    const userMsg = `Être à analyser : « ${etreLabel} »\n\nÉléments fournis :\n${lignes || '(peu d\'éléments)'}\n${quizTags?.length ? `\nIndices comportementaux : ${quizTags.join(', ')}` : ''}\n\nPropose le portrait éthologique le plus juste. L'habitat marché doit être un habitat plutôt « marché », l'habitat cité plutôt « cité ».`

    // Sortie structurée : le JSON est garanti conforme au schéma (plus d'extraction par regex).
    // Les ids d'espèces et d'habitats sont contraints par enum → l'IA ne peut pas inventer un id.
    const OUTPUT_SCHEMA = {
      type: 'object',
      properties: {
        especeId: { type: 'string', enum: ESPECES.map((e) => e.id), description: "Animal de l'entreprise sur son MARCHÉ" },
        especeCiteId: { type: 'string', enum: ESPECES.map((e) => e.id), description: "Animal de l'entreprise dans la CITÉ (peut être totalement différent)" },
        habitatMarcheId: { type: 'string', enum: HABITATS.filter((h) => h.milieu !== 'cité').map((h) => h.id) },
        habitatCiteId: { type: 'string', enum: HABITATS.filter((h) => h.milieu !== 'marché').map((h) => h.id) },
        verdictMarche: { type: 'integer', enum: [1, 2, 3, 4] },
        verdictCite: { type: 'integer', enum: [1, 2, 3, 4] },
        justification: { type: 'string', description: "2-3 phrases, dont un mot sur la paire des deux animaux (tension féconde ou écartèlement ?)" },
        secteur: {
          type: 'object',
          properties: {
            nom: { type: 'string' },
            attractivite: { type: 'string' },
            forces: { type: 'array', items: { type: 'string' } },
            faiblesses: { type: 'array', items: { type: 'string' } },
            turnover: { type: 'string' },
            stress_burnout: { type: 'string' },
            remuneration: { type: 'string' },
          },
          required: ['nom', 'attractivite', 'forces', 'faiblesses', 'turnover', 'stress_burnout', 'remuneration'],
          additionalProperties: false,
        },
      },
      required: ['especeId', 'especeCiteId', 'habitatMarcheId', 'habitatCiteId', 'verdictMarche', 'verdictCite', 'justification', 'secteur'],
      additionalProperties: false,
    } as const

    const client = new Anthropic({ apiKey })
    // max_tokens généreux : la réflexion adaptative est active par défaut sur les modèles
    // actuels et partage le budget avec la réponse (800 tronquerait le JSON).
    const params = {
      max_tokens: 8000,
      system,
      messages: [{ role: 'user' as const, content: userMsg }],
      // effort 'medium' : la tâche est une classification cadrée (choisir 2 animaux et
      // 2 habitats dans une liste fermée), pas un problème de raisonnement profond.
      // Divise le temps de réponse et le coût, et réduit les dérives de génération.
      output_config: { effort: 'medium' as const, format: { type: 'json_schema' as const, schema: OUTPUT_SCHEMA } },
    }
    let text = ''
    let stopReason: string | null = null
    try {
      const msg = await client.messages.create({ model: 'claude-opus-5', ...params })
      text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      stopReason = msg.stop_reason
    } catch (primaryErr) {
      console.warn('[le-miroir/analyse] opus indisponible, fallback sonnet:', primaryErr)
      const msg = await client.messages.create({ model: 'claude-sonnet-5', ...params })
      text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      stopReason = msg.stop_reason
    }

    if (stopReason === 'refusal') {
      return NextResponse.json({ error: "L'analyse a été refusée par les garde-fous du modèle. Reformulez la description ou utilisez le mode pas à pas." }, { status: 502 })
    }

    // La sortie structurée garantit un JSON valide ; le repli regex couvre un éventuel préambule.
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) return NextResponse.json({ error: 'Réponse IA non interprétable', raw: text }, { status: 502 })
      parsed = JSON.parse(m[0]) as Record<string, unknown>
    }

    // Validation stricte des ids + clamp des verdicts
    const especeId = ESPECES.some((e) => e.id === parsed.especeId) ? (parsed.especeId as string) : ''
    const especeCiteId = ESPECES.some((e) => e.id === parsed.especeCiteId) ? (parsed.especeCiteId as string) : especeId
    const habitatMarcheId = HABITATS.some((h) => h.id === parsed.habitatMarcheId) ? (parsed.habitatMarcheId as string) : ''
    const habitatCiteId = HABITATS.some((h) => h.id === parsed.habitatCiteId) ? (parsed.habitatCiteId as string) : ''
    const clamp = (v: unknown) => Math.min(4, Math.max(1, Math.round(Number(v) || 3)))

    /**
     * Garde-fou anti-dégénérescence : un champ texte libre peut partir en boucle
     * (« ordre de grandeur : 20-30 % » répété 30 fois). On découpe en segments,
     * on supprime les redites (comparaison normalisée), on borne la longueur.
     */
    function tidy(v: unknown, maxChars = 320): string {
      if (typeof v !== 'string') return ''
      const segments = v.replace(/\s+/g, ' ').trim().split(/(?<=[.!?·;])\s+/)
      const vus = new Set<string>()
      const gardes: string[] = []
      for (const seg of segments) {
        const cle = seg.toLowerCase().replace(/[^a-z0-9%]/g, '')
        if (!cle || vus.has(cle)) continue
        vus.add(cle)
        gardes.push(seg.trim())
        if (gardes.join(' ').length >= maxChars) break
      }
      let out = gardes.join(' ')
      if (out.length > maxChars) out = out.slice(0, out.lastIndexOf(' ', maxChars) + 1).trim() + '…'
      // Ponctuation orpheline laissée par une troncature du modèle
      return out.replace(/\s*[('"«]\s*$/, '').replace(/\s+([.,;)])/g, '$1').trim()
    }

    const rawSecteur = (parsed.secteur && typeof parsed.secteur === 'object' ? parsed.secteur : null) as Record<string, unknown> | null
    const secteur = rawSecteur ? {
      nom: tidy(rawSecteur.nom, 120),
      attractivite: tidy(rawSecteur.attractivite),
      forces: (Array.isArray(rawSecteur.forces) ? rawSecteur.forces : []).slice(0, 4).map((f) => tidy(f, 180)).filter(Boolean),
      faiblesses: (Array.isArray(rawSecteur.faiblesses) ? rawSecteur.faiblesses : []).slice(0, 4).map((f) => tidy(f, 180)).filter(Boolean),
      turnover: tidy(rawSecteur.turnover),
      stress_burnout: tidy(rawSecteur.stress_burnout),
      remuneration: tidy(rawSecteur.remuneration),
    } : null

    return NextResponse.json({
      suggestion: {
        especeId, especeCiteId, habitatMarcheId, habitatCiteId,
        verdictMarche: clamp(parsed.verdictMarche), verdictCite: clamp(parsed.verdictCite),
        justification: tidy(parsed.justification, 700),
        secteur,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
