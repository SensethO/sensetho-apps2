/**
 * POST /api/agri/photos/upload-session
 *
 * Étape 1 du flux direct (zero-Vercel-transit) :
 * Reçoit les métadonnées en JSON, crée la structure de dossiers SharePoint
 * et une session d'upload, retourne l'URL au client.
 * Le client PUT ensuite directement vers SharePoint — le fichier ne passe JAMAIS par Vercel.
 *
 * Body JSON : { filename, mime, size, plantation_id, observation_id,
 *               date_prise, champ_id?, type_sujet?, produit?, commentaire?,
 *               latitude?, longitude? }
 * Retourne  : { uploadUrl, fileName, confirmUrl }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { getAccessToken } from '@/lib/msGraph'

function folderCode(name: string, id: string): string {
  const clean = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10)
    .padEnd(10, 'X')
  // Suffixe numérique court (4 chiffres) dérivé de l'UUID pour éviter les doublons
  const hexSuffix = id.replace(/-/g, '').slice(-4)
  const numSuffix = String(parseInt(hexSuffix, 16) % 10000).padStart(4, '0')
  return `${clean}-${numSuffix}`
}

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

export async function POST(req: Request) {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json() as {
      filename: string; mime: string; size: number
      plantation_id: string; observation_id?: string; date_prise: string
      champ_id?: string; type_sujet?: string; produit?: string
      commentaire?: string; latitude?: string; longitude?: string
    }
    const { filename, mime, size, plantation_id, date_prise } = body

    if (!filename)      return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!plantation_id) return NextResponse.json({ error: 'plantation_id manquant' }, { status: 400 })
    if (!date_prise)    return NextResponse.json({ error: 'date_prise manquant' }, { status: 400 })
    if (!size)          return NextResponse.json({ error: 'size manquant' }, { status: 400 })

    const isVideo = mime.startsWith('video/')
    const isImage = mime.startsWith('image/')
    if (!isImage && !isVideo && mime !== 'application/pdf')
      return NextResponse.json({ error: 'Type non autorisé (image ou vidéo uniquement)' }, { status: 400 })

    const svc = createAdminClient()

    // Vérifier accès plantation
    const { data: plantation } = await svc.from('plantations').select('id, user_id, nom').eq('id', plantation_id).single()
    if (!plantation) return NextResponse.json({ error: 'Plantation introuvable' }, { status: 404 })

    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && plantation.user_id !== user.id)
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Structure SharePoint : General/AGRI-PHOTOS/{PLANT_CODE}/{CHAMP_CODE}/
    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const token   = await getAccessToken()

    const rootRes = await fetch(
      `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const rootData = await rootRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const generalFolder = rootData.value.find(c => c.name === 'General' && c.folder)
    if (!generalFolder) throw new Error('Dossier General introuvable dans SharePoint')

    let champName = 'NOCHMP'
    if (body.champ_id) {
      const { data: champInfo } = await svc.from('champs').select('nom').eq('id', body.champ_id).maybeSingle()
      champName = champInfo?.nom ?? 'NOCHMP'
    }

    const plantCode = folderCode(plantation.nom ?? 'PLANT', plantation_id)
    const champCode = folderCode(champName, body.champ_id ?? plantation_id)

    const agriPhotosFolderId = await ensureFolder(driveId, generalFolder.id, 'AGRI-PHOTOS', token)
    const plantFolderId      = await ensureFolder(driveId, agriPhotosFolderId, plantCode, token)
    const champFolderId      = await ensureFolder(driveId, plantFolderId, champCode, token)

    // Générer un préfixe annexe unique basé sur le nombre de photos existantes
    const { count } = await svc.from('photos_terrain').select('*', { count: 'exact', head: true }).eq('plantation_id', plantation_id)
    const annexeRef = 'A' + String((count ?? 0) + 1).padStart(3, '0')

    // Nom de fichier stable
    const ext      = filename.split('.').pop() ?? 'jpg'
    const fileName = `${annexeRef}_${date_prise}_${Date.now()}.${ext}`

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

    return NextResponse.json({
      uploadUrl,
      fileName,
      annexeRef,
      confirmUrl: '/api/agri/photos/upload-confirm',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
