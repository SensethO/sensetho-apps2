/**
 * Récupération et parsing des flux RSS 2.0 / Atom de Sindup.
 *
 * Parseur maison volontairement tolérant (regex + heuristiques), sans nouvelle
 * dépendance : aucune lib XML n'existe dans package.json et un flux de veille
 * n'exige pas un parseur XML complet. Couvre :
 *  - RSS 2.0  : <item> guid|link, title, description, pubDate|dc:date,
 *               author|dc:creator, enclosure/media:content/media:thumbnail url
 *  - Atom     : <entry> id, title, summary|content, published|updated,
 *               link href (rel="alternate" prioritaire), author><name>
 * Décode les entités HTML de base, retire les balises de l'extrait (500 car. max).
 */

export interface SindupFeedItem {
  guid: string
  titre: string | null
  url: string | null
  extrait: string | null
  auteur: string | null
  published_at: string | null // ISO 8601, ou null si date absente/invalide
  image_url: string | null
}

export interface SindupFeed {
  format: 'rss' | 'atom'
  title: string | null
  items: SindupFeedItem[]
}

const FETCH_TIMEOUT_MS = 12_000
const EXTRAIT_MAX = 500

// ---------------------------------------------------------------------------
// Décodage / nettoyage HTML
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â',
  ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï',
}

/** Décode les entités HTML/XML de base (nommées + numériques). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ''
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = parseInt(dec, 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ''
    })
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * Décode les entités PUIS retire les balises HTML (les flux servent souvent
 * du HTML échappé dans description/summary), compacte les espaces.
 */
function stripHtml(s: string): string {
  return decodeEntities(s)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toExtrait(raw: string | null): string | null {
  if (!raw) return null
  const text = stripHtml(raw)
  if (!text) return null
  return text.length > EXTRAIT_MAX ? `${text.slice(0, EXTRAIT_MAX - 1).trimEnd()}…` : text
}

// ---------------------------------------------------------------------------
// Extraction XML tolérante
// ---------------------------------------------------------------------------

/** Retire un éventuel wrapper CDATA et trim. */
function unwrapCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return (m ? m[1] : s).trim()
}

function escapeRe(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Contenu brut de la première balise <name>…</name> du bloc (namespaces gérés). */
function tagContent(block: string, name: string): string | null {
  const re = new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(name)}\\s*>`, 'i')
  const m = block.match(re)
  return m ? unwrapCdata(m[1]) : null
}

/** Première valeur non vide parmi plusieurs balises candidates. */
function firstTag(block: string, names: string[]): string | null {
  for (const n of names) {
    const v = tagContent(block, n)
    if (v) return v
  }
  return null
}

/** Valeur d'un attribut sur la première balise <name … attr="…">. */
function tagAttr(block: string, name: string, attr: string): string | null {
  const re = new RegExp(`<${escapeRe(name)}\\s[^>]*?\\b${escapeRe(attr)}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
  const m = block.match(re)
  const v = m ? (m[2] ?? m[3] ?? '') : ''
  return v ? decodeEntities(v.trim()) : null
}

/** Tous les blocs <name>…</name> du document. */
function allBlocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(name)}\\s*>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

function toIso(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function cleanText(raw: string | null): string | null {
  if (!raw) return null
  const t = stripHtml(raw)
  return t || null
}

// ---------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------

function parseRssItem(block: string): SindupFeedItem | null {
  const guid = cleanText(firstTag(block, ['guid', 'link']))
  const url = cleanText(firstTag(block, ['link'])) ?? tagAttr(block, 'link', 'href')
  if (!guid && !url) return null
  const image =
    tagAttr(block, 'enclosure', 'url') ??
    tagAttr(block, 'media:content', 'url') ??
    tagAttr(block, 'media:thumbnail', 'url')
  return {
    guid: (guid ?? url)!,
    titre: cleanText(tagContent(block, 'title')),
    url,
    extrait: toExtrait(firstTag(block, ['description', 'content:encoded'])),
    auteur: cleanText(firstTag(block, ['author', 'dc:creator'])),
    published_at: toIso(firstTag(block, ['pubDate', 'dc:date'])),
    image_url: image,
  }
}

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------

function atomLink(block: string): string | null {
  // <link rel="alternate" href="…"> prioritaire, sinon premier <link href="…">.
  const links = block.match(/<link\b[^>]*>/gi) ?? []
  let first: string | null = null
  for (const l of links) {
    const href = tagAttr(l, 'link', 'href')
    if (!href) continue
    if (!first) first = href
    const rel = tagAttr(l, 'link', 'rel')
    if (!rel || rel.toLowerCase() === 'alternate') return href
  }
  return first
}

function parseAtomEntry(block: string): SindupFeedItem | null {
  const id = cleanText(tagContent(block, 'id'))
  const url = atomLink(block)
  if (!id && !url) return null
  const authorBlock = tagContent(block, 'author')
  return {
    guid: (id ?? url)!,
    titre: cleanText(tagContent(block, 'title')),
    url,
    extrait: toExtrait(firstTag(block, ['summary', 'content'])),
    auteur: authorBlock ? cleanText(tagContent(authorBlock, 'name')) ?? cleanText(authorBlock) : null,
    published_at: toIso(firstTag(block, ['published', 'updated'])),
    image_url: tagAttr(block, 'media:content', 'url') ?? tagAttr(block, 'media:thumbnail', 'url'),
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/** Parse un document RSS 2.0 ou Atom. Lève une Error si aucun format reconnu. */
export function parseFeed(xml: string): SindupFeed {
  const doc = xml.replace(/^﻿/, '')

  const rssItems = allBlocks(doc, 'item')
  if (/<rss[\s>]/i.test(doc) || (/<channel[\s>]/i.test(doc) && rssItems.length > 0) || rssItems.length > 0) {
    const channel = tagContent(doc, 'channel')
    const items = rssItems.map(parseRssItem).filter((i): i is SindupFeedItem => i !== null)
    if (items.length > 0 || /<rss[\s>]/i.test(doc)) {
      return { format: 'rss', title: cleanText(channel ? tagContent(channel, 'title') : tagContent(doc, 'title')), items }
    }
  }

  if (/<feed[\s>]/i.test(doc)) {
    const entries = allBlocks(doc, 'entry')
    const items = entries.map(parseAtomEntry).filter((i): i is SindupFeedItem => i !== null)
    // Titre du flux = premier <title> hors entries.
    const head = entries.length > 0 ? doc.slice(0, doc.search(/<entry[\s>]/i)) : doc
    return { format: 'atom', title: cleanText(tagContent(head, 'title')), items }
  }

  throw new Error('Flux non reconnu : ni RSS 2.0 (<rss>/<item>) ni Atom (<feed>/<entry>).')
}

/**
 * Récupère et parse un flux RSS/Atom (User-Agent dédié, timeout 12 s).
 * Lève une Error explicite (réseau, statut HTTP, format) — à attraper par l'appelant.
 */
export async function fetchFeed(url: string): Promise<SindupFeed> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('URL de flux invalide.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL de flux invalide : seuls http(s) sont acceptés.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Sensetho-Veille/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Le flux a répondu HTTP ${res.status}.`)
    const text = await res.text()
    return parseFeed(text)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Le flux ne répond pas (délai de 12 s dépassé).')
    }
    throw err instanceof Error ? err : new Error(String(err))
  } finally {
    clearTimeout(timer)
  }
}
