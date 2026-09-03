import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { aiErrorResponse } from '@/lib/aiError'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function canAccess(userId: string, diagId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('green_claims_diagnostics').select('user_id').eq('id', diagId).single()
  return data?.user_id === userId
}

function extractText(html: string): string {
  let t = html
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  t = t.replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  t = t.replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
  t = t.replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
  t = t.replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, '\n')
  t = t.replace(/<[^>]+>/g, ' ')
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&eacute;/gi, 'é').replace(/&egrave;/gi, 'è')
    .replace(/&agrave;/gi, 'à').replace(/&ccedil;/gi, 'ç').replace(/&ocirc;/gi, 'ô').replace(/&#\d+;/g, ' ')
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
  return t.slice(0, 4000)
}

const TYPES = ['explicite', 'generique', 'comparative', 'label-certification']
const DOMAINS = ['general', 'carbone', 'energie', 'eau', 'biodiversite', 'dechets']
const SCOPES = ['produit-entier', 'composant', 'service', 'entreprise-entiere']

/** POST /api/green-claims/[id]/scan-website — { url } → allégations détectées sur la page */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Analyse IA non configurée (clé absente).' }, { status: 503 })

    const body = await req.json()
    let target = String(body?.url ?? '').trim()
    if (!target) return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target
    try { new URL(target) } catch { return NextResponse.json({ error: 'URL invalide' }, { status: 400 }) }

    // Récupération de la page (timeout 10 s)
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 10000)
    let html = ''
    try {
      const r = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GreenClaimsBot/1.0; +https://apps.sensetho.com)' }, signal: ctrl.signal })
      if (!r.ok) { clearTimeout(to); return NextResponse.json({ error: `Page inaccessible (HTTP ${r.status})` }, { status: 502 }) }
      html = await r.text()
    } catch {
      clearTimeout(to)
      return NextResponse.json({ error: 'Impossible de charger la page (timeout ou blocage).' }, { status: 502 })
    }
    clearTimeout(to)

    const pageText = extractText(html)
    if (!pageText) return NextResponse.json({ data: { url: target, page_length: 0, claims: [], count: 0 } })

    const prompt = `Tu es un expert de la Directive Green Claims UE (2024/825/EU). Analyse ce texte extrait du site "${target}" et identifie TOUTES les allégations environnementales ou écologiques présentes.

TEXTE DE LA PAGE :
${pageText}

Pour chaque allégation trouvée, retourne un objet JSON avec ces champs :
- "text" : le texte exact ou reformulé fidèlement de l'allégation (max 200 caractères)
- "type" : "generique" (vague, ex: "éco-responsable") | "explicite" (chiffrée/précise) | "comparative" (vs concurrent/baseline) | "label-certification" (certification)
- "domain" : "general" | "carbone" | "energie" | "eau" | "biodiversite" | "dechets"
- "scope" : "produit-entier" | "composant" | "service" | "entreprise-entiere"
- "source_context" : courte phrase du contexte sur la page (max 100 chars)

Retourne UNIQUEMENT un tableau JSON valide. Si aucune allégation environnementale, retourne [].
Exemple : [{"text":"...","type":"generique","domain":"general","scope":"entreprise-entiere","source_context":"..."}]`

    let raw: string
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = (msg.content[0] as { text: string }).text
    } catch (err) {
      console.error('[green-claims/scan-website] AI', err)
      const { message, status } = aiErrorResponse(err)
      return NextResponse.json({ error: message }, { status })
    }

    let parsed: unknown[] = []
    try { const m = raw.match(/\[[\s\S]*\]/); if (m) parsed = JSON.parse(m[0]) } catch { parsed = [] }
    const claims = (Array.isArray(parsed) ? parsed : [])
      .filter((c): c is Record<string, unknown> => !!c && typeof (c as Record<string, unknown>).text === 'string')
      .map((c) => ({
        text: String(c.text).slice(0, 300),
        type: TYPES.includes(String(c.type)) ? String(c.type) : 'generique',
        domain: DOMAINS.includes(String(c.domain)) ? String(c.domain) : 'general',
        scope: SCOPES.includes(String(c.scope)) ? String(c.scope) : 'entreprise-entiere',
        source_context: typeof c.source_context === 'string' ? c.source_context.slice(0, 160) : '',
      }))

    return NextResponse.json({ data: { url: target, page_length: pageText.length, claims, count: claims.length } })
  } catch (err) {
    console.error('[green-claims/scan-website]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
