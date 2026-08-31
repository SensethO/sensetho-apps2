/**
 * Extraction du texte des contenus à analyser — app « Conformité ECGT ».
 *
 * Aucune dépendance nouvelle : le parseur HTML est maison (retrait des blocs
 * non visibles, décodage des entités, normalisation des espaces).
 *
 * Limites assumées et documentées :
 *  — VIDÉO : aucune transcription. Les vidéos ne sont ni téléchargées ni
 *    transcrites (pas de moteur de reconnaissance vocale sur la plateforme, et
 *    le coût/temps d'un transcodage dépasserait le budget de 60 s d'une fonction
 *    Vercel). L'utilisateur colle le script, la voix off ou les sous-titres
 *    (fichier .srt/.vtt ouvert et copié) dans le champ « texte source ».
 *  — DOCUMENT : seuls les PDF sont lisibles directement (envoyés en vision au
 *    modèle). Les .docx/.pptx/.xlsx doivent être exportés en PDF ou collés en
 *    texte — aucun extracteur bureautique n'est embarqué ici.
 *  — PAGE WEB : seul le HTML servi par le serveur est lu. Les pages entièrement
 *    rendues côté client (SPA) peuvent renvoyer peu de texte ; le cas est
 *    signalé à l'appelant pour qu'il propose le collage manuel.
 *  — TAILLE : le texte extrait est tronqué à 40 000 caractères (≈ 12 000 tokens),
 *    et le corps HTML téléchargé à 4 Mo.
 *
 * @see src/lib/ecgt/analyse.ts
 */

/** Longueur maximale du texte conservé pour l'analyse. */
export const ECGT_MAX_TEXTE = 40_000
/** Taille maximale du corps HTML téléchargé (4 Mo). */
const MAX_HTML_BYTES = 4 * 1024 * 1024
/** Délai maximal du fetch d'une page web. */
const FETCH_TIMEOUT_MS = 20_000

const USER_AGENT =
  "Mozilla/5.0 (compatible; SensethoEcgtBot/1.0; +https://apps.sensetho.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

export interface ExtractionResult {
  texte: string
  titre: string | null
  /** Longueur avant troncature — permet de prévenir l'utilisateur. */
  longueurBrute: number
  tronque: boolean
  /** Avertissements non bloquants (page pauvre en texte, contenu partiel…). */
  avertissements: string[]
}

// ─── Décodage des entités HTML (sans dépendance) ─────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', aacute: 'á', auml: 'ä', aring: 'å',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', uacute: 'ú',
  icirc: 'î', iuml: 'ï', igrave: 'ì', iacute: 'í',
  ocirc: 'ô', ouml: 'ö', ograve: 'ò', oacute: 'ó', oslash: 'ø',
  ccedil: 'ç', ntilde: 'ñ', szlig: 'ß', yuml: 'ÿ',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç',
  Ocirc: 'Ô', Ucirc: 'Û', Ugrave: 'Ù', Icirc: 'Î',
  laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', sbquo: '‚',
  ldquo: '“', rdquo: '”', bdquo: '„',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  euro: '€', pound: '£', yen: '¥', cent: '¢', dollar: '$',
  copy: '©', reg: '®', trade: '™', deg: '°', plusmn: '±',
  times: '×', divide: '÷', frac12: '½', frac14: '¼', frac34: '¾',
  sup2: '²', sup3: '³', micro: 'µ', permil: '‰',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  shy: '', zwnj: '', zwj: '', ensp: ' ', emsp: ' ', thinsp: ' ',
}

/** Décode les entités nommées et numériques (&#233; / &#xE9; / &eacute;). */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      try { return String.fromCodePoint(code) } catch { return match }
    }
    const named = NAMED_ENTITIES[entity]
    return named === undefined ? match : named
  })
}

// ─── HTML → texte visible ────────────────────────────────────────────────────

/** Blocs dont le contenu n'est jamais visible par le lecteur. */
const INVISIBLE_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'head']
/** Balises qui provoquent un saut de ligne dans le rendu. */
const BLOCK_TAGS =
  'address|article|aside|blockquote|br|button|caption|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul'

/**
 * Convertit du HTML en texte visible.
 * Conserve les attributs porteurs de message publicitaire (alt des images,
 * title, aria-label) : une allégation peut y être dissimulée.
 */
export function htmlToVisibleText(html: string): { texte: string; titre: string | null } {
  let out = html

  // Commentaires
  out = out.replace(/<!--[\s\S]*?-->/g, ' ')

  // Titre du document (avant suppression du <head>)
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(out)
  const titre = titleMatch ? normalizeWhitespace(decodeHtmlEntities(stripTags(titleMatch[1]))) : null

  // Description meta (souvent la promesse commerciale résumée)
  const metaDesc = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i.exec(out)
    ?? /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i.exec(out)
  const description = metaDesc ? normalizeWhitespace(decodeHtmlEntities(metaDesc[1])) : ''

  // Textes portés par des attributs (alt / title / aria-label)
  const attrTexts: string[] = []
  const attrRe = /\s(?:alt|title|aria-label)=["']([^"']{3,300})["']/gi
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(out)) !== null) {
    const v = normalizeWhitespace(decodeHtmlEntities(m[1]))
    if (v && !attrTexts.includes(v)) attrTexts.push(v)
    if (attrTexts.length >= 300) break
  }

  // Blocs invisibles
  for (const tag of INVISIBLE_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ')
    // Balises auto-fermantes ou non refermées (head sans </head>, etc.)
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), ' ')
  }

  // Sauts de ligne sur les balises de bloc
  out = out.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')

  // Toutes les autres balises
  out = stripTags(out)
  out = decodeHtmlEntities(out)

  // Normalisation
  out = out
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const extras: string[] = []
  if (description) extras.push(`[Meta description] ${description}`)
  if (attrTexts.length) extras.push(`[Textes alternatifs et infobulles]\n${attrTexts.join('\n')}`)

  return {
    texte: [out, ...extras].filter(Boolean).join('\n\n'),
    titre,
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ')
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// ─── Extraction depuis une URL ───────────────────────────────────────────────

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/**
 * Télécharge une page web et en extrait le texte visible.
 * Lève une erreur explicite (message destiné à l'utilisateur) en cas d'échec.
 */
export async function extractFromUrl(rawUrl: string): Promise<ExtractionResult> {
  const url = normalizeUrl(rawUrl)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`URL invalide : ${rawUrl}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Seules les URL http(s) peuvent être analysées.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    })
  } catch (err) {
    clearTimeout(timer)
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new Error(
      aborted
        ? `La page n’a pas répondu en ${FETCH_TIMEOUT_MS / 1000} s : ${parsed.hostname}. Collez le texte manuellement.`
        : `Impossible de charger la page (${parsed.hostname}) : ${String(err)}`
    )
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new Error(`La page a répondu ${res.status} ${res.statusText}. Collez le texte manuellement si elle nécessite une authentification.`)
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/pdf')) {
    throw new Error("Cette URL pointe vers un PDF. Ajoutez-le comme contenu de type « Document » pour l’analyser en vision.")
  }
  if (contentType && !contentType.includes('html') && !contentType.includes('text/plain') && !contentType.includes('xml')) {
    throw new Error(`Type de contenu non pris en charge (${contentType.split(';')[0]}). Seules les pages HTML sont extraites.`)
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_HTML_BYTES) {
    throw new Error('Page trop volumineuse (plus de 4 Mo). Collez la section à analyser manuellement.')
  }
  const html = new TextDecoder(detectCharset(contentType), { fatal: false }).decode(buf)

  const { texte, titre } = contentType.includes('text/plain')
    ? { texte: html, titre: null }
    : htmlToVisibleText(html)

  const avertissements: string[] = []
  if (texte.length < 400) {
    avertissements.push(
      "Très peu de texte a été extrait : la page est probablement rendue côté navigateur (application monopage) ou protégée. Collez le contenu visible pour une analyse fiable."
    )
  }

  return finalize(texte, titre, avertissements)
}

function detectCharset(contentType: string): string {
  const m = /charset=([\w-]+)/i.exec(contentType)
  const cs = (m?.[1] ?? 'utf-8').toLowerCase()
  // TextDecoder accepte iso-8859-1/windows-1252 ; on retombe sur utf-8 sinon.
  const known = ['utf-8', 'utf8', 'iso-8859-1', 'iso-8859-15', 'windows-1252', 'latin1']
  return known.includes(cs) ? cs : 'utf-8'
}

// ─── Extraction depuis un texte collé ────────────────────────────────────────

/** Pass-through : nettoyage minimal et troncature. */
export function extractFromTexte(texte: string, titre?: string | null): ExtractionResult {
  const clean = (texte ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return finalize(clean, titre ?? null, [])
}

/**
 * Sous-titres .srt / .vtt collés par l'utilisateur : retire les numéros de
 * séquence et les horodatages pour ne garder que les répliques.
 */
export function extractFromSubtitles(raw: string): ExtractionResult {
  const lines = (raw ?? '').replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const l = line.trim()
    if (!l) continue
    if (/^WEBVTT/i.test(l)) continue
    if (/^\d+$/.test(l)) continue
    if (/-->/.test(l)) continue
    if (/^(NOTE|STYLE|REGION)\b/i.test(l)) continue
    const clean = l.replace(/<[^>]*>/g, '').trim()
    if (clean && kept[kept.length - 1] !== clean) kept.push(clean)
  }
  return finalize(kept.join('\n'), null, [
    "Texte reconstitué à partir de sous-titres : les éléments visuels de la vidéo (surimpressions, logos, labels affichés) ne sont pas couverts.",
  ])
}

// ─── Sortie commune ──────────────────────────────────────────────────────────

function finalize(texte: string, titre: string | null, avertissements: string[]): ExtractionResult {
  const longueurBrute = texte.length
  const tronque = longueurBrute > ECGT_MAX_TEXTE
  if (tronque) {
    avertissements = [
      ...avertissements,
      `Contenu tronqué à ${ECGT_MAX_TEXTE.toLocaleString('fr-FR')} caractères sur ${longueurBrute.toLocaleString('fr-FR')} : la fin du contenu n’a pas été analysée.`,
    ]
  }
  return {
    texte: tronque ? texte.slice(0, ECGT_MAX_TEXTE) : texte,
    titre,
    longueurBrute,
    tronque,
    avertissements,
  }
}

/** Découpe un texte long en lots analysables séparément (analyse en parallèle). */
export function chunkTexte(texte: string, tailleLot: number): string[] {
  if (texte.length <= tailleLot) return [texte]
  const lots: string[] = []
  let reste = texte
  while (reste.length > 0) {
    if (reste.length <= tailleLot) { lots.push(reste); break }
    // Coupe sur la dernière frontière de paragraphe, sinon de phrase, sinon brute.
    const fenetre = reste.slice(0, tailleLot)
    const coupe =
      fenetre.lastIndexOf('\n\n') > tailleLot * 0.5 ? fenetre.lastIndexOf('\n\n')
      : fenetre.lastIndexOf('\n') > tailleLot * 0.5 ? fenetre.lastIndexOf('\n')
      : fenetre.lastIndexOf('. ') > tailleLot * 0.5 ? fenetre.lastIndexOf('. ') + 1
      : tailleLot
    lots.push(reste.slice(0, coupe))
    reste = reste.slice(coupe).replace(/^\s+/, '')
  }
  return lots.filter(l => l.trim().length > 0)
}
