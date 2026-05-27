/**
 * POST /api/agri/photos/[id]/action-notes/[key]/upload
 * Upload d'une pièce jointe (PDF, image, vidéo) vers SharePoint.
 * Route legacy pour les photos sans observation_id.
 *
 * Runtime Edge — streaming direct, aucun buffering Vercel, aucune limite de taille.
 * Métadonnées via query params : filename, mime, size, sectionId
 * Body : contenu brut du fichier
 */
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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
    // Edge runtime: use inline client creation
    const cookieStore = await cookies()
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

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

    const { searchParams } = new URL(req.url)
    const filename  = searchParams.get('filename')
    const mime      = searchParams.get('mime') ?? 'application/octet-stream'
    const sizeStr   = searchParams.get('size')
    const sectionId = searchParams.get('sectionId')

    if (!filename)  return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!sectionId) return NextResponse.json({ error: 'sectionId manquant' }, { status: 400 })
    if (!sizeStr)   return NextResponse.json({ error: 'size manquant' }, { status: 400 })
    if (!ALLOWED_MIME.has(mime))
      return NextResponse.json({ error: 'Type non autorisé (PDF, image ou vidéo uniquement)' }, { status: 400 })

    const size = parseInt(sizeStr, 10)
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

    const agriPhotosFolderId  = await ensureFolder(driveId, generalFolder.id, 'AGRI-PHOTOS', token)
    const plantationFolderId  = await ensureFolder(driveId, agriPhotosFolderId, photo.plantation_id, token)

    const safeName = filename.replace(/[^a-z0-9._\- ()[\]]/gi, '_').slice(0, 80)

    // Créer session d'upload SharePoint
    const sessionRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/items/${plantationFolderId}:/${encodeURIComponent(safeName)}:/createUploadSession`,
      {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
      }
    )
    if (!sessionRes.ok) throw new Error(`Upload session: ${await sessionRes.text()}`)
    const { uploadUrl } = await sessionRes.json() as { uploadUrl: string }

    // Streamer directement — aucun buffering
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Content-Range': `bytes 0-${size - 1}/${size}`,
      },
      body: req.body,
      // @ts-expect-error -- duplex required for streaming in Edge runtime
      duplex: 'half',
    })
    if (!uploadRes.ok) throw new Error(`Upload SharePoint: ${await uploadRes.text()}`)
    const item = await uploadRes.json() as { id: string }

    const attachment = {
      id:   crypto.randomUUID(),
      name: filename,
      path: item.id,
      mime,
      size,
    }

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
