import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from '@/lib/eudr/crypto'

// Client serveur de l'API Satelligence (docs.satelligence.com/api).
// Authentification : header Authorization: Bearer <token>. Le token est stocké
// chiffré par organisation (table satelligence_credentials) et n'est jamais exposé au navigateur.

export type SatEnv = 'production' | 'mock'

const BASES: Record<SatEnv, string> = {
  production: 'https://api.satelligence.com',
  mock: 'https://docs.satelligence.com/_mock/api',
}

export interface SatCredInfo {
  configured: boolean
  environment: SatEnv
  updatedAt?: string
}

export interface SatResult {
  ok: boolean
  status: number
  data?: unknown
  error?: string
}

async function getCred(orgId: string): Promise<{ token: string; environment: SatEnv } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('satelligence_credentials')
    .select('token_enc, environment')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data?.token_enc) return null
  return { token: decryptSecret(data.token_enc), environment: (data.environment as SatEnv) || 'production' }
}

export async function getSatelligenceInfo(orgId: string): Promise<SatCredInfo | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('satelligence_credentials')
    .select('environment, updated_at')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return null
  return { configured: true, environment: (data.environment as SatEnv) || 'production', updatedAt: data.updated_at as string }
}

/** Appel générique à l'API Satelligence avec le token de l'organisation. */
export async function satelligenceFetch(orgId: string, path: string, init: RequestInit = {}): Promise<SatResult> {
  const cred = await getCred(orgId)
  if (!cred) return { ok: false, status: 401, error: 'Aucun token Satelligence configuré pour cette organisation.' }
  const base = BASES[cred.environment] ?? BASES.production
  const url = base + (path.startsWith('/') ? path : '/' + path)

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${cred.token}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    })
  } catch (e) {
    return { ok: false, status: 0, error: 'Satelligence injoignable : ' + String((e as Error).message ?? e) }
  }

  const text = await res.text()
  let json: unknown
  try { json = text ? JSON.parse(text) : undefined } catch { json = text }

  if (!res.ok) {
    const msg = typeof json === 'string' && json
      ? json
      : (json as { message?: string; error?: string } | undefined)?.message
        ?? (json as { message?: string; error?: string } | undefined)?.error
        ?? `HTTP ${res.status}`
    return { ok: false, status: res.status, error: msg, data: json }
  }
  return { ok: true, status: res.status, data: json }
}
