/**
 * POST /api/agri/crm/upload-session
 * Crée une session d'upload SharePoint et retourne l'URL pré-authentifiée.
 * Le navigateur uploade ensuite DIRECTEMENT vers SharePoint (aucun transit Vercel).
 *
 * Body JSON : { plantation_id, filename, mime, size }
 * Returns : { uploadUrl, fileName }
 *
 * Stockage : SharePoint — General/CRM-AGRI/{PLANT_CODE}/
 * path retourné = SharePoint item ID (sans "/") utilisé par /api/agri/crm/download
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/msGraph'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function folderCode(name: string, id: string): string {
  const clean = (name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 5)
    .padEnd(5, 'X')
  const suffix = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `${clean}-${suffix}`
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function ensureFolder(driveId: string, parentId: string, name: string, token: string): Promise<string> {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,folder`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as { value: { id: string; name: string; folder?: unknown }[] }
  const existing = data.value?.find(c => c.name === name && c.folder)
  if (existing) return existing.id
  const createRes = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children`, {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
  })
  if (!createRes.ok) {
    const retryRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const retryData = await retryRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const found = retryData.value?.find(c => c.name === name && c.folder)
    if (found) return found.id
    throw new Error(`Impossible de créer le dossier ${name}`)
  }
  const item = await createRes.json() as { id: string }
  return item.id
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json() as {
      plantation_id?: string
      filename?: string
      mime?: string
      size?: number
    }
    const { plantation_id, filename, mime = 'application/octet-stream', size } = body

    if (!filename)      return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!plantation_id) return NextResponse.json({ error: 'plantation_id manquant' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifier accès à la plantation (propriétaire, acheteur autorisé ou admin)
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: plantation } = await svc
        .from('plantations').select('user_id').eq('id', plantation_id).single()
      const isOwner = plantation?.user_id === user.id

      if (!isOwner) {
        const { data: acces } = await svc
          .from('acces_acheteurs')
          .select('plantation_id')
          .eq('acheteur_user_id', user.id)
          .eq('plantation_id', plantation_id)
          .maybeSingle()
        if (!acces) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    // Récupérer le nom de la plantation pour le code dossier
    const { data: plantationInfo } = await svc
      .from('plantations').select('nom').eq('id', plantation_id).maybeSingle()
    const plantName = plantationInfo?.nom ?? 'PLANT'

    // ─── SharePoint : General/CRM-AGRI/{PLANT_CODE}/ ─────────────────────────

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const token   = await getAccessToken()

    // Trouver General/
    const rootRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const rootData = await rootRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const generalFolder = rootData.value?.find(c => c.name === 'General' && c.folder)
    if (!generalFolder) throw new Error('Dossier General introuvable dans SharePoint')

    const plantCode     = folderCode(plantName, plantation_id)
    const crmFolderId   = await ensureFolder(driveId, generalFolder.id, 'CRM-AGRI', token)
    const plantFolderId = await ensureFolder(driveId, crmFolderId, plantCode, token)

    // Nom de fichier unique
    const safeName = filename.replace(/[^a-z0-9._\- ()[\]]/gi, '_').slice(0, 80)
    const fileName = `${Date.now()}_${safeName}`

    // Créer la session d'upload SharePoint
    const sessionRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/items/${plantFolderId}:/${encodeURIComponent(fileName)}:/createUploadSession`,
      {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
      }
    )
    if (!sessionRes.ok) throw new Error(`Upload session: ${await sessionRes.text()}`)
    const { uploadUrl } = await sessionRes.json() as { uploadUrl: string }

    // Retourner l'URL pré-authentifiée — le navigateur uploadera directement vers SharePoint
    return NextResponse.json({ uploadUrl, fileName, originalName: filename, mime, size })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
