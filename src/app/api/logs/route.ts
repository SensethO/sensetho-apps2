/**
 * POST /api/logs — enregistrer une visite de page
 * GET  /api/logs — récupérer les logs (admin seulement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─── Parsing User-Agent ────────────────────────────────────────────────────────
function parseUA(ua: string) {
  if (!ua) return { deviceType: 'unknown', browser: 'Unknown', browserVersion: '', os: 'Unknown' }

  // Device type
  const isBot     = /bot|crawler|spider|crawling|lighthouse|googlebot|bingbot|slurp|duckduck|facebookexternalhit|twitterbot/i.test(ua)
  const isTablet  = /ipad|tablet(?!.*mobile)|kindle|playbook|silk/i.test(ua)
  const isMobile  = /mobile|android.*mobile|iphone|ipod|blackberry|windows phone|opera mini|opera mobi/i.test(ua)
  const deviceType = isBot ? 'bot' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  // Browser (ordre important — Edge avant Chrome)
  let browser = 'Unknown', browserVersion = ''
  if (/edg\//i.test(ua)) {
    browser = 'Edge'; browserVersion = ua.match(/edg\/([\d.]+)/i)?.[1] ?? ''
  } else if (/opr\//i.test(ua)) {
    browser = 'Opera'; browserVersion = ua.match(/opr\/([\d.]+)/i)?.[1] ?? ''
  } else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) {
    browser = 'Chrome'; browserVersion = ua.match(/chrome\/([\d.]+)/i)?.[1] ?? ''
  } else if (/firefox\//i.test(ua)) {
    browser = 'Firefox'; browserVersion = ua.match(/firefox\/([\d.]+)/i)?.[1] ?? ''
  } else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari'; browserVersion = ua.match(/version\/([\d.]+)/i)?.[1] ?? ''
  } else if (/msie|trident/i.test(ua)) {
    browser = 'IE'; browserVersion = ua.match(/(?:msie |rv:)([\d.]+)/i)?.[1] ?? ''
  }

  // OS
  let os = 'Unknown'
  if (/windows nt 10/i.test(ua))       os = 'Windows 10/11'
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1'
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7'
  else if (/windows/i.test(ua))          os = 'Windows'
  else if (/iphone.*os ([\d_]+)/i.test(ua)) os = `iOS ${ua.match(/iphone.*os ([\d_]+)/i)?.[1]?.replace(/_/g,'.')}`
  else if (/ipad.*os ([\d_]+)/i.test(ua))   os = `iPadOS ${ua.match(/ipad.*os ([\d_]+)/i)?.[1]?.replace(/_/g,'.')}`
  else if (/android ([\d.]+)/i.test(ua))    os = `Android ${ua.match(/android ([\d.]+)/i)?.[1]}`
  else if (/mac os x ([\d_]+)/i.test(ua))   os = `macOS ${ua.match(/mac os x ([\d_]+)/i)?.[1]?.replace(/_/g,'.')}`
  else if (/linux/i.test(ua))               os = 'Linux'

  return { deviceType, browser, browserVersion: browserVersion.split('.')[0], os }
}

// ─── POST : enregistrer une visite ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      path: string
      referrer?: string
      screen?: string
      sessionId?: string
    }
    if (!body.path) return NextResponse.json({ ok: false })

    // Ignorer les routes API, assets et routes internes
    if (body.path.startsWith('/api/') || body.path.startsWith('/_next/') || body.path.startsWith('/favicon')) {
      return NextResponse.json({ ok: true })
    }

    const ua = req.headers.get('user-agent') ?? ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const { deviceType, browser, browserVersion, os } = parseUA(ua)

    // Déterminer si l'utilisateur est connecté (sans bloquer si non connecté)
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

    const admin = createAdminClient()
    let user_name: string | null = null
    let user_email: string | null = null

    if (user) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()
      user_name  = profile?.full_name ?? null
      user_email = profile?.email ?? user.email ?? null
    }

    const { data: inserted } = await admin.from('app_logs').insert({
      path:             body.path,
      is_authenticated: !!user,
      user_id:          user?.id ?? null,
      user_name,
      user_email,
      device_type:      deviceType,
      browser,
      browser_version:  browserVersion,
      os,
      screen:           body.screen ?? null,
      ip:               ip !== 'unknown' ? ip : null,
      referrer:         body.referrer || null,
      session_id:       body.sessionId ?? null,
    }).select('id').single()

    // Retourner l'ID pour permettre la mise à jour de la durée plus tard
    return NextResponse.json({ ok: true, id: inserted?.id ?? null })
  } catch {
    // Log silencieux — ne jamais bloquer l'utilisateur
    return NextResponse.json({ ok: true })
  }
}

// ─── GET : récupérer les logs (admin seulement) ────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
    const offset  = parseInt(searchParams.get('offset') ?? '0')
    const path    = searchParams.get('path')
    const device  = searchParams.get('device')
    const auth    = searchParams.get('auth') // 'true' | 'false' | null
    const search  = searchParams.get('search')
    const from    = searchParams.get('from')
    const to      = searchParams.get('to')

    let query = admin
      .from('app_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (path)   query = query.ilike('path', `%${path}%`)
    if (device) query = query.eq('device_type', device)
    if (auth === 'true')  query = query.eq('is_authenticated', true)
    if (auth === 'false') query = query.eq('is_authenticated', false)
    if (from)   query = query.gte('created_at', from)
    if (to)     query = query.lte('created_at', to)
    if (search) query = query.or(
      `user_email.ilike.%${search}%,user_name.ilike.%${search}%,path.ilike.%${search}%`
    )

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data, count })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
