/**
 * Client Graph API SharePoint — utilise le DriveID directement.
 * Ne nécessite pas SHAREPOINT_SITE_HOST / SHAREPOINT_SITE_PATH.
 */

type TokenCache = { value: string; exp: number }
const tokenCache = new Map<string, TokenCache>()

export function assertSafeId(id: string | null | undefined, label = 'id'): string {
  if (!id || typeof id !== 'string') throw new Error(`${label} manquant`)
  if (!/^[A-Za-z0-9!$%_\-~.:]{1,500}$/.test(id)) throw new Error(`${label} invalide`)
  return id
}

function getEnv() {
  const tenantId     = process.env.MS_TENANT_ID?.trim()
  const clientId     = process.env.MS_CLIENT_ID?.trim()
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim()
  const driveId      = process.env.SHAREPOINT_DRIVE_ID?.trim()
  if (!tenantId || !clientId || !clientSecret || !driveId)
    throw new Error('Variables SharePoint manquantes (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, SHAREPOINT_DRIVE_ID)')
  return { tenantId, clientId, clientSecret, driveId }
}

async function getToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = getEnv()
  const cacheKey = clientId
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.exp > Date.now() + 30_000) return cached.value

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         'https://graph.microsoft.com/.default',
      }),
      cache: 'no-store',
    }
  )
  const d = await res.json()
  if (!d.access_token) throw new Error(d.error_description || 'Token Azure échoué')
  tokenCache.set(cacheKey, { value: d.access_token, exp: Date.now() + d.expires_in * 1000 })
  return d.access_token
}

/**
 * Appelle Graph API sur /drives/{driveId}{path}.
 * Exemples de path : '/root/children', '/items/{id}/children', '/items/{id}'
 */
export async function spGraph(path: string, opts: RequestInit = {}): Promise<Response> {
  const { driveId } = getEnv()
  const token = await getToken()
  return fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...opts.headers },
    cache: 'no-store',
  })
}

/**
 * Vérifie que l'utilisateur courant est authentifié via Supabase.
 * Retourne null si OK, ou une Response 401 si non authentifié.
 */
export async function spAuthCheck(): Promise<Response | null> {
  // Import dynamique pour rester compatible avec les contextes serveur
  const { createServerClient } = await import('@supabase/ssr')
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const { NextResponse } = await import('next/server')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  return null
}
