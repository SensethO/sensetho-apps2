// Analyse IA des COA (Claude vision). @see docs/MAINTENANCE.md §6 · docs/HANDOVER.md §7
import Anthropic from '@anthropic-ai/sdk'

/**
 * Analyse d'un fichier COA (Certificate of Analysis) par Claude (vision).
 * Un même fichier peut contenir PLUSIEURS certificats/produits → renvoie un
 * tableau `documents`, un par produit analysé. Chaque document : en-tête,
 * tableau (paramètre/méthode/spécification/résultat), verdict par ligne,
 * points à vérifier. La « demande client » sert de référence pour le qualitatif.
 *
 * Modèle : claude-opus-4-8 (vision + adaptive thinking + sortie structurée).
 * Le fichier ne fait que transiter vers l'API Anthropic (rien n'est stocké).
 */

const MODEL = 'claude-opus-4-8'

export interface CoaFile { data: Buffer; mime: string; name: string }

export interface CoaRow {
  section: string; parametre: string; methode: string; specification: string; resultat: string
  verdict: 'conforme' | 'non_conforme' | 'a_verifier'; commentaire: string; source: string
}
export interface CoaHeader {
  producteur: string; numero_certificat: string; produit: string; numero_batch: string
  reference_echantillon: string; date_fabrication: string; date_analyse: string; date_peremption: string
  date_document: string
}
export interface CoaDocument {
  header: CoaHeader
  rows: CoaRow[]
  points_a_verifier: string[]
  summary: { conforme_global: boolean; resume: string }
}

const HEADER_PROPS = {
  producteur: { type: 'string' }, numero_certificat: { type: 'string' }, produit: { type: 'string' },
  numero_batch: { type: 'string' }, reference_echantillon: { type: 'string' },
  date_fabrication: { type: 'string' }, date_analyse: { type: 'string' }, date_peremption: { type: 'string' },
  date_document: { type: 'string' },
}
const DOC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['header', 'rows', 'points_a_verifier', 'summary'],
  properties: {
    header: { type: 'object', additionalProperties: false, required: Object.keys(HEADER_PROPS), properties: HEADER_PROPS },
    rows: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['section', 'parametre', 'methode', 'specification', 'resultat', 'verdict', 'commentaire', 'source'],
        properties: {
          section: { type: 'string' }, parametre: { type: 'string' }, methode: { type: 'string' },
          specification: { type: 'string' }, resultat: { type: 'string' },
          verdict: { type: 'string', enum: ['conforme', 'non_conforme', 'a_verifier'] },
          commentaire: { type: 'string' }, source: { type: 'string' },
        },
      },
    },
    points_a_verifier: { type: 'array', items: { type: 'string' } },
    summary: {
      type: 'object', additionalProperties: false, required: ['conforme_global', 'resume'],
      properties: { conforme_global: { type: 'boolean' }, resume: { type: 'string' } },
    },
  },
}
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['documents'],
  properties: { documents: { type: 'array', items: DOC_SCHEMA } },
}

const SYSTEM = `Tu es un expert qualité qui analyse des Certificats d'Analyses (COA) de produits (agro-alimentaire / matières premières).
Le fichier fourni peut contenir PLUSIEURS certificats / produits distincts (par ex. une page = un certificat, ou plusieurs produits/lots). Tu dois produire un tableau "documents" avec UN objet PAR produit/certificat analysé. Ne fusionne jamais deux produits différents dans le même document.

Pour CHAQUE document :
1. En-tête : producteur, n° certificat, produit, n° de batch, référence échantillon, dates de fabrication/analyse/péremption, et "date_document" = la date figurant sur le certificat (date d'analyse ou d'émission). Mets "" si absent.
2. Extrais CHAQUE ligne du tableau d'analyses : section (Organoleptique / Physico-chimique / Microbiologique ou autre), paramètre, méthode, spécification attendue, résultat obtenu — recopie fidèlement les valeurs.
3. Pour chaque ligne, détermine si le résultat est COHÉRENT avec la spécification :
   - "conforme" si le résultat respecte clairement la spécification (ex. 4,47% ≤ 4,5% ; 120 ≤ 5000 ; Absence = Absence ; valeur dans l'intervalle).
   - "non_conforme" si le résultat viole la spécification (ex. 12,27% hors de [10% ; 12%]).
   - "a_verifier" si tu ne peux pas trancher mécaniquement — typiquement les critères qualitatifs (couleur, odeur) dont la valeur attendue n'est pas précisée, ou un résultat ambigu.
4. Critères qualitatifs (ex. couleur « Brun foncé » vs « OK ») : la valeur attendue dépend de la DEMANDE DU CLIENT. Si une demande client est fournie, utilise-la comme référence et cite-la comme source. Sinon, si tu connais une référence officielle (norme/réglementation), donne le verdict et cite précisément la source dans "source". Sinon "a_verifier" + ajoute un point à vérifier expliquant ce qui manque.
5. "points_a_verifier" : vérifications manuelles nécessaires (une phrase claire par item).
6. "summary.conforme_global" = true seulement si AUCUNE ligne n'est non_conforme ; "resume" = 1-2 phrases de synthèse.
Sois rigoureux : ne te fie pas à la conclusion écrite du laboratoire, recalcule toi-même la cohérence. Réponds uniquement via le format structuré demandé.`

function fileBlock(f: CoaFile): Anthropic.ContentBlockParam | null {
  const b64 = f.data.toString('base64')
  if (f.mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
  }
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.mime)) {
    return { type: 'image', source: { type: 'base64', media_type: f.mime as 'image/png', data: b64 } }
  }
  return null
}

/** Extrait un aperçu texte d'une demande client non-image (xlsx, csv, txt). */
async function demandToText(f: CoaFile): Promise<string> {
  const name = f.name.toLowerCase()
  if (f.mime.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(f.data as unknown as ArrayBuffer)
      const out: string[] = []
      wb.eachSheet(ws => {
        out.push(`# Feuille: ${ws.name}`)
        ws.eachRow(row => {
          const cells = (row.values as unknown[]).slice(1).map(v => (v == null ? '' : String(typeof v === 'object' ? JSON.stringify(v) : v)))
          if (cells.some(c => c.trim())) out.push(cells.join(' | '))
        })
      })
      return out.join('\n').slice(0, 20000)
    } catch { return '' }
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || f.mime.startsWith('text/')) {
    return f.data.toString('utf8').slice(0, 20000)
  }
  return ''
}

export async function analyzeCoa(coa: CoaFile, demand?: CoaFile | null): Promise<CoaDocument[]> {
  const client = new Anthropic()
  const content: Anthropic.ContentBlockParam[] = []

  const coaBlock = fileBlock(coa)
  if (!coaBlock) throw new Error(`Type de fichier COA non pris en charge : ${coa.mime}. Utilisez un PDF ou une image.`)
  content.push({ type: 'text', text: 'Voici le fichier de Certificat(s) d\'Analyses (COA) à analyser (il peut contenir plusieurs produits) :' })
  content.push(coaBlock)

  if (demand) {
    const demandBlock = fileBlock(demand)
    if (demandBlock) {
      content.push({ type: 'text', text: 'Voici la DEMANDE DU CLIENT (référence pour les critères qualitatifs / attentes) :' })
      content.push(demandBlock)
    } else {
      const txt = await demandToText(demand)
      if (txt) content.push({ type: 'text', text: `DEMANDE DU CLIENT (référence, extrait texte du fichier « ${demand.name} ») :\n${txt}` })
    }
  }

  const params = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming
  const msg = await client.messages.create(params)

  const textBlock = msg.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  if (!textBlock) throw new Error('Réponse IA vide.')
  const parsed = JSON.parse(textBlock.text) as { documents?: CoaDocument[] }
  return Array.isArray(parsed.documents) && parsed.documents.length ? parsed.documents : []
}
