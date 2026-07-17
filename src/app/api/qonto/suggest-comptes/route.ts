/**
 * POST /api/qonto/suggest-comptes
 * Ventilation automatique : propose pour chaque transaction bancaire Qonto le
 * compte du plan comptable le plus approprié (IA claude, sortie structurée).
 * Rien n'est stocké — les libellés transitent vers l'API Anthropic puis sont
 * renvoyés au navigateur avec la suggestion.
 *
 * Body : {
 *   organisation_id: string,
 *   plan: 'association' | 'entreprise',
 *   transactions: [{ transaction_id, label, category, side, amount }],
 *   comptes: [{ numero, nom, type }]   // feuilles uniquement
 * }
 * Réponse : { suggestions: { [transaction_id]: { numero, confiance } } }
 *
 * @see docs/RSE_APP_PATTERN.md (conventions routes) — modèle IA : voir coaAnalyze.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireOrgOwner } from '@/lib/qonto/connections'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'claude-haiku-4-5-20251001'
const CHUNK = 150

interface TxIn { transaction_id: string; label: string; category: string | null; side: 'debit' | 'credit'; amount: number }
interface CompteIn { numero: string; nom: string; type: string }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['transaction_id', 'numero', 'confiance'],
        properties: {
          transaction_id: { type: 'string' },
          numero: { type: 'string', description: 'Numéro du compte choisi, parmi la liste fournie uniquement' },
          confiance: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
        },
      },
    },
  },
} as const

function systemPrompt(plan: string): string {
  return [
    'Tu es un expert-comptable français. On te donne des transactions bancaires (libellé, catégorie Qonto, sens, montant)',
    plan === 'entreprise'
      ? 'et le plan comptable général d’une entreprise (comptes typés charge/produit/actif/passif).'
      : 'et le plan comptable associatif (loi 1901) d’une association (comptes de charges et de produits).',
    'Pour CHAQUE transaction, choisis le compte le plus approprié PARMI LA LISTE FOURNIE (réponds par son numéro exact).',
    'Règles : un débit va normalement vers un compte de charge (ex. télécom → 626, carburant/péage/déplacements → 625 ou 606x,',
    'honoraires → 622, frais bancaires → 627, logiciels/services en ligne → 611 ou 618, publicité → 623) ;',
    'un crédit va normalement vers un compte de produit (ventes 70x, subventions 74, dons 75x…).',
    plan === 'entreprise'
      ? 'Exceptions bilan : acquisition d’immobilisation → compte d’actif (2x), remboursement/souscription d’emprunt → passif (16x), virement interne/TVA → compte de tiers approprié si présent dans la liste.'
      : '',
    'Confiance : « haute » si le libellé est explicite, « moyenne » si tu déduis de la catégorie, « faible » si tu choisis un compte générique par défaut.',
    'Réponds pour toutes les transactions, sans exception.',
  ].filter(Boolean).join(' ')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      organisation_id?: string
      plan?: string
      transactions?: TxIn[]
      comptes?: CompteIn[]
    }
    const { organisation_id, plan = 'association', transactions = [], comptes = [] } = body
    if (!organisation_id) return NextResponse.json({ error: 'organisation_id requis' }, { status: 400 })
    const guard = await requireOrgOwner(organisation_id)
    if (guard instanceof NextResponse) return guard
    if (!transactions.length) return NextResponse.json({ error: 'Aucune transaction' }, { status: 400 })
    if (!comptes.length) return NextResponse.json({ error: 'Aucun compte fourni' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Ventilation IA non configurée (clé API absente).' }, { status: 503 })

    const client = new Anthropic()
    const numeros = new Set(comptes.map(c => c.numero))
    const planText = comptes.map(c => `${c.numero} — ${c.nom} [${c.type}]`).join('\n')
    const suggestions: Record<string, { numero: string; confiance: string }> = {}

    for (let i = 0; i < transactions.length; i += CHUNK) {
      const chunk = transactions.slice(i, i + CHUNK)
      const txText = chunk.map(t =>
        `${t.transaction_id} | ${t.side === 'debit' ? 'DÉBIT' : 'CRÉDIT'} ${Math.abs(t.amount).toFixed(2)} € | catégorie: ${t.category ?? '—'} | ${t.label}`
      ).join('\n')
      const params = {
        model: MODEL,
        max_tokens: 8000,
        system: systemPrompt(plan),
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: `PLAN COMPTABLE DISPONIBLE :\n${planText}\n\nTRANSACTIONS À VENTILER :\n${txText}`,
        }],
      } as unknown as Anthropic.MessageCreateParamsNonStreaming
      const msg = await client.messages.create(params)
      const textBlock = msg.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
      if (!textBlock) continue
      const parsed = JSON.parse(textBlock.text) as { suggestions?: { transaction_id: string; numero: string; confiance: string }[] }
      for (const s of parsed.suggestions ?? []) {
        if (numeros.has(s.numero)) suggestions[s.transaction_id] = { numero: s.numero, confiance: s.confiance }
      }
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
