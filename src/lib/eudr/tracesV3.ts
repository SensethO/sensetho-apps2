// Client SOAP EUDR TRACES V3 (dépôt/vérif DDS). @see docs/MAINTENANCE.md §6 · docs/README.md
import crypto from 'node:crypto'
import type { TracesCredentials } from './tracesClient'

/**
 * Client SOAP EUDR **V3** (fait main).
 * Le package eudr-api-client ne gère que V1/V2, désormais désactivées côté serveur
 * (« use the V3 API endpoints »). On implémente ici le service V3 :
 *   EUDRDueDiligenceStatementServiceV3 — opérations submitDds / getDdsByIdentifiers.
 * WS-Security UsernameToken (PasswordDigest SHA1), identique à l'Echo déjà validé.
 */

const HOST = {
  acceptance: 'https://acceptance.eudr.webcloud.ec.europa.eu/tracesnt',
  production: 'https://eudr.webcloud.ec.europa.eu/tracesnt',
}
const DDS_PATH = '/ws/EUDRDueDiligenceStatementServiceV3'
const NS_DDS = 'http://ec.europa.eu/tracesnt/certificate/eudr/due-diligence-statement/v3'
const ACTION_SUBMIT = `${NS_DDS}/submitDds`
const ACTION_GET_BY_ID = `${NS_DDS}/getDdsByIdentifiers`
const ACTION_GET_DDS = `${NS_DDS}/getDds`
const ACTION_WITHDRAW = `${NS_DDS}/withdrawDds`
const ACTION_AMEND = `${NS_DDS}/amendDds`

function endpoint(creds: TracesCredentials): string {
  return (creds.environment === 'production' ? HOST.production : HOST.acceptance) + DDS_PATH
}

function xml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** En-tête WS-Security UsernameToken (PasswordDigest = base64(sha1(nonce+created+password))). */
function securityHeader(creds: TracesCredentials): string {
  const nonce = crypto.randomBytes(16)
  const created = new Date().toISOString()
  const expires = new Date(Date.now() + 60_000).toISOString()
  const digest = crypto
    .createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(creds.authKey)]))
    .digest('base64')
  return `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" soapenv:mustUnderstand="1">
    <wsu:Timestamp wsu:Id="TS-1"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>
    <wsse:UsernameToken wsu:Id="UT-1">
      <wsse:Username>${xml(creds.username)}</wsse:Username>
      <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>
      <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</wsse:Nonce>
      <wsu:Created>${created}</wsu:Created>
    </wsse:UsernameToken>
  </wsse:Security>
  <v4:WebServiceClientId>${xml(creds.clientId)}</v4:WebServiceClientId>`
}

function envelope(creds: TracesCredentials, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v4="http://ec.europa.eu/sanco/tracesnt/base/v4" xmlns:dds="${NS_DDS}" xmlns:eudrCommon="http://ec.europa.eu/tracesnt/certificate/eudr/common/v3">
  <soapenv:Header>${securityHeader(creds)}</soapenv:Header>
  <soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`
}

// ── Types du statement (structure indépendante de la version, mappée en V3 ici) ──
interface GoodsMeasure { netWeight?: number; percentageEstimationOrDeviation?: number; supplementaryUnit?: number; supplementaryUnitQualifier?: string }
interface Producer { country?: string; name?: string; geometryGeojson?: unknown }
interface Commodity { descriptors?: { descriptionOfGoods?: string; goodsMeasure?: GoodsMeasure }; hsHeading?: string; speciesInfo?: { scientificName?: string; commonName?: string }; producers?: Producer[] }
export interface DdsStatement {
  internalReferenceNumber?: string
  activityType?: string
  countryOfActivity?: string
  borderCrossCountry?: string
  commodities?: Commodity[]
  geoLocationConfidential?: boolean
}

function toBase64Geo(g: unknown): string {
  if (g == null) return ''
  if (typeof g === 'object') return Buffer.from(JSON.stringify(g)).toString('base64')
  const s = String(g).trim()
  if (s.startsWith('{')) return Buffer.from(s).toString('base64')
  return s // supposé déjà en base64
}

function goodsMeasureXml(m?: GoodsMeasure): string {
  if (!m) return ''
  // Ordre imposé par le XSD common/v3 : percentageEstimationOrDeviation, netWeight, supplementaryUnit, qualifier.
  let x = '<eudrCommon:goodsMeasure>'
  if (m.percentageEstimationOrDeviation != null) x += `<eudrCommon:percentageEstimationOrDeviation>${xml(m.percentageEstimationOrDeviation)}</eudrCommon:percentageEstimationOrDeviation>`
  if (m.netWeight != null) x += `<eudrCommon:netWeight>${xml(m.netWeight)}</eudrCommon:netWeight>`
  if (m.supplementaryUnit != null) x += `<eudrCommon:supplementaryUnit>${xml(m.supplementaryUnit)}</eudrCommon:supplementaryUnit>`
  if (m.supplementaryUnitQualifier) x += `<eudrCommon:supplementaryUnitQualifier>${xml(m.supplementaryUnitQualifier)}</eudrCommon:supplementaryUnitQualifier>`
  x += '</eudrCommon:goodsMeasure>'
  return x
}

function commodityXml(c: Commodity, position: number): string {
  let x = `<dds:commodities><dds:position>${position}</dds:position>`
  x += '<dds:descriptors>'
  if (c.descriptors?.descriptionOfGoods) x += `<eudrCommon:descriptionOfGoods>${xml(c.descriptors.descriptionOfGoods)}</eudrCommon:descriptionOfGoods>`
  x += goodsMeasureXml(c.descriptors?.goodsMeasure)
  x += '</dds:descriptors>'
  if (c.hsHeading) x += `<dds:hsHeading>${xml(c.hsHeading)}</dds:hsHeading>`
  if (c.speciesInfo && (c.speciesInfo.scientificName || c.speciesInfo.commonName)) {
    x += '<dds:speciesInfo>'
    if (c.speciesInfo.scientificName) x += `<dds:scientificName>${xml(c.speciesInfo.scientificName)}</dds:scientificName>`
    if (c.speciesInfo.commonName) x += `<dds:commonName>${xml(c.speciesInfo.commonName)}</dds:commonName>`
    x += '</dds:speciesInfo>'
  }
  const producers = Array.isArray(c.producers) ? c.producers : c.producers ? [c.producers] : []
  producers.forEach((p, i) => {
    x += `<dds:producers><dds:position>${i + 1}</dds:position>`
    if (p.country) x += `<dds:country>${xml(p.country)}</dds:country>`
    if (p.name) x += `<dds:name>${xml(p.name)}</dds:name>`
    const geo = toBase64Geo(p.geometryGeojson)
    if (geo) x += `<dds:geometryGeojson>${geo}</dds:geometryGeojson>`
    x += '</dds:producers>'
  })
  x += '</dds:commodities>'
  return x
}

function statementXml(s: DdsStatement): string {
  let x = '<dds:statement>'
  x += `<dds:internalReferenceNumber>${xml(s.internalReferenceNumber)}</dds:internalReferenceNumber>`
  x += `<dds:activityType>${xml(s.activityType)}</dds:activityType>`
  if (s.countryOfActivity) x += `<dds:countryOfActivity>${xml(s.countryOfActivity)}</dds:countryOfActivity>`
  if (s.borderCrossCountry) x += `<dds:borderCrossCountry>${xml(s.borderCrossCountry)}</dds:borderCrossCountry>`
  const commodities = Array.isArray(s.commodities) ? s.commodities : s.commodities ? [s.commodities] : []
  commodities.forEach((c, i) => { x += commodityXml(c, i + 1) })
  x += `<dds:geoLocationConfidential>${s.geoLocationConfidential ? 'true' : 'false'}</dds:geoLocationConfidential>`
  x += '</dds:statement>'
  return x
}

/** Erreur enrichie compatible describeTracesError (statut HTTP + fault brut/parsé). */
function soapError(status: number, rawBody: string): Error & Record<string, unknown> {
  const faultMatch = rawBody.match(/<faultstring>([\s\S]*?)<\/faultstring>/i)
  const err = new Error(faultMatch ? faultMatch[1].trim() : `HTTP ${status}`) as Error & Record<string, unknown>
  err.httpStatus = status
  err.details = { status, rawData: rawBody }
  // Codes d'erreur métier EUDR éventuels (EUDR_xxx)
  const codes = [...rawBody.matchAll(/(EUDR_[A-Z0-9_]+)/g)].map(m => m[1])
  if (codes.length) err.eudrErrors = [...new Set(codes)].map(c => ({ code: c, message: '' }))
  return err
}

async function post(creds: TracesCredentials, soapAction: string, body: string): Promise<string> {
  const res = await fetch(endpoint(creds), {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: soapAction },
    body: envelope(creds, body),
  })
  const text = await res.text()
  if (!res.ok || /<(\w+:)?Fault>/i.test(text)) throw soapError(res.status, text)
  return text
}

/** submitDds V3 → renvoie l'UUID de la déclaration créée. */
export async function submitDdsV3(
  creds: TracesCredentials,
  request: { operatorRole: string; statement: DdsStatement },
): Promise<{ uuid: string | null; raw: string }> {
  const body = `<dds:SubmitDdsRequest><dds:operatorRole>${xml(request.operatorRole)}</dds:operatorRole>${statementXml(request.statement)}</dds:SubmitDdsRequest>`
  const raw = await post(creds, ACTION_SUBMIT, body)
  const uuid = (raw.match(/<[^>]*:?uuid>([^<]+)<\/[^>]*:?uuid>/i) || [])[1] || null
  return { uuid, raw }
}

function pick(raw: string, tag: string): string | null {
  // (?:\w+:)? = préfixe de namespace optionnel, puis le nom EXACT — sinon `referenceNumber`
  // capturait aussi `internalReferenceNumber` (le local-name doit correspondre pile).
  const m = raw.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]+)</(?:\\w+:)?${tag}>`, 'i'))
  return m ? m[1] : null
}

/**
 * getDds V3 (par UUID) → renvoie l'aperçu : n° de référence, n° de vérification, statut.
 * Ces numéros ne sont attribués qu'une fois la DDS traitée (statut AVAILABLE).
 */
export async function getDdsV3(
  creds: TracesCredentials,
  uuid: string,
): Promise<{ referenceNumber: string | null; verificationNumber: string | null; status: string | null; internalReferenceNumber: string | null; date: string | null; updatedBy: string | null; raw: string }> {
  const body = `<dds:GetDdsRequest><dds:uuidList>${xml(uuid)}</dds:uuidList></dds:GetDdsRequest>`
  const raw = await post(creds, ACTION_GET_DDS, body)
  return {
    referenceNumber: pick(raw, 'referenceNumber'),
    verificationNumber: pick(raw, 'verificationNumber'),
    status: pick(raw, 'status'),
    internalReferenceNumber: pick(raw, 'internalReferenceNumber'),
    date: pick(raw, 'date'),
    updatedBy: pick(raw, 'updatedBy'),
    raw,
  }
}

/**
 * Test de connexion/authentification via le service V3 (l'ancien service Echo V1/V2
 * a été retiré côté serveur EUDR — 404). On tente un getDdsByIdentifiers avec des
 * identifiants factices : une réponse métier (« Data error » / DDS introuvable) prouve
 * que l'authentification WS-Security est passée ; une faute de sécurité = mauvais identifiants.
 */
export async function pingV3(creds: TracesCredentials): Promise<{ ok: boolean; kind: 'ok' | 'auth' | 'error'; message: string; detail?: string }> {
  try {
    await getDdsByIdentifiersV3(creds, 'PINGTEST0000', 'PING0000')
    return { ok: true, kind: 'ok', message: 'Connexion et authentification réussies.' }
  } catch (err) {
    const e = err as Record<string, unknown>
    const status = e.httpStatus as number | undefined
    const raw = String(((e.details as Record<string, unknown> | undefined)?.rawData as string) ?? '')
    const msg = String((e.message as string) ?? '')
    const blob = (msg + ' ' + raw).toLowerCase()
    if (/authenticat|failedauthentication|wsse|username|password|credential|not authoriz|invalid.*(token|security)|access.*deni|\b401\b|\b403\b/.test(blob)) {
      return { ok: false, kind: 'auth', message: 'Authentification refusée — vérifiez le nom d’utilisateur (identifiant EU Login) et la clé Web Service.', detail: msg }
    }
    if (/data error|no dds|not found|does not exist|reference|verification|eudr_/.test(blob) || status === 200) {
      return { ok: true, kind: 'ok', message: 'Connexion et authentification réussies (réponse métier reçue).' }
    }
    return { ok: false, kind: 'error', message: msg || `Erreur ${status ?? ''}`.trim(), detail: raw ? raw.slice(0, 500) : undefined }
  }
}

/** amendDds V3 → modifie une DDS existante (même n° de référence, fenêtre 72 h). */
export async function amendDdsV3(creds: TracesCredentials, uuid: string, statement: DdsStatement): Promise<{ uuid: string; raw: string }> {
  const body = `<dds:AmendDdsRequest><dds:uuid>${xml(uuid)}</dds:uuid>${statementXml(statement)}</dds:AmendDdsRequest>`
  const raw = await post(creds, ACTION_AMEND, body)
  return { uuid, raw }
}

/** withdrawDds V3 → retire une DDS (fenêtre 72 h, statut AVAILABLE, hors verrou douane). */
export async function withdrawDdsV3(creds: TracesCredentials, uuid: string): Promise<{ raw: string }> {
  const body = `<dds:WithdrawDdsRequest><dds:uuid>${xml(uuid)}</dds:uuid></dds:WithdrawDdsRequest>`
  const raw = await post(creds, ACTION_WITHDRAW, body)
  return { raw }
}

/** getDdsByIdentifiers V3 → vérifie une DDS (référence + vérification). */
export async function getDdsByIdentifiersV3(
  creds: TracesCredentials,
  referenceNumber: string,
  verificationNumber: string,
): Promise<{ status: string | null; raw: string }> {
  const body = `<dds:GetDdsByIdentifiersRequest><dds:referenceAndVerificationNumber><eudrCommon:referenceNumber>${xml(referenceNumber)}</eudrCommon:referenceNumber><eudrCommon:verificationNumber>${xml(verificationNumber)}</eudrCommon:verificationNumber></dds:referenceAndVerificationNumber></dds:GetDdsByIdentifiersRequest>`
  const raw = await post(creds, ACTION_GET_BY_ID, body)
  const status = (raw.match(/<[^>]*:?status>([^<]+)<\/[^>]*:?status>/i) || [])[1] || null
  return { status, raw }
}
