import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const PUBLIC_ROUTES = [
  '/',
  '/catalogue',
  '/devis',
  '/mentions-legales',
  '/cgv',
  '/cgu',
  '/politique-de-confidentialite',
  '/auth/login',
  '/auth/register',
  '/auth/pending',
  '/auth/forgot-password',
  '/auth/signout',
  '/auth/callback',
  '/hebergement-responsable', // page publique : engagements d'hébergement
  '/enquete',           // page publique questionnaire parties prenantes
  '/api/pp-survey/',    // API publique données enquête
  '/api/pp-track/',     // tracking email (pixel + clic)
  '/miroir/',              // Le Miroir : participation par lien d'invitation (sans compte)
  '/api/le-miroir/public/', // API publique du Miroir (le jeton authentifie)
]

const AUTH_PAGES = ['/auth/login', '/auth/register', '/auth/forgot-password']
const ADMIN_ROUTES = ['/admin']

// ── Coupe-circuit : rate limit par IP (fenêtre glissante, en mémoire) ───────────
// Garde-fou contre les boucles de rafraîchissement emballées (incident quotas
// Vercel/Supabase du 30/07/2026). Best-effort par isolate : plafonne un flot
// soutenu venant d'une même IP AVANT tout appel Supabase/fonction, ce qui coupe
// la source principale du coût (invocations + événements Observability).
const RL_WINDOW_MS = 60_000
const RL_MAX_REQUESTS = 300 // ~5 req/s soutenu/IP : généreux (zéro gêne pour un usage humain normal) mais borne les dégâts d'une boucle emballée. Ajustable.
const rlHits = new Map<string, number[]>()

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (rlHits.get(ip) ?? []).filter(t => now - t < RL_WINDOW_MS)
  recent.push(now)
  rlHits.set(ip, recent)
  if (rlHits.size > 5_000) {
    for (const [key, times] of rlHits) {
      if (!times.some(t => now - t < RL_WINDOW_MS)) rlHits.delete(key)
    }
  }
  return recent.length > RL_MAX_REQUESTS
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Coupe-circuit : au-delà du seuil, on renvoie 429 immédiatement (aucun appel en aval).
  if (pathname.startsWith('/api/') && isRateLimited(getClientIp(request))) {
    return new NextResponse(
      JSON.stringify({ error: 'Trop de requêtes — merci de ralentir (rate limit).' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } },
    )
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublic = PUBLIC_ROUTES.some(r => pathname === r || (r !== '/' && pathname.startsWith(r)))
  const isAuthPage = AUTH_PAGES.some(r => pathname.startsWith(r))
  const isPendingPage = pathname.startsWith('/auth/pending')
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isApiRoute = pathname.startsWith('/api/')
  const isAccountRoute = pathname === '/account' || pathname.startsWith('/account/')

  // Non connecté → login (les routes /api/ gèrent leur propre auth — pas de redirect)
  if (!user && !isPublic && !isApiRoute) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Connecté sur page auth (sauf /auth/pending) → dashboard
  if (user && isAuthPage && !isPendingPage) {
    const next = new URL(request.url).searchParams.get('next')
    const destination = (next && next.startsWith('/')) ? next : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Vérifie le profil pour les routes protégées (pas les API ni les routes publiques)
  if (user && !isPublic && !isAuthPage && !isApiRoute) {
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, status, must_change_password')
      .eq('id', user.id)
      .single()

    // Compte en attente de validation → page d'attente
    if (profile?.status === 'pending') {
      return NextResponse.redirect(new URL('/auth/pending', request.url))
    }

    // Compte suspendu → page d'attente (même page, message adapté)
    if (profile?.status === 'suspended') {
      return NextResponse.redirect(new URL('/auth/pending', request.url))
    }

    // Forcer le changement de mot de passe (sauf si déjà sur /account)
    if (profile?.must_change_password && !isAccountRoute) {
      const url = new URL('/account', request.url)
      url.searchParams.set('forced', 'true')
      return NextResponse.redirect(url)
    }

    // Route admin → vérifier le rôle admin
    if (isAdminRoute && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Utilisateur connecté qui tente d'accéder à /auth/pending alors qu'il est actif
  if (user && isPendingPage) {
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await adminClient
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (profile?.status === 'active') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.ico).*)'],
}
