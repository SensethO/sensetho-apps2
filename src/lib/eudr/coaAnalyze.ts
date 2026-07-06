import Anthropic from '@anthropic-ai/sdk'

/**
 * Analyse d'un COA (Certificate of Analysis) par Claude (vision).
 * Extrait l'en-tête + le tableau (paramètre/méthode/spécification/résultat),
 * pré-évalue la conformité et liste les points à vérifier. Si une « demande
 * client » est fournie, elle sert de référence pour les items qualitatifs.
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
export interface CoaExtraction {
  header: {
    producteur: string; numero_certificat: string; produit: string; numero_batch: string
    reference_echantillon: string; date_fabrication: string; date_analyse: string; date_peremption: string
  }
  rows: CoaRow[]
  points_a_verifier: string[]
  summary: { conforme_global: boolean; resume: string }
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['header', 'rows', 'points_a_verifier', 'summary'],
  properties: {
    header: {
      type: 'object', additionalProperties: false,
      required: ['producteur', 'numero_certificat', 'produit', 'numero_batch', 'reference_echantillon', 'date_fabrication', 'date_analyse', 'date_peremption'],
      properties: {
        producteur: { type: 'string' }, numero_certificat: { type: 'string' }, produit: { type: 'string' },
        numero_batch: { type: 'string' }, reference_echantillon: { type: 'string' },
        date_fabrication: { type: 'string' }, date_analyse: { type: 'string' }, date_peremption: { type: 'string' },
      },
    },
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

const SYSTEM = `Tu es un expert qualité qui analyse des Certificats d'Analyses (COA) de produits (agro-alimentaire / matières premières).
À partir de l'image/PDF du COA fourni, tu dois :
1. Extraire l'en-tête (producteur, n° certificat, produit, n° de batch, référence échantillon, dates de fabrication/analyse/péremption). Mets "" si absent.
2. Extraire CHAQUE ligne du tableau d'analyses avec sa section (Organoleptique / Physico-chimique / Microbiologique ou autre), le paramètre, la méthode, la spécification attendue et le résultat obtenu — recopie fidèlement les valeurs telles qu'écrites.
3. Pour chaque ligne, déterminer si le résultat est COHÉRENT avec la spécification :
   - "conforme" si le résultat respecte clairement la spécification (ex. 4,47% ≤ 4,5% ; 120 ≤ 5000 ; Absence = Absence ; valeur dans l'intervalle).
   - "non_conforme" si le résultat viole la spécification (ex. 12,27% hors de [10% ; 12%]).
   - "a_verifier" si tu ne peux pas trancher mécaniquement — typiquement les critères qualitatifs (couleur, odeur) dont la valeur attendue n'est pas précisée, ou un résultat ambigu.
4. Pour les critères qualitatifs (ex. couleur « Brun foncé » vs résultat « OK ») : la valeur attendue dépend généralement de la DEMANDE DU CLIENT. Si une demande client est fournie, utilise-la comme référence et cite-la comme source. Sinon, si tu connais une référence officielle (norme/réglementation), donne le verdict et cite précisément la source dans le champ "source". Si tu n'as ni l'une ni l'autre, mets "a_verifier" et ajoute un point à vérifier manuellement expliquant ce qui manque (ex. « Couleur : la teinte exacte attendue n'est pas spécifiée dans le COA »).
5. Remplir "points_a_verifier" : liste des vérifications manuelles nécessaires (chaque item = une phrase claire).
6. "summary.conforme_global" = true seulement si AUCUNE ligne n'est non_conforme ; "resume" = 1-2 phrases de synthèse en français.
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

export async function analyzeCoa(coa: CoaFile, demand?: CoaFile | null): Promise<CoaExtraction> {
  const client = new Anthropic()
  const content: Anthropic.ContentBlockParam[] = []

  const coaBlock = fileBlock(coa)
  if (!coaBlock) throw new Error(`Type de fichier COA non pris en charge : ${coa.mime}. Utilisez un PDF ou une image.`)
  content.push({ type: 'text', text: 'Voici le Certificat d\'Analyses (COA) à analyser :' })
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
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming
  const msg = await client.messages.create(params)

  const textBlock = msg.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  if (!textBlock) throw new Error('Réponse IA vide.')
  return JSON.parse(textBlock.text) as CoaExtraction
}
