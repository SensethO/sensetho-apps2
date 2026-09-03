import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_PAGES = 40
const UA = 'Mozilla/5.0 (compatible; GreenClaimsBot/1.0; +https://apps.sensetho.com)'

async function canAccess(userId: string, diagId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('green_claims_diagnostics').select('user_id').eq('id', diagId).single()
  return data?.user_id === userId
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal })
    if (!r.ok) return null
    return await r.text()
  } catch { return null }
  finally { clearTimeout(to) }
}

const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|pdf|zip|rar|mp4|mp3|avi|woff2?|ttf|eot|xml|json|rss|txt)($|\?)/i

/** POST /api/green-claims/[id]/discover-site — { url } → pages du même domaine (liens internes + sitemap) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    let base = String(body?.url ?? '').trim()
    if (!base) return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base
    let baseUrl: URL
    try { baseUrl = new URL(base) } catch { return NextResponse.json({ error: 'URL invalide' }, { status: 400 }) }
    const host = baseUrl.host
    const origin = baseUrl.origin
    const norm = (h: string) => h.replace(/^www\./i, '')
    const nhost = norm(host)

    const found = new Set<string>()
    const add = (u: URL) => {
      if (norm(u.host) !== nhost) return // www.x et x traités comme le même site
      if (ASSET_RE.test(u.pathname)) return
      found.add(origin + u.pathname) // hôte canonique (base) → déduplique www / non-www et http / https
    }
    add(baseUrl)

    // 1) Liens internes de la page fournie
    const html = await fetchText(base)
    if (html) {
      const re = /href\s*=\s*["']([^"'#\s]+)["']/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null) {
        const raw = m[1].trim()
        if (/^(mailto:|tel:|javascript:|data:|#)/i.test(raw)) continue
        try {
          const abs = new URL(raw, base)
          if (abs.protocol === 'http:' || abs.protocol === 'https:') add(abs)
        } catch { /* lien invalide ignoré */ }
        if (found.size > 120) break
      }
    }

    // 2) Sitemap (+ index de sitemaps, borné)
    let fromSitemap = false
    const smText = await fetchText(origin + '/sitemap.xml')
    if (smText) {
      const locs = Array.from(smText.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map(x => x[1].trim())
      const childSitemaps = locs.filter(l => /sitemap[^/]*\.xml($|\?)/i.test(l)).slice(0, 3)
      const pageLocs = locs.filter(l => !/\.xml($|\?)/i.test(l))
      for (const cs of childSitemaps) {
        const ct = await fetchText(cs)
        if (ct) Array.from(ct.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).forEach(x => pageLocs.push(x[1].trim()))
      }
      for (const l of pageLocs) {
        try { const u = new URL(l); if (norm(u.host) === nhost && !ASSET_RE.test(u.pathname)) { add(u); fromSitemap = true } } catch { /* ignore */ }
        if (found.size > 200) break
      }
    }

    // Tri : la page de base d'abord, puis par longueur de chemin (pages de 1er niveau prioritaires)
    const baseKey = baseUrl.origin + baseUrl.pathname
    const pages = Array.from(found).sort((a, b) => {
      if (a === baseKey) return -1
      if (b === baseKey) return 1
      const da = a.split('/').length, db = b.split('/').length
      return da !== db ? da - db : a.localeCompare(b)
    }).slice(0, MAX_PAGES)

    return NextResponse.json({ data: { origin, pages, fromSitemap, count: pages.length } })
  } catch (err) {
    console.error('[green-claims/discover-site]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
