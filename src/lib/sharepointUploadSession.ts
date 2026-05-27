/**
 * Utilitaire partagé pour la création de sessions d'upload SharePoint.
 *
 * Flow direct sans transit Vercel :
 *   1. Client → Vercel (POST JSON léger) → reçoit uploadUrl + metadata
 *   2. Client → SharePoint directement (PUT fichier brut)
 *   3. SharePoint → Client (item ID)
 *   4. Client enregistre l'attachment via la route notes habituelle
 *
 * Vercel ne voit jamais le contenu du fichier. Aucune limite de taille.
 */

import { getAccessToken } from './msGraph'
import { createUploadSession } from './sharepointGraph'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export async function ensureFolderPath(
  driveId: string,
  parentId: string,
  name: string
): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,folder`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as { value: { id: string; name: string; folder?: unknown }[] }
  const existing = data.value.find(c => c.name === name && c.folder)
  if (existing) return existing.id

  const token2 = await getAccessToken()
  const createRes = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children`, {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${token2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
  })
  const item = await createRes.json() as { id: string }
  return item.id
}

/**
 * Crée une session d'upload SharePoint pour un fichier donné.
 * Retourne l'URL à laquelle le client peut PUT le fichier directement.
 */
export async function createSharePointSession(
  driveId: string,
  folderId: string,
  fileName: string
): Promise<string> {
  const { uploadUrl } = await createUploadSession(driveId, folderId, fileName)
  return uploadUrl
}

/**
 * Génère le code dossier : 5 lettres alpha du nom + tiret + 4 derniers hex de l'UUID.
 * Identique à la fonction dans les routes agri.
 */
export function folderCode(name: string, id: string): string {
  const clean = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 5)
    .padEnd(5, 'X')
  const suffix = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `${clean}-${suffix}`
}
