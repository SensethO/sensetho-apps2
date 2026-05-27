/**
 * POST /api/agri/photos/[id]/action-notes/[key]/upload-session
 *
 * Route legacy (photos sans observation_id).
 * Étape 1 du flux direct (zero-Vercel-transit) : reçoit les métadonnées en JSON,
 * crée une session d'upload SharePoint dans General/AGRI-PHOTOS/{plantation_id}/,
 * retourne l'URL au client.
 * Le client PUT ensuite directement vers SharePoint — fichier jamais sur Vercel.
 *
 * Body JSON : { filename, mime, size, sectionId }
 * Retourne : { uploadUrl, attachmentId, finalName, mime, size }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { getAccessToken } from '@/lib/msGraph'

type Params = { params: Promise<{ id: string; key: string }> }

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'video/3gpp', 'video/3gpp2', 'video/mpeg',
])

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function ensureFolder(driveId: string, parentId: string, name: string, token: string): Promise<string> {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children?$select=id,name,folder`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json() as { value: { id: string; name: string; folder?: unknown }[] }
  const existing = data.value.find(c => c.name === name && c.folder)
  if (existing) return existing.id
  const createRes = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${parentId}/children`, {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
  })
  const item = await createRes.json() as { id: string }
  return item.id
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: photoId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createAdminClient()

    // Vérifier accès à la photo
    const { data: photo, error: fetchErr } = await serviceClient
      .from('photos_terrain')
      .select('id, plantation_id')
      .eq('id', photoId)
      .single()
    if (fetchErr || !photo) return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })

    const { data: plantation } = await serviceClient
      .from('plantations').select('user_id').eq('id', photo.plantation_id).single()
    const { data: profile } = await serviceClient
      .from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation?.user_id !== user.id)
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json() as { filename: string; mime: string; size: number; sectionId: string }
    const { filename, mime, size, sectionId } = body

    if (!filename)  return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!sectionId) return NextResponse.json({ error: 'sectionId manquant' }, { status: 400 })
    if (!size)      return NextResponse.json({ error: 'size manquant' }, { status: 400 })
    if (!ALLOWED_MIME.has(mime))
      return NextResponse.json({ error: 'Type non autorisé (PDF, image ou vidéo uniquement)' }, { status: 400 })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    if (!driveId) return NextResponse.json({ error: 'SHAREPOINT_DRIVE_ID non configuré' }, { status: 500 })

    const token = await getAccessToken()
    const rootRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const rootData = await rootRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const generalFolder = rootData.value.find(c => c.name === 'General' && c.folder)
    if (!generalFolder) throw new Error('Dossier General introuvable dans SharePoint')

    const agriPhotosFolderId = await ensureFolder(driveId, generalFolder.id, 'AGRI-PHOTOS', token)
    const plantationFolderId = await ensureFolder(driveId, agriPhotosFolderId, photo.plantation_id, token)

    const safeName  = filename.replace(/[^a-z0-9._\- ()[\]]/gi, '_').slice(0, 80)
    const finalName = safeName

    // Créer la session d'upload SharePoint
    const sessionRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/items/${plantationFolderId}:/${encodeURIComponent(finalName)}:/createUploadSession`,
      {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
      }
    )
    if (!sessionRes.ok) throw new Error(`Upload session: ${await sessionRes.text()}`)
    const { uploadUrl } = await sessionRes.json() as { uploadUrl: string }

    return NextResponse.json({ uploadUrl, attachmentId: randomUUID(), finalName, mime, size })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
