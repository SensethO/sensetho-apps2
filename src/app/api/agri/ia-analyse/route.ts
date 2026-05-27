/**
 * POST /api/agri/ia-analyse
 * Analyse IA d'une plantation agricole via Claude (Anthropic API).
 *
 * Body: {
 *   plantation      : objet plantation (nom, culture, superficie, localisation…)
 *   champs          : tableau de champs/parcelles
 *   meteo_recente   : tableau de données météo récentes
 *   photos_recentes : tableau de métadonnées photos récentes
 *   prix_marches    : objet avec les prix du marché
 * }
 *
 * Retourne : {
 *   court_terme     : string (0-3 mois)
 *   moyen_terme     : string (3-12 mois)
 *   long_terme      : string (12+ mois)
 *   risques         : string[]
 *   opportunites    : string[]
 *   recommandations : string[]
 *   score_qualite   : number (0-100)
 * }
 */
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

interface PlantationData {
  nom?: string
  culture?: string
  superficie?: number
  localisation?: string
  annee_creation?: number
  variete?: string
  [key: string]: unknown
}

interface ChampData {
  id?: string
  nom?: string
  superficie?: number
  culture?: string
  etat?: string
  [key: string]: unknown
}

interface MeteoData {
  date?: string
  temp_max?: number
  temp_min?: number
  humidity?: number
  rainfall?: number
  [key: string]: unknown
}

interface PhotoData {
  date?: string
  type?: string
  observations?: string
  [key: string]: unknown
}

interface PrixMarches {
  cacao?: { close?: number; variation?: number }
  cafe?: { close?: number; variation?: number }
  [key: string]: unknown
}

interface AnalyseBody {
  plantation?: PlantationData
  champs?: ChampData[]
  meteo_recente?: MeteoData[]
  photos_recentes?: PhotoData[]
  prix_marches?: PrixMarches
}

interface AnalyseResult {
  court_terme: string
  moyen_terme: string
  long_terme: string
  risques: string[]
  opportunites: string[]
  recommandations: string[]
  score_qualite: number
}

function buildUserPrompt(body: AnalyseBody): string {
  const { plantation, champs, meteo_recente, photos_recentes, prix_marches } = body

  const sections: string[] = []

  if (plantation) {
    sections.push(`## Données de la plantation
- Nom : ${plantation.nom ?? 'Non renseigné'}
- Culture principale : ${plantation.culture ?? 'Non renseignée'}
- Superficie totale : ${plantation.superficie ? `${plantation.superficie} ha` : 'Non renseignée'}
- Localisation : ${plantation.localisation ?? 'Non renseignée'}
- Année de création : ${plantation.annee_creation ?? 'Non renseignée'}
- Variété : ${plantation.variete ?? 'Non renseignée'}
${Object.entries(plantation)
  .filter(([k]) => !['nom', 'culture', 'superficie', 'localisation', 'annee_creation', 'variete'].includes(k))
  .map(([k, v]) => `- ${k} : ${JSON.stringify(v)}`)
  .join('\n')}`)
  }

  if (champs && champs.length > 0) {
    sections.push(`## Parcelles / Champs (${champs.length} au total)
${champs
  .map(
    (c, i) =>
      `### Parcelle ${i + 1}${c.nom ? ` — ${c.nom}` : ''}
- Superficie : ${c.superficie ? `${c.superficie} ha` : 'N/A'}
- Culture : ${c.culture ?? 'N/A'}
- État : ${c.etat ?? 'N/A'}
${Object.entries(c)
  .filter(([k]) => !['id', 'nom', 'superficie', 'culture', 'etat'].includes(k))
  .map(([k, v]) => `- ${k} : ${JSON.stringify(v)}`)
  .join('\n')}`
  )
  .join('\n\n')}`)
  }

  if (meteo_recente && meteo_recente.length > 0) {
    const recent = meteo_recente.slice(0, 14)
    const avgTemp =
      recent.reduce((s, m) => s + ((m.temp_max ?? 0) + (m.temp_min ?? 0)) / 2, 0) / recent.length
    const totalRain = recent.reduce((s, m) => s + (m.rainfall ?? 0), 0)
    const avgHumidity = recent.reduce((s, m) => s + (m.humidity ?? 0), 0) / recent.length

    sections.push(`## Météo récente (${recent.length} derniers jours)
- Température moyenne : ${avgTemp.toFixed(1)}°C
- Humidité moyenne : ${avgHumidity.toFixed(0)}%
- Précipitations totales : ${totalRain.toFixed(1)} mm
- Données détaillées : ${JSON.stringify(recent)}`)
  }

  if (photos_recentes && photos_recentes.length > 0) {
    sections.push(`## Observations récentes (${photos_recentes.length} entrées)
${photos_recentes
  .map(
    (p) =>
      `- [${p.date ?? 'date N/A'}] ${p.type ?? 'Observation'} : ${p.observations ?? 'Aucune note'}`
  )
  .join('\n')}`)
  }

  if (prix_marches) {
    sections.push(`## Prix des marchés
${Object.entries(prix_marches)
  .map(([produit, prix]) => {
    if (prix && typeof prix === 'object') {
      const p = prix as { close?: number; variation?: number }
      return `- ${produit} : ${p.close ?? 'N/A'} (variation : ${p.variation !== undefined ? `${p.variation > 0 ? '+' : ''}${p.variation}%` : 'N/A'})`
    }
    return `- ${produit} : ${JSON.stringify(prix)}`
  })
  .join('\n')}`)
  }

  return `${sections.join('\n\n')}

---

Analyse ces données et réponds UNIQUEMENT en JSON valide (pas de texte avant ni après), avec exactement ce format :
{
  "court_terme": "Analyse et recommandations pour les 0-3 prochains mois",
  "moyen_terme": "Analyse et recommandations pour les 3-12 prochains mois",
  "long_terme": "Analyse et perspectives pour les 12+ prochains mois",
  "risques": ["risque 1", "risque 2", "risque 3"],
  "opportunites": ["opportunité 1", "opportunité 2"],
  "recommandations": ["action prioritaire 1", "action prioritaire 2", "action prioritaire 3"],
  "score_qualite": 72
}

Le score_qualite (0-100) doit refléter l'état global de la plantation (100 = excellente, 0 = critique).`
}

const SYSTEM_PROMPT = `Tu es un expert agronome spécialisé en cultures tropicales (cacao, café, épices, cultures vivrières) en Afrique de l'Ouest, avec plus de 20 ans d'expérience terrain en Côte d'Ivoire, Ghana, Cameroun et Sénégal.

Tu analyses les données de plantations agricoles et fournis des conclusions actionables, précises et adaptées au contexte local africain.

Tes analyses tiennent compte :
- Des cycles de culture tropicaux et des saisons (grande et petite saisons des pluies)
- Des maladies courantes (pourriture brune du cacao, rouille du caféier, swollen shoot…)
- Des pratiques agroécologiques adaptées au contexte local
- Des réalités économiques et des prix des marchés internationaux des matières premières
- Des risques climatiques (El Niño/La Niña, sécheresses, inondations)

Tu réponds TOUJOURS et UNIQUEMENT en JSON valide, sans texte additionnel.`

export async function POST(request: Request) {
  try {
    const body: AnalyseBody = await request.json()

    if (!body.plantation && !body.champs) {
      return NextResponse.json(
        { error: 'Le corps de la requête doit contenir au moins plantation ou champs' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY non configurée' },
        { status: 503 }
      )
    }

    const client = new Anthropic({ apiKey })
    const userPrompt = buildUserPrompt(body)

    let message
    try {
      message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })
    } catch (primaryErr) {
      // Fallback vers claude-sonnet-4-5 si opus n'est pas disponible
      console.warn('[ia-analyse] claude-opus-4-5 unavailable, falling back to claude-sonnet-4-5:', primaryErr)
      message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })
    }

    const rawContent = message.content[0]
    if (!rawContent || rawContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Réponse inattendue de l\'API Claude' },
        { status: 500 }
      )
    }

    let analyse: AnalyseResult
    try {
      // Nettoyer la réponse au cas où Claude ajouterait des backticks
      const cleaned = rawContent.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      analyse = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        {
          error: 'Impossible de parser la réponse JSON de Claude',
          raw: rawContent.text,
        },
        { status: 500 }
      )
    }

    // Validation minimale du schéma de retour
    const required: Array<keyof AnalyseResult> = [
      'court_terme',
      'moyen_terme',
      'long_terme',
      'risques',
      'opportunites',
      'recommandations',
      'score_qualite',
    ]
    for (const field of required) {
      if (analyse[field] === undefined) {
        return NextResponse.json(
          { error: `Champ manquant dans la réponse : ${field}`, raw: rawContent.text },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(analyse)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
