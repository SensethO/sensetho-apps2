import {
  EudrEchoClient,
  EudrSubmissionClient,
  EudrRetrievalClient,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Extrait un message exploitable d'une erreur remontée par eudr-api-client.
 * La lib throw un Error enrichi : { message, httpStatus, details: { status, soapFault, rawData },
 * eudrErrors: [{code, message, technicalMessage}], originalError: <axios error> }.
 */
export function describeTracesError(err: unknown): { message: string; status?: number; detail?: string } {
  const e = err as any
  const status = e?.httpStatus ?? e?.details?.status ?? e?.response?.status ?? e?.originalError?.response?.status

  const parts: string[] = []
  if (Array.isArray(e?.eudrErrors)) {
    for (const er of e.eudrErrors) {
      const line = `${er?.code ?? ''}${er?.code ? ' — ' : ''}${er?.message ?? er?.technicalMessage ?? ''}`.trim()
      if (line) parts.push(line)
    }
  }
  const sf = e?.details?.soapFault
  if (sf) {
    if (Array.isArray(sf.errorDetails)) {
      for (const d of sf.errorDetails) {
        const line = `${d?.errorCode ?? ''}${d?.errorCode ? ' — ' : ''}${d?.message ?? d?.userFriendlyMessage ?? ''}`.trim()
        if (line) parts.push(line)
      }
    }
    if (!parts.length && sf.faultString) parts.push(String(sf.faultString))
  }

  let detail: string | undefined = parts.length ? parts.join('\n') : undefined
  if (!detail) {
    const raw = e?.details?.rawData ?? e?.originalError?.response?.data ?? e?.response?.data
    if (typeof raw === 'string') detail = raw.slice(0, 2000)
    else if (raw) { try { detail = JSON.stringify(raw).slice(0, 2000) } catch { /* ignore */ } }
  }
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
// V1 = version en service (V2 discontinuée côté serveur EUDR ; échec « use the V3 API endpoints »).
export function makeSubmissionClient(creds: TracesCredentials): EudrSubmissionClient {
  return new EudrSubmissionClient(baseConfig(creds))
}
export function makeRetrievalClient(creds: TracesCredentials): EudrRetrievalClient {
  return new EudrRetrievalClient(baseConfig(creds))
}
