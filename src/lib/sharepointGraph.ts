/**
 * Microsoft Graph API — SharePoint / OneDrive helpers
 * Utilise le même token client_credentials que msGraph.ts
 */

import { getAccessToken } from './msGraph'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphSite {
  id: string
  displayName: string
  webUrl: string
  name: string
}

export interface GraphDrive {
  id: string
  name: string
  driveType: string // 'documentLibrary' | 'personal' | 'business'
  webUrl: string
  quota?: { used: number; remaining: number; total: number }
}

export interface GraphDriveItem {
  id: string
  name: string
  size?: number
  createdDateTime: string
  lastModifiedDateTime: string
  webUrl: string
  file?: { mimeType: string; hashes?: { quickXorHash?: string } }
  folder?: { childCount: number }
  parentReference?: { driveId: string; id: string; path: string }
  '@microsoft.graph.downloadUrl'?: string
  thumbnails?: Array<{ small?: { url?: string }; medium?: { url?: string }; large?: { url?: string } }>
  createdBy?: { user?: { displayName: string; email?: string } }
  lastModifiedBy?: { user?: { displayName: string; email?: string } }
}

export interface UploadSessionResponse {
  uploadUrl: string
  expirationDateTime: string
}

// ─── Helper fetch ─────────────────────────────────────────────────────────────

async function gFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    cache: 'no-store', // évite le cache Next.js entre requêtes successives
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph ${res.status}: ${err}`)
  }
  if (res.status === 204) return {} as T
  return res.json()
}

// ─── Sites ────────────────────────────────────────────────────────────────────

/** Accès direct par hostname (ex: sensetho.sharepoint.com) */
export async function getSiteByHostname(hostname: string, sitePath = '/'): Promise<GraphSite> {
  return gFetch<GraphSite>(`/sites/${hostname}:${sitePath}`)
}

/** Cherche tous les sites SharePoint accessibles (nécessite Sites.Read.All consenti) */
export async function searchSites(query = '*'): Promise<GraphSite[]> {
  const data = await gFetch<{ value: GraphSite[] }>(`/sites?search=${encodeURIComponent(query)}&$top=50`)
  return data.value ?? []
}

/** Site spécifique par son ID */
export async function getSite(siteId: string): Promise<GraphSite> {
  return gFetch<GraphSite>(`/sites/${siteId}`)
}

// ─── Drives ───────────────────────────────────────────────────────────────────

/** Tous les drives d'un site */
export async function getSiteDrives(siteId: string): Promise<GraphDrive[]> {
  const data = await gFetch<{ value: GraphDrive[] }>(`/sites/${siteId}/drives`)
  return data.value ?? []
}

/** Drive par défaut (Documents) d'un site */
export async function getDefaultDrive(siteId: string): Promise<GraphDrive> {
  return gFetch<GraphDrive>(`/sites/${siteId}/drive`)
}

// ─── Items ────────────────────────────────────────────────────────────────────

/** Contenu d'un dossier */
export async function getFolderChildren(driveId: string, itemId: string): Promise<GraphDriveItem[]> {
  const path = itemId === 'root'
    ? `/drives/${driveId}/root/children`
    : `/drives/${driveId}/items/${itemId}/children`
  // Note : pas de $select — l'annotation @microsoft.graph.downloadUrl est automatiquement
  // exclue dès qu'on utilise $select, même si on l'y liste explicitement (annotation OData).
  // Le tri est fait côté client.
  const data = await gFetch<{ value: GraphDriveItem[] }>(
    `${path}?$expand=thumbnails&$top=500`
  )
  return data.value ?? []
}

/** URL de téléchargement pré-signée (temporaire, ~1h) */
export async function getDownloadUrl(driveId: string, itemId: string): Promise<string> {
  // Pas de $select : l'annotation @microsoft.graph.downloadUrl est automatiquement
  // exclue par $select, même si on l'y liste explicitement (annotation OData).
  const item = await gFetch<GraphDriveItem>(`/drives/${driveId}/items/${itemId}`)
  const url = item['@microsoft.graph.downloadUrl']
  if (!url) throw new Error('URL de téléchargement non disponible')
  return url
}

// ─── Upload session ───────────────────────────────────────────────────────────

/** Crée une session d'upload (pour tout fichier, contourne les limites de taille) */
export async function createUploadSession(
  driveId: string,
  parentId: string,
  fileName: string
): Promise<UploadSessionResponse> {
  const path = parentId === 'root'
    ? `/drives/${driveId}/root:/${encodeURIComponent(fileName)}:/createUploadSession`
    : `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(fileName)}:/createUploadSession`

  return gFetch<UploadSessionResponse>(path, {
    method: 'POST',
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'rename',
        name: fileName,
      },
    }),
  })
}

// ─── Dossier ──────────────────────────────────────────────────────────────────

/** Crée un sous-dossier */
export async function createFolder(
  driveId: string,
  parentId: string,
  name: string
): Promise<GraphDriveItem> {
  const path = parentId === 'root'
    ? `/drives/${driveId}/root/children`
    : `/drives/${driveId}/items/${parentId}/children`
  return gFetch<GraphDriveItem>(path, {
    method: 'POST',
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  })
}

// ─── Scope validation ─────────────────────────────────────────────────────────

/**
 * Retourne le chemin complet d'un item Graph.
 * Ex : "/drives/b!xxx/root:/general/acme-corp/sous-dossier"
 */
export async function getItemFullPath(driveId: string, itemId: string): Promise<string> {
  const item = await gFetch<GraphDriveItem & { parentReference?: { path?: string } }>(
    `/drives/${driveId}/items/${itemId}?$select=id,name,parentReference`
  )
  const parentPath = (item as { parentReference?: { path?: string } }).parentReference?.path ?? ''
  return `${parentPath}/${item.name}`
}

/**
 * Vérifie qu'un itemId est le dossier racine lui-même ou un de ses descendants.
 * Lève une erreur 403 si hors périmètre.
 *
 * @param rootPath  Chemin stocké dans client_folders.sharepoint_item_path
 *                  Ex : "/drives/.../root:/general/acme-corp"
 */
export async function assertItemInScope(
  driveId: string,
  itemId: string,
  rootItemId: string,
  rootPath: string | null
): Promise<void> {
  if (itemId === rootItemId) return

  const basePath = rootPath ?? await getItemFullPath(driveId, rootItemId)
  const itemPath = await getItemFullPath(driveId, itemId)

  if (itemPath !== basePath && !itemPath.startsWith(basePath + '/')) {
    throw Object.assign(new Error('Accès refusé — item hors du périmètre autorisé'), { status: 403 })
  }
}

// ─── Suppression ──────────────────────────────────────────────────────────────

/** Métadonnées d'un item (nom, type) — utilisé avant suppression */
export async function getItemMetadata(driveId: string, itemId: string): Promise<GraphDriveItem> {
  return gFetch<GraphDriveItem>(`/drives/${driveId}/items/${itemId}?$select=id,name,folder,file`)
}

/** Supprime un fichier ou dossier */
export async function deleteItem(driveId: string, itemId: string): Promise<void> {
  await gFetch<void>(`/drives/${driveId}/items/${itemId}`, { method: 'DELETE' })
}

// ─── Renommage & déplacement ──────────────────────────────────────────────────

/** Renomme un fichier ou dossier */
export async function renameItem(
  driveId: string,
  itemId: string,
  newName: string
): Promise<GraphDriveItem> {
  return gFetch<GraphDriveItem>(`/drives/${driveId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  })
}

/** Déplace un item vers un dossier de destination */
export async function moveItem(
  driveId: string,
  itemId: string,
  destinationFolderId: string
): Promise<GraphDriveItem> {
  return gFetch<GraphDriveItem>(`/drives/${driveId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      parentReference: { driveId, id: destinationFolderId },
    }),
  })
}
