import {
  EudrEchoClient,
  EudrSubmissionClientV2,
  EudrRetrievalClientV2,
} from 'eudr-api-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from './crypto'

/**
 * Résolution des identifiants Web Service EUDR TRACES d'une organisation et
 * fabrication des clients SOAP (Echo / Submission V2 / Retrieval V2).
 *
 * webServiceClientId :
 *   - acceptation : 'eudr-test'  → endpoint acceptance.eudr.webcloud.ec.europa.eu
 *   - production  : 'eudr-repository' → endpoint eudr.webcloud.ec.europa.eu
 */

export type TracesEnvironment = 'acceptance' | 'production'

export interface TracesCredentials {
  username: string
  authKey: string
  environment: TracesEnvironment
  clientId: string
}

/** Métadonnées non sensibles (pour affichage : jamais la clé). */
export interface TracesCredentialInfo {
  username: string
  environment: TracesEnvironment
  clientId: string
  updatedAt: string | null
}

export function clientIdFor(env: TracesEnvironment): string {
  return env === 'production' ? 'eudr-repository' : 'eudr-test'
}

/** Extrait un message exploitable d'une erreur SOAP/axios (statut HTTP + corps du fault). */
export function describeTracesError(err: unknown): { message: string; status?: number; detail?: string } {
  const e = err as { message?: string; response?: { status?: number; data?: unknown } }
  const status = e?.response?.status
  const data = e?.response?.data
  let detail: string | undefined
  if (typeof data === 'string') detail = data.slice(0, 2000)
  else if (data) { try { detail = JSON.stringify(data).slice(0, 2000) } catch { /* ignore */ } }
  return { message: e?.message ?? String(err), status, detail }
}

/** Charge et déchiffre les identifiants TRACES d'une organisation, ou null si absent. */
export async function getTracesCredentials(orgId: string): Promise<TracesCredentials | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('eudr_traces_credentials')
    .select('username, auth_key_enc, environment, client_id')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return null
  return {
    username: data.username as string,
    authKey: decryptSecret(data.auth_key_enc as string),
    environment: (data.environment as TracesEnvironment) ?? 'acceptance',
    clientId: (data.client_id as string) ?? clientIdFor((data.environment as TracesEnvironment) ?? 'acceptance'),
  }
}

/** Métadonnées d'affichage (présence + username + env), sans la clé. */
export async function getTracesCredentialInfo(orgId: string): Promise<TracesCredentialInfo | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('eudr_traces_credentials')
    .select('username, environment, client_id, updated_at')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return null
  return {
    username: data.username as string,
    environment: (data.environment as TracesEnvironment) ?? 'acceptance',
    clientId: (data.client_id as string) ?? 'eudr-test',
    updatedAt: (data.updated_at as string) ?? null,
  }
}

function baseConfig(creds: TracesCredentials) {
  return {
    username: creds.username,
    password: creds.authKey,
    webServiceClientId: creds.clientId,
    timeout: 20000,
    ssl: true,
  }
}

export function makeEchoClient(creds: TracesCredentials): EudrEchoClient {
  return new EudrEchoClient(baseConfig(creds))
}
export function makeSubmissionClient(creds: TracesCredentials): EudrSubmissionClientV2 {
  return new EudrSubmissionClientV2(baseConfig(creds))
}
export function makeRetrievalClient(creds: TracesCredentials): EudrRetrievalClientV2 {
  return new EudrRetrievalClientV2(baseConfig(creds))
}
