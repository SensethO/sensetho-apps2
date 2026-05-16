/**
 * sharepointMulti.ts — Server-side only SharePoint/MS Graph helpers
 * Supports multiple tenant configurations stored in DB.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpConfigInput {
  tenant_id: string
  client_id: string
  client_secret: string
  site_host: string
  site_path: string
  drive_id?: string | null
  root_folder?: string
}

export interface SpConfigResolved {
  tenantId: string
  clientId: string
  clientSecret: string
  siteHost: string
  sitePath: string
  driveId: string
  rootFolder: string
}

export interface SpItem {
  id: string
  name: string
  isFolder: boolean
  size?: number
  createdAt: string
  webUrl: string
}

interface MsGraphTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface MsGraphDriveItem {
  id: string
  name: string
  folder?: Record<string, unknown>
  size?: number
  createdDateTime: string
  webUrl: string
}

interface MsGraphDriveResponse {
  id: string
  webUrl: string
}

interface MsGraphSiteResponse {
  displayName: string
  drives?: { value: MsGraphDriveResponse[] }
}

interface MsGraphItemsResponse {
  value: MsGraphDriveItem[]
}

// ── Token cache (in-process, simple) ─────────────────────────────────────────

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getTokenForConfig(
  config: Pick<SpConfigInput, 'tenant_id' | 'client_id' | 'client_secret'>
): Promise<string> {
  const cacheKey = `${config.tenant_id}:${config.client_id}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const url = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MS token error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as MsGraphTokenResponse
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  })

  return data.access_token
}

// ── Config resolution ─────────────────────────────────────────────────────────

export async function getConfigForApp(appKey: string): Promise<SpConfigResolved> {
  const admin = createAdminClient()

  // Try DB route
  const { data: route } = await admin
    .from('sp_app_routes')
    .select('folder_name, sp_config_id, sp_configs(*)')
    .eq('app_key', appKey)
    .single()

  if (route && route.sp_configs) {
    const cfg = route.sp_configs as unknown as Record<string, unknown>
    if (cfg.drive_id) {
      return {
        tenantId: cfg.tenant_id as string,
        clientId: cfg.client_id as string,
        clientSecret: cfg.client_secret as string,
        siteHost: cfg.site_host as string,
        sitePath: cfg.site_path as string,
        driveId: cfg.drive_id as string,
        rootFolder: (route.folder_name as string) ?? (cfg.root_folder as string),
      }
    }
  }

  // Fallback: default config from DB
  const { data: defaultCfg } = await admin
    .from('sp_configs')
    .select('*')
    .eq('is_default', true)
    .single()

  if (defaultCfg && defaultCfg.drive_id) {
    return {
      tenantId: defaultCfg.tenant_id,
      clientId: defaultCfg.client_id,
      clientSecret: defaultCfg.client_secret,
      siteHost: defaultCfg.site_host,
      sitePath: defaultCfg.site_path,
      driveId: defaultCfg.drive_id,
      rootFolder: defaultCfg.root_folder,
    }
  }

  // Fallback: env vars
  const driveId = process.env.SHAREPOINT_DRIVE_ID
  if (!driveId) throw new Error('No SharePoint configuration found for app: ' + appKey)

  return {
    tenantId: process.env.MS_TENANT_ID!,
    clientId: process.env.MS_CLIENT_ID!,
    clientSecret: process.env.MS_CLIENT_SECRET!,
    siteHost: 'scdbpro.sharepoint.com',
    sitePath: 'sites/WebApp-Partage',
    driveId,
    rootFolder: 'Documents partages',
  }
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

async function graphGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph GET ${url} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function graphPost<T>(token: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph POST ${url} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Test connection ───────────────────────────────────────────────────────────

export async function testSpConfig(config: SpConfigInput): Promise<{
  ok: boolean
  driveId?: string
  siteName?: string
  error?: string
}> {
  try {
    const token = await getTokenForConfig(config)

    // Get site info
    const siteUrl = `${GRAPH_BASE}/sites/${config.site_host}:/${config.site_path}`
    const site = await graphGet<MsGraphSiteResponse>(token, siteUrl)
    const siteName = site.displayName

    // Get default drive
    const drivesUrl = `${GRAPH_BASE}/sites/${config.site_host}:/${config.site_path}:/drives`
    const drivesData = await graphGet<{ value: MsGraphDriveResponse[] }>(token, drivesUrl)
    const drives = drivesData.value

    // If drive_id provided, verify it exists
    let driveId: string
    if (config.drive_id) {
      const found = drives.find(d => d.id === config.drive_id)
      driveId = found ? found.id : drives[0]?.id
    } else {
      driveId = drives[0]?.id
    }

    if (!driveId) throw new Error('No drives found on site')

    return { ok: true, driveId, siteName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Browse folders ────────────────────────────────────────────────────────────

export async function browseSpFolder(
  config: SpConfigResolved,
  folderId: string | null
): Promise<SpItem[]> {
  const token = await getTokenForConfig({
    tenant_id: config.tenantId,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const url =
    folderId === null
      ? `${GRAPH_BASE}/drives/${config.driveId}/root/children`
      : `${GRAPH_BASE}/drives/${config.driveId}/items/${folderId}/children`

  const data = await graphGet<MsGraphItemsResponse>(token, url + '?$top=200')

  return data.value.map(item => ({
    id: item.id,
    name: item.name,
    isFolder: !!item.folder,
    size: item.size,
    createdAt: item.createdDateTime,
    webUrl: item.webUrl,
  }))
}

// ── Create folder ─────────────────────────────────────────────────────────────

export async function createSpFolder(
  config: SpConfigResolved,
  parentId: string | null,
  name: string
): Promise<{ id: string }> {
  const token = await getTokenForConfig({
    tenant_id: config.tenantId,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const url =
    parentId === null
      ? `${GRAPH_BASE}/drives/${config.driveId}/root/children`
      : `${GRAPH_BASE}/drives/${config.driveId}/items/${parentId}/children`

  const result = await graphPost<MsGraphDriveItem>(token, url, {
    name,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename',
  })

  return { id: result.id }
}

// ── Download file ─────────────────────────────────────────────────────────────

export async function downloadSpFile(
  config: SpConfigResolved,
  itemId: string
): Promise<ArrayBuffer> {
  const token = await getTokenForConfig({
    tenant_id: config.tenantId,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const url = `${GRAPH_BASE}/drives/${config.driveId}/items/${itemId}/content`

  // Graph returns a redirect to the actual download URL
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Download ${itemId} → ${res.status}: ${text}`)
  }

  return res.arrayBuffer()
}

// ── Upload file ───────────────────────────────────────────────────────────────

export async function uploadSpFile(
  config: SpConfigResolved,
  parentPath: string,
  name: string,
  data: ArrayBuffer,
  mime: string
): Promise<{ id: string }> {
  const token = await getTokenForConfig({
    tenant_id: config.tenantId,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  // Encode path segments
  const encodedPath = parentPath
    .split('/')
    .map(s => encodeURIComponent(s))
    .join('/')
  const encodedName = encodeURIComponent(name)

  const url = `${GRAPH_BASE}/drives/${config.driveId}/root:/${encodedPath}/${encodedName}:/content`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mime || 'application/octet-stream',
    },
    body: data,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload ${name} → ${res.status}: ${text}`)
  }

  const result = (await res.json()) as MsGraphDriveItem
  return { id: result.id }
}

// ── Delete file ───────────────────────────────────────────────────────────────

export async function deleteSpFile(
  config: SpConfigResolved,
  itemId: string
): Promise<void> {
  const token = await getTokenForConfig({
    tenant_id: config.tenantId,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const url = `${GRAPH_BASE}/drives/${config.driveId}/items/${itemId}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error(`Delete ${itemId} → ${res.status}: ${text}`)
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the string looks like a SharePoint item ID
 * (alphanumeric/base64-like, no slashes).
 * Used to skip legacy Supabase Storage paths.
 */
export function isSharePointItemId(id: string): boolean {
  return !id.includes('/')
}
