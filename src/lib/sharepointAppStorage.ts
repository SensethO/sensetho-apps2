/**
 * sharepointAppStorage.ts
 * Utilitaire SharePoint pour la gestion du stockage des pièces jointes applicatives.
 *
 * Structure dans SharePoint (sous SHAREPOINT_DRIVE_ID) :
 *   General/            ← dossier racine partagé (existe déjà dans le drive)
 *     ISO-APP/          ← créé automatiquement si absent
 *       CONTOS-001/     ← dossier de session (5 lettres + 3 chiffres séquentiels)
 *       DIAGNO-002/
 *       AUTRE-003/
 *
 * IMPORTANT : tous les dossiers applicatifs sont sous General/ pour que les
 * utilisateurs ne puissent jamais remonter au-dessus de leur dossier propre.
 *
 * Le nom du dossier de session est stocké dans la DB (sharepoint_folder_name)
 * et affiché dans un bouton ⓘ sur la carte de session.
 *
 * Toutes les opérations fichiers passent par Microsoft Graph API.
 *
 * ─── PATTERN OBLIGATOIRE POUR LES UPLOADS ────────────────────────────────────
 * ⚠️  RÈGLE OBLIGATOIRE — Upload : Browser → Vercel Edge (streaming pur) → SharePoint
 *   • Toute route upload DOIT déclarer : export const runtime = 'edge'
 *   • Fichier en body brut (pas FormData), métadonnées en query params
 *   • Utiliser uploadFileToSharePointStream() — JAMAIS uploadFileToSharePoint()
 *   • uploadFileToSharePoint() (ArrayBuffer) = DÉPRÉCIÉ. Conservé uniquement pour
 *     le ZIP server-side (download-annexes) qui nécessite déjà le fichier en mémoire.
 *   • Un hook git pre-commit bloque tout commit qui viole ces règles.
 *
 * Download : Vercel génère une URL pré-signée (~1h) → Browser télécharge
 *            directement depuis Microsoft (zéro transit Vercel pour le binaire)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getAccessToken } from './msGraph'
import { getFolderChildren, createUploadSession } from './sharepointGraph'
import type { SupabaseClient } from '@supabase/supabase-js'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const GENERAL_FOLDER  = 'General'   // dossier parent dans le drive (existe toujours)
const ISO_APP_FOLDER  = 'ISO-APP'   // sous-dossier applicatif créé si absent

// Cache module-level pour éviter les appels répétés pendant un cold start
let _generalFolderId: string | null = null
let _isoAppFolderId:  string | null = null

// ─── Helper fetch Graph ───────────────────────────────────────────────────────

async function gFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Graph ${res.status}: ${err}`)
  }
  if (res.status === 204) return {} as T
  return res.json()
}

// ─── Helpers nommage ──────────────────────────────────────────────────────────

/**
 * Extrait les 5 premières lettres alpha d'un nom de session.
 * ex: "Contoso 2024" → "CONTE", "AB" → "ABXXX"
 */
export function sessionNamePrefix(name: string): string {
  return (name ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase().padEnd(5, 'X')
}

// ─── Gestion dossiers SharePoint ─────────────────────────────────────────────

/** Cherche un dossier par nom parmi les enfants d'un parent. Retourne l'ID ou null. */
async function findFolderByName(driveId: string, parentId: string, name: string): Promise<string | null> {
  const children = await getFolderChildren(driveId, parentId)
  const found = children.find(c => c.name === name && c.folder)
  return found?.id ?? null
}

/** Crée un dossier avec conflictBehavior:fail (pas de renommage automatique). */
async function createFolderExact(driveId: string, parentId: string, name: string): Promise<string> {
  const path = parentId === 'root'
    ? `/drives/${driveId}/root/children`
    : `/drives/${driveId}/items/${parentId}/children`
  const item = await gFetch<{ id: string }>(path, {
    method: 'POST',
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
  })
  return item.id
}

/**
 * Obtient l'ID du dossier General/ (doit exister dans le drive).
 * Tous les dossiers applicatifs sont créés dedans pour restreindre
 * la visibilité des utilisateurs à leur propre espace.
 */
async function getGeneralFolderId(driveId: string): Promise<string> {
  if (_generalFolderId) return _generalFolderId
  const id = await findFolderByName(driveId, 'root', GENERAL_FOLDER)
  if (!id) throw new Error(`Dossier "${GENERAL_FOLDER}" introuvable dans le drive SharePoint`)
  _generalFolderId = id
  return id
}

/** Obtient ou crée le dossier ISO-APP/ à l'intérieur de General/. */
async function getOrCreateISOAppFolder(driveId: string): Promise<string> {
  if (_isoAppFolderId) return _isoAppFolderId

  const generalId = await getGeneralFolderId(driveId)
  let folderId = await findFolderByName(driveId, generalId, ISO_APP_FOLDER)
  if (!folderId) {
    try {
      folderId = await createFolderExact(driveId, generalId, ISO_APP_FOLDER)
    } catch {
      // Race condition: un autre process a peut-être créé le dossier entre-temps
      folderId = await findFolderByName(driveId, generalId, ISO_APP_FOLDER)
      if (!folderId) throw new Error('Impossible de créer le dossier ISO-APP dans SharePoint')
    }
  }

  _isoAppFolderId = folderId
  return folderId
}

/**
 * Calcule le prochain nom de dossier disponible pour un préfixe donné.
 * Cherche dans les 3 tables de sessions pour garantir l'unicité globale.
 * ex: prefix "CONTA" → "CONTA-001", "CONTA-002", ...
 */
async function nextSessionFolderName(prefix: string, supabase: SupabaseClient): Promise<string> {
  const [r1, r2, r3, r4] = await Promise.all([
    supabase.from('iso26000_sessions').select('sharepoint_folder_name').like('sharepoint_folder_name', `${prefix}-%`),
    supabase.from('csrd_sessions').select('sharepoint_folder_name').like('sharepoint_folder_name', `${prefix}-%`),
    supabase.from('gri_sessions').select('sharepoint_folder_name').like('sharepoint_folder_name', `${prefix}-%`),
    supabase.from('bilan_ges_sessions').select('sharepoint_folder_name').like('sharepoint_folder_name', `${prefix}-%`),
  ])

  const existing = new Set<string>()
  for (const r of [r1, r2, r3, r4]) {
    for (const row of (r.data ?? [])) {
      if (row.sharepoint_folder_name) existing.add(row.sharepoint_folder_name)
    }
  }

  let n = 1
  while (existing.has(`${prefix}-${String(n).padStart(3, '0')}`)) n++
  return `${prefix}-${String(n).padStart(3, '0')}`
}

// ─── API publique ─────────────────────────────────────────────────────────────

export type SessionTable = 'iso26000_sessions' | 'csrd_sessions' | 'gri_sessions' | 'gpsr_sessions' | 'bilan_ges_sessions' | 'bcorp_sessions'

/**
 * Assure l'existence du dossier SharePoint pour une session.
 * - Si déjà créé → retourne les infos existantes (idempotent)
 * - Sinon → crée ISO-APP si besoin, crée le sous-dossier, sauvegarde en DB
 */
export async function ensureSessionSharePointFolder(
  driveId: string,
  sessionId: string,
  sessionName: string,
  supabase: SupabaseClient,
  sessionTable: SessionTable
): Promise<{ folderId: string; folderName: string }> {
  // Vérifier si déjà créé en DB
  const { data } = await supabase
    .from(sessionTable)
    .select('sharepoint_folder_id, sharepoint_folder_name')
    .eq('id', sessionId)
    .single()

  if (data?.sharepoint_folder_id && data?.sharepoint_folder_name) {
    return { folderId: data.sharepoint_folder_id, folderName: data.sharepoint_folder_name }
  }

  const driveId_ = driveId
  const isoAppId = await getOrCreateISOAppFolder(driveId_)
  const prefix = sessionNamePrefix(sessionName)
  const folderName = await nextSessionFolderName(prefix, supabase)

  let folderId: string
  try {
    folderId = await createFolderExact(driveId_, isoAppId, folderName)
  } catch {
    // Race: un autre upload a peut-être créé ce dossier simultanément
    const found = await findFolderByName(driveId_, isoAppId, folderName)
    if (found) {
      folderId = found
    } else {
      throw new Error(`Impossible de créer le dossier SharePoint ${folderName}`)
    }
  }

  // Sauvegarder en DB
  await supabase
    .from(sessionTable)
    .update({ sharepoint_folder_id: folderId, sharepoint_folder_name: folderName })
    .eq('id', sessionId)

  return { folderId, folderName }
}

/**
 * @deprecated Utiliser uploadFileToSharePointStream() dans les routes Edge.
 * Conservé uniquement pour les cas serveur-only (génération ZIP, etc.)
 * qui nécessitent un ArrayBuffer déjà chargé en mémoire.
 *
 * Upload un fichier vers SharePoint via upload session (version bufferisée).
 */
export async function uploadFileToSharePoint(
  driveId: string,
  folderId: string,
  fileName: string,
  fileBytes: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const { uploadUrl } = await createUploadSession(driveId, folderId, fileName)

  const size = fileBytes.byteLength
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: fileBytes,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`SharePoint upload échoué (${uploadRes.status}): ${errText}`)
  }

  const item = await uploadRes.json() as { id: string }
  return item.id
}

/**
 * Upload un fichier vers SharePoint en streaming pur — aucun buffering Vercel.
 * OBLIGATOIRE pour toutes les routes upload (runtime Edge).
 *
 * @param stream   req.body de la requête Edge (ReadableStream | null)
 * @param size     Taille exacte du fichier (issue de file.size côté client)
 */
export async function uploadFileToSharePointStream(
  driveId: string,
  folderId: string,
  fileName: string,
  stream: ReadableStream | null,
  size: number,
  mimeType: string
): Promise<string> {
  const { uploadUrl } = await createUploadSession(driveId, folderId, fileName)

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: stream,
    // @ts-expect-error — requis pour le streaming dans certains runtimes
    duplex: 'half',
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`SharePoint upload échoué (${uploadRes.status}): ${errText}`)
  }

  const item = await uploadRes.json() as { id: string }
  return item.id
}

/**
 * Retourne l'URL de téléchargement pré-authentifiée pour un item SharePoint (~1h).
 *
 * IMPORTANT : ne pas utiliser $select avec @microsoft.graph.downloadUrl —
 * Microsoft Graph n'inclut pas les annotations OData dans les réponses $select
 * avec les permissions applicatives. On récupère le driveItem complet.
 */
export async function getSharePointDownloadUrl(driveId: string, itemId: string): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${itemId}`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Graph ${res.status}: ${err}`)
  }
  const data = await res.json() as { '@microsoft.graph.downloadUrl'?: string }
  const url = data['@microsoft.graph.downloadUrl']
  if (!url) throw new Error('URL de téléchargement SharePoint non disponible')
  return url
}

/**
 * Supprime un item SharePoint (fichier).
 * Silencieux si l'item est déjà supprimé (404).
 */
export async function deleteSharePointItem(driveId: string, itemId: string): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${itemId}`, {
    method: 'DELETE',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Graph ${res.status}: ${errText}`)
  }
}

/**
 * Télécharge le contenu d'un item SharePoint en ArrayBuffer.
 * Utilisé pour la génération ZIP côté serveur (download-annexes).
 *
 * Utilise l'endpoint /content directement avec le Bearer token —
 * plus fiable que @microsoft.graph.downloadUrl avec les permissions applicatives.
 */
export async function downloadSharePointFile(driveId: string, itemId: string): Promise<ArrayBuffer> {
  const token = await getAccessToken()
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Graph download ${res.status}: ${err}`)
  }
  return res.arrayBuffer()
}

/**
 * Détecte si un `path` est un item ID SharePoint ou un chemin Supabase Storage.
 * - Supabase : "sessionId/actionKey/sectionId/uuid-filename.pdf" (contient /)
 * - SharePoint : "01B6XUFS..." (sans /)
 */
export function isSharePointItemId(path: string): boolean {
  return !path.includes('/')
}
