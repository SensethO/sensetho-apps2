/**
 * POST /api/agri/observations/[id]/action-notes/[key]/upload-session
 *
 * Étape 1 du flux direct : reçoit uniquement les métadonnées (JSON léger),
 * crée une session d'upload SharePoint, retourne l'URL au client.
 *
 * Le client uploade ensuite directement vers SharePoint (step 2) —
 * le fichier ne transite JAMAIS par Vercel.
 *
 * Body JSON : { filename, mime, size, sectionId, plantation_id? }
 * Retourne : { uploadUrl, attachmentId, finalName }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/server'
import { ensureFolderPath, createSharePointSession, folderCode } from '@/lib/sharepointUploadSession'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string; key: string }> }

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'video/3gpp', 'video/3gpp2', 'video/mpeg',
])

export async function POST(req: Request, { params }: Params) {
  try {
    const { id: observationId } = await params
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json() as {
      filename: string; mime: string; size: number; sectionId: string; plantation_id?: string
    }
    const { filename, mime, size, sectionId, plantation_id } = body

    if (!filename)  return NextResponse.json({ error: 'filename manquant' }, { status: 400 })
    if (!sectionId) return NextResponse.json({ error: 'sectionId manquant' }, { status: 400 })
    if (!size)      return NextResponse.json({ error: 'size manquant' }, { status: 400 })
    if (!ALLOWED_MIME.has(mime))
      return NextResponse.json({ error: 'Type non autorisé (PDF, image ou vidéo uniquement)' }, { status: 400 })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    if (!driveId) return NextResponse.json({ error: 'SHAREPOINT_DRIVE_ID non configuré' }, { status: 500 })

    const svc = createAdminClient()

    let plantName = 'PLANT'
    if (plantation_id) {
      const { data } = await svc.from('plantations').select('nom').eq('id', plantation_id).maybeSingle()
      plantName = data?.nom ?? 'PLANT'
    }

    // Compter les attachements existants pour le préfixe A
    const { data: obsNotes } = await svc
      .from('agri_observation_notes')
      .select('notes_sections')
      .eq('observation_id', observationId)
      .maybeSingle()
    const existingSections = (obsNotes?.notes_sections ?? []) as { attachments?: unknown[] }[]
    const totalAttachments = existingSections.reduce(
      (sum, s) => sum + (s.attachments?.length ?? 0), 0
    )
    const aCode    = `A${String(totalAttachments + 1).padStart(3, '0')}`
    const safeName = filename.replace(/[^a-z0-9._\- ()[\]]/gi, '_').slice(0, 80)
    const finalName = `${aCode}_${safeName}`

    // Créer hiérarchie : General/AGRI-PHOTOS/{PLANT_CODE}/{OBS_CODE}/
    const { getAccessToken } = await import('@/lib/msGraph')
    const token = await getAccessToken()

    const rootRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children?$select=id,name,folder`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    )
    const rootData = await rootRes.json() as { value: { id: string; name: string; folder?: unknown }[] }
    const generalFolder = rootData.value.find(c => c.name === 'General' && c.folder)
    if (!generalFolder) throw new Error('Dossier General introuvable dans SharePoint')

    const plantCode = folderCode(plantName, plantation_id ?? observationId)
    const obsCode   = folderCode('OBS', observationId)

    const agriPhotosFolderId = await ensureFolderPath(driveId, generalFolder.id, 'AGRI-PHOTOS')
    const plantFolderId      = await ensureFolderPath(driveId, agriPhotosFolderId, plantCode)
    const obsFolderId        = await ensureFolderPath(driveId, plantFolderId, obsCode)

    const uploadUrl = await createSharePointSession(driveId, obsFolderId, finalName)

    return NextResponse.json({
      uploadUrl,
      attachmentId: randomUUID(),
      finalName,
      aCode,
      mime,
      size,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
