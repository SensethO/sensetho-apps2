/**
 * POST /api/agri/photos/upload
 * Upload une photo/vidéo terrain sur SharePoint et insère dans photos_terrain.
 *
 * Runtime Edge — streaming direct, aucun buffering Vercel, aucune limite de taille.
 * Métadonnées via query params : filename, mime, size, plantation_id, champ_id,
 *   date_prise, type_sujet, produit, commentaire, latitude, longitude, observation_id
 * Body : contenu brut du fichier
 */
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getAccessToken } from '@/lib/msGraph'

// ─── Folder code helper ───────────────────────────────────────────────────────

function folderCode(name: string, id: string): string {
  const clean = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 5)
    .padEnd(5, 'X')
  const suffix = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `${clean}-${suffix}`
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Edge runtime: use inline client creation (createRouteClient uses Node.js cookies API)
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

    const { searchParams } = new URL(request.url)
    const filename       = searchParams.get('filename')
    const mime           = searchParams.get('mime') ?? 'application/octet-stream'
    const sizeStr        = searchParams.get('size')
    const plantation_id  = searchParams.get('plantation_id')
    const champ_id       = searchParams.get('champ_id')
    const date_prise     = searchParams.get('date_prise')
    const type_sujet     = searchParams.get('type_sujet')
    const produit        = searchParams.get('produit')
    const commentaire    = searchParams.get('commentaire')
    const latitude       = searchParams.get('latitude')
    const longitude      = searchParams.get('longitude')
    const observation_id = searchParams.get('observation_id')

    if (!filename)      return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!plantation_id) return NextResponse.json({ error: 'plantation_id manquant' }, { status: 400 })
    if (!date_prise)    return NextResponse.json({ error: 'date_prise manquant' }, { status: 400 })
    if (!sizeStr)       return NextResponse.json({ error: 'size manquant' }, { status: 400 })

    const isVideo = mime.startsWith('video/')
    const isImage = mime.startsWith('image/')
    if (!isImage && !isVideo && mime !== 'application/pdf')
      return NextResponse.json({ error: 'Type non autorisé (image ou vidéo uniquement)' }, { status: 400 })

    const size = parseInt(sizeStr, 10)

    // Vérifier que l'utilisateur possède la plantation (ou est admin)
    const { data: plantation, error: plantErr } = await serviceClient
      .from('plantations').select('id, user_id').eq('id', plantation_id).single()
    if (plantErr || !plantation)
      return NextResponse.json({ error: 'Plantation introuvable' }, { status: 404 })

    const { data: profile } = await serviceClient
      .from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && plantation.user_id !== user.id)
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // ─── SharePoint — structure AGRI-PHOTOS/{PLANT_CODE}/{CHAMP_CODE}/ ──────────

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const token   = await getAccessToken()

    const rootRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const rootData = await rootRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const generalFolder = rootData.value.find(c => c.name === 'General' && c.folder)
    if (!generalFolder) throw new Error('Dossier General introuvable dans SharePoint')

    const { data: plantationInfo } = await serviceClient
      .from('plantations').select('nom').eq('id', plantation_id).maybeSingle()
    const plantName = plantationInfo?.nom ?? 'PLANT'

    let champName = 'NOCHMP'
    if (champ_id) {
      const { data: champInfo } = await serviceClient
        .from('champs').select('nom').eq('id', champ_id).maybeSingle()
      champName = champInfo?.nom ?? 'NOCHMP'
    }

    const plantCode = folderCode(plantName, plantation_id)
    const champCode = folderCode(champName, champ_id ?? plantation_id)

    const agriPhotosFolderId  = await ensureFolder(driveId, generalFolder.id, 'AGRI-PHOTOS', token)
    const plantFolderId       = await ensureFolder(driveId, agriPhotosFolderId, plantCode, token)
    const champFolderId       = await ensureFolder(driveId, plantFolderId, champCode, token)

    // Nom de fichier : {date_prise}_{timestamp}.{ext}
    const ext      = filename.split('.').pop() ?? 'jpg'
    const fileName = `${date_prise}_${Date.now()}.${ext}`

    // Créer session d'upload SharePoint
    const sessionRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/items/${champFolderId}:/${encodeURIComponent(fileName)}:/createUploadSession`,
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
      body: request.body,
      // @ts-expect-error -- duplex required for streaming in Edge runtime
      duplex: 'half',
    })
    if (!uploadRes.ok) throw new Error(`Upload SharePoint: ${await uploadRes.text()}`)
    const spItem = await uploadRes.json() as { id: string }

    // ─── Insert into DB ───────────────────────────────────────────────────────

    const { data: photo, error: insertErr } = await serviceClient
      .from('photos_terrain')
      .insert({
        plantation_id,
        champ_id:       champ_id || null,
        date_prise,
        url_sharepoint: spItem.id,
        filename:       fileName,
        type_sujet:     type_sujet || null,
        produit:        produit || null,
        commentaire:    commentaire || null,
        latitude:       latitude ? parseFloat(latitude) : null,
        longitude:      longitude ? parseFloat(longitude) : null,
        observation_id: observation_id || null,
      })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json({ photo })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
