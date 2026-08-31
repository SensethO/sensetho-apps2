/**
 * Moteur d'analyse « Conformité ECGT » — détection des non-conformités à la
 * directive (UE) 2024/825 dans un contenu réel (page web, document, visuel,
 * script de vidéo, texte collé) et proposition de réécritures conformes.
 *
 * Modèle : claude-opus-4-8 (qualité juridique) + `thinking: { type: 'adaptive' }`
 * + sortie structurée `output_config.format.json_schema` — même patron que
 * src/lib/eudr/coaAnalyze.ts.
 *
 * Budget : le contenu long est découpé en lots traités EN PARALLÈLE, comme
 * src/app/api/qonto/suggest-comptes/route.ts (leçon du 504 : jamais de boucle
 * séquentielle sous un `maxDuration = 60`).
 *
 * Garde-fou anti-hallucination : tout constat dont l'`extrait` ne se retrouve
 * pas VERBATIM dans le texte analysé est écarté (contrôle impossible pour les
 * PDF et images envoyés en vision — ils sont alors signalés comme tels).
 *
 * @see src/lib/ecgt/referentiel.ts · src/lib/ecgt/extraction.ts
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  ECGT_AXES,
  ECGT_ARTICLES,
  ECGT_CRITERE_IDS,
  ECGT_CALENDRIER,
  type EcgtConstat,
  type EcgtContenuType,
  type EcgtGravite,
} from './referentiel'
import { chunkTexte } from './extraction'

const MODEL = 'claude-opus-4-8'

/** Taille d'un lot de texte (≈ 3 500 tokens) — un lot ≈ 20-30 s en opus. */
const CHUNK_CHARS = 12_000
/** Nombre maximal de lots traités en parallèle (garde-fou coût + 60 s). */
const MAX_CHUNKS = 6

const GRAVITES: EcgtGravite[] = ['critique', 'majeur', 'mineur', 'vigilance']

// ─── Entrée / sortie ─────────────────────────────────────────────────────────

export interface EcgtFichier {
  data: Buffer
  mime: string
  name: string
}

export interface AnalyseInput {
  type: EcgtContenuType
  /** Titre affiché du contenu (nom de campagne, de page, de fichier). */
  titre?: string | null
  /** URL d'origine, pour le contexte du prompt. */
  url?: string | null
  /** Texte extrait ou collé. Obligatoire sauf si `fichier` est fourni. */
  texte?: string | null
  /** PDF ou image lu depuis SharePoint et envoyé en vision (jamais stocké). */
  fichier?: EcgtFichier | null
  /** Précisions libres de l'utilisateur (secteur, produit, preuves détenues). */
  contexte?: string | null
}

export interface AnalyseResult {
  constats: EcgtConstat[]
  /** Nombre de lots effectivement envoyés au modèle. */
  lots: number
  /** Lots ayant échoué (analyse partielle). */
  lotsEnEchec: number
  avertissements: string[]
}

// ─── Schéma de sortie ────────────────────────────────────────────────────────

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['constats'],
  properties: {
    constats: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['critere_id', 'gravite', 'extrait', 'probleme', 'article_vise', 'suggestion', 'justification'],
        properties: {
          critere_id: {
            type: 'string',
            enum: [...ECGT_CRITERE_IDS],
            description: 'Identifiant du critère du référentiel ECGT auquel se rattache le constat',
          },
          gravite: { type: 'string', enum: GRAVITES },
          extrait: {
            type: 'string',
            description:
              "Citation EXACTE et verbatim du passage fautif, copiée caractère par caractère depuis le contenu analysé. Jamais de reformulation, jamais d'invention.",
          },
          probleme: { type: 'string', description: 'Ce qui pose problème, en une à trois phrases' },
          article_vise: {
            type: 'string',
            enum: [...ECGT_ARTICLES],
            description: 'Base juridique, à choisir strictement dans la liste fournie',
          },
          suggestion: {
            type: 'string',
            description:
              "Réécriture conforme de l'extrait, conservant l'intention commerciale et prête à être publiée",
          },
          justification: {
            type: 'string',
            description: 'Pourquoi la réécriture est défendable, et quelle preuve doit exister pour la soutenir',
          },
        },
      },
    },
  },
} as const

// ─── Prompt système ──────────────────────────────────────────────────────────

function referentielTexte(): string {
  return ECGT_AXES.map(axe => {
    const criteres = axe.criteres
      .map(c =>
        [
          `  • ${c.id} — ${c.label}`,
          `    Exigence : ${c.description}`,
          `    Base juridique à citer : ${c.reference}`,
          `    Signaux typiques : ${c.signaux.join(' ; ')}`,
        ].join('\n')
      )
      .join('\n')
    return `AXE « ${axe.label} » (${axe.id})\n${axe.description}\n${criteres}`
  }).join('\n\n')
}

const SYSTEM = `Tu es un juriste français spécialiste du droit de la consommation et des allégations environnementales. Tu audites des contenus commerciaux réels au regard de la directive (UE) 2024/825 « Empowering Consumers for the Green Transition », qui modifie la directive 2005/29/CE sur les pratiques commerciales déloyales et la directive 2011/83/UE sur les droits des consommateurs.

Calendrier : ${ECGT_CALENDRIER.transposition} ; ${ECGT_CALENDRIER.application}.

RÉFÉRENTIEL D'ANALYSE — tu ne rattaches un constat qu'à l'un de ces vingt critères :

${referentielTexte()}

MÉTHODE
1. Lis intégralement le contenu fourni, y compris les mentions légales, les astérisques, les textes alternatifs d'images et les infobulles.
2. Pour chaque passage susceptible de constituer une non-conformité, produis UN constat.
3. « extrait » doit être une CITATION EXACTE du contenu analysé, copiée caractère par caractère (accents, ponctuation, majuscules compris), assez longue pour être retrouvée sans ambiguïté (de quelques mots à deux phrases). Tu n'inventes JAMAIS de citation, tu ne reformules jamais, tu ne complètes jamais une phrase absente. S'il n'y a pas de citation exacte à produire, il n'y a pas de constat.
4. « gravite » :
   — « critique » : pratique figurant dans la liste noire de l'annexe I (allégation générique sans excellence démontrée, label d'auto-déclaration, neutralité carbone fondée sur la compensation, obligation légale présentée comme un avantage, allégation étendue à tort au produit entier). Aucune preuve ne peut la sauver : seul le retrait convient.
   — « majeur » : action ou omission trompeuse très probable en l'état.
   — « mineur » : imprécision ou preuve incomplète, corrigeable par une reformulation.
   — « vigilance » : point conforme en apparence mais suspendu à une preuve à vérifier ou à l'interprétation nationale de la transposition.
5. « article_vise » : choisis STRICTEMENT une des formulations de la liste proposée. Ces formulations restent volontairement au niveau de l'article ou de « la liste noire de l'annexe I » : tu n'ajoutes JAMAIS de numéro de point, de considérant ou d'article que tu n'as pas reçu. Aucune référence inventée.
6. « suggestion » : une réécriture prête à publier, qui CONSERVE l'intention commerciale du message (le bénéfice mis en avant, le ton, la longueur approximative) tout en devenant justifiable : allégation spécifique et chiffrée plutôt que générique, périmètre explicite, méthode ou source mentionnée, mention de la preuve nécessaire. Si aucune réécriture n'est possible (par exemple une allégation de neutralité par compensation), écris explicitement que la mention doit être supprimée et propose le message de remplacement le plus proche de l'intention initiale.
7. « justification » : explique pourquoi ta réécriture tient, et quelle preuve l'entreprise doit détenir pour la soutenir (méthode, périmètre, certificat, année de référence).

RÈGLES
— Un constat par passage fautif. Ne multiplie pas les constats sur le même extrait pour des critères voisins : choisis le critère le plus précis.
— N'invente aucun fait sur l'entreprise, ses produits ou ses certifications : tu ne juges que ce qui est écrit.
— Ne signale pas ce qui est manifestement conforme. Un contenu irréprochable donne une liste de constats vide.
— Le doute sur une preuve non visible dans le contenu se traduit par « vigilance », pas par une accusation.
— Réponds uniquement via le format structuré demandé, en français, avec des apostrophes typographiques.`

// ─── Analyse ─────────────────────────────────────────────────────────────────

function fileBlock(f: EcgtFichier): Anthropic.ContentBlockParam | null {
  const b64 = f.data.toString('base64')
  if (f.mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
  }
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.mime)) {
    return { type: 'image', source: { type: 'base64', media_type: f.mime as 'image/png', data: b64 } }
  }
  return null
}

function enteteContenu(input: AnalyseInput, lot?: { i: number; total: number }): string {
  const lignes = [
    `TYPE DE CONTENU : ${input.type}`,
    input.titre ? `TITRE : ${input.titre}` : null,
    input.url ? `URL : ${input.url}` : null,
    input.contexte ? `CONTEXTE FOURNI PAR L’ENTREPRISE : ${input.contexte}` : null,
    input.type === 'video'
      ? "REMARQUE : la vidéo n’est pas transcrite automatiquement ; le texte ci-dessous est le script, la voix off ou les sous-titres fournis par l’utilisateur. Les éléments visuels (surimpressions, logos, labels affichés) ne sont pas couverts."
      : null,
    lot && lot.total > 1 ? `EXTRAIT ${lot.i} / ${lot.total} du contenu (analyse par lots).` : null,
  ].filter(Boolean)
  return lignes.join('\n')
}

interface RawConstat {
  critere_id?: string
  gravite?: string
  extrait?: string
  probleme?: string
  article_vise?: string
  suggestion?: string
  justification?: string
}

async function runAnalyse(
  client: Anthropic,
  content: Anthropic.ContentBlockParam[]
): Promise<RawConstat[]> {
  const params = {
    model: MODEL,
    max_tokens: 12_000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming

  const msg = await client.messages.create(params)
  const textBlock = msg.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  if (!textBlock) return []
  const parsed = JSON.parse(textBlock.text) as { constats?: RawConstat[] }
  return Array.isArray(parsed.constats) ? parsed.constats : []
}

/** Normalisation utilisée pour vérifier qu'un extrait figure bien dans le texte. */
function normalizeForMatch(s: string): string {
  return s
    .replace(/[’‘‛]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Analyse un contenu et renvoie des constats structurés.
 * Ne stocke rien : le texte et les octets ne font que transiter vers l'API Anthropic.
 */
export async function analyseContenu(input: AnalyseInput): Promise<AnalyseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Analyse IA non configurée (clé API absente).')
  }

  const texte = (input.texte ?? '').trim()
  const fichier = input.fichier ?? null
  if (!texte && !fichier) {
    throw new Error('Aucun contenu à analyser : fournissez un texte ou un fichier.')
  }

  const client = new Anthropic()
  const avertissements: string[] = []

  // ── Cas 1 : fichier (PDF ou image) envoyé en vision, un seul appel ────────
  if (fichier) {
    const block = fileBlock(fichier)
    if (!block) {
      throw new Error(
        `Format non pris en charge pour l’analyse en vision : ${fichier.mime}. Convertissez le document en PDF ou en image (PNG, JPEG, WebP), ou collez son texte.`
      )
    }
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: `${enteteContenu(input)}\n\nCONTENU À AUDITER (fichier « ${fichier.name} ») :` },
      block,
    ]
    if (texte) {
      content.push({
        type: 'text',
        text: `TEXTE COMPLÉMENTAIRE FOURNI PAR L’UTILISATEUR (script, mentions légales, précisions) :\n${texte}`,
      })
    }
    let raw: RawConstat[] = []
    try {
      raw = await runAnalyse(client, content)
    } catch (err) {
      throw new Error(`L’analyse IA a échoué : ${String(err)}`)
    }
    avertissements.push(
      "Contenu analysé en vision : les extraits cités sont transcrits par le modèle depuis le fichier et n’ont pas pu être vérifiés caractère par caractère. Recoupez chaque citation avec l’original avant de vous en prévaloir."
    )
    return {
      constats: sanitize(raw, null),
      lots: 1,
      lotsEnEchec: 0,
      avertissements,
    }
  }

  // ── Cas 2 : texte, découpé en lots traités en parallèle ───────────────────
  let lots = chunkTexte(texte, CHUNK_CHARS)
  if (lots.length > MAX_CHUNKS) {
    lots = lots.slice(0, MAX_CHUNKS)
    avertissements.push(
      `Contenu très long : seuls les ${MAX_CHUNKS} premiers lots (environ ${(MAX_CHUNKS * CHUNK_CHARS).toLocaleString('fr-FR')} caractères) ont été analysés.`
    )
  }

  const results = await Promise.allSettled(
    lots.map((lot, i) =>
      runAnalyse(client, [
        {
          type: 'text',
          text: `${enteteContenu(input, { i: i + 1, total: lots.length })}\n\nCONTENU À AUDITER (verbatim, entre les balises) :\n<contenu>\n${lot}\n</contenu>`,
        },
      ])
    )
  )

  const raw: RawConstat[] = []
  let lotsEnEchec = 0
  for (const r of results) {
    if (r.status === 'fulfilled') raw.push(...r.value)
    else lotsEnEchec++
  }
  if (lotsEnEchec === results.length) {
    throw new Error('L’analyse IA a échoué sur l’ensemble du contenu — réessayez.')
  }
  if (lotsEnEchec > 0) {
    avertissements.push(`${lotsEnEchec} lot(s) sur ${results.length} n’ont pas pu être analysés : le rapport est partiel.`)
  }

  const constats = sanitize(raw, texte)
  const ecartes = raw.length - constats.length
  if (ecartes > 0) {
    avertissements.push(
      `${ecartes} constat(s) écarté(s) : la citation annoncée ne figurait pas telle quelle dans le contenu analysé (garde-fou anti-hallucination).`
    )
  }

  return { constats, lots: results.length, lotsEnEchec, avertissements }
}

/**
 * Valide, dédoublonne et trie les constats.
 * @param source texte de référence pour vérifier les citations, ou null (vision).
 */
function sanitize(raw: RawConstat[], source: string | null): EcgtConstat[] {
  const haystack = source === null ? null : normalizeForMatch(source)
  const vus = new Set<string>()
  const out: EcgtConstat[] = []

  for (const c of raw) {
    const critere_id = (c.critere_id ?? '').trim()
    if (!ECGT_CRITERE_IDS.includes(critere_id)) continue

    const gravite = (c.gravite ?? '').trim() as EcgtGravite
    if (!GRAVITES.includes(gravite)) continue

    const extrait = (c.extrait ?? '').trim()
    if (extrait.length < 3) continue
    if (haystack !== null && !haystack.includes(normalizeForMatch(extrait))) continue

    const article_vise = (c.article_vise ?? '').trim()
    if (!(ECGT_ARTICLES as readonly string[]).includes(article_vise)) continue

    const cle = `${critere_id}::${normalizeForMatch(extrait)}`
    if (vus.has(cle)) continue
    vus.add(cle)

    out.push({
      critere_id,
      gravite,
      extrait,
      probleme: (c.probleme ?? '').trim(),
      article_vise,
      suggestion: (c.suggestion ?? '').trim(),
      justification: (c.justification ?? '').trim(),
    })
  }

  const ordre: Record<EcgtGravite, number> = { critique: 0, majeur: 1, mineur: 2, vigilance: 3 }
  return out.sort((a, b) => ordre[a.gravite] - ordre[b.gravite])
}
