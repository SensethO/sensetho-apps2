// /api/projet-rse/projets/[id]/notes/upload-session — ouvre une session
// d’upload Microsoft Graph pour un PUT direct navigateur → SharePoint.
// RÈGLE ABSOLUE plateforme : aucun fichier ne transite par Vercel ni Supabase.
// Dossier : <racine>/Plan-Strategique/<nom du projet sanitizé>/<actionKey>/

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

const APP_KEY = 'projet-rse'

/** Nettoie un segment de chemin SharePoint (nom de fichier ou de dossier). */
function sanitizeSegment(s: string): string {
  return s.replace(/[/\\:*?"<>|#%]/g, '_').trim()
}

/**
 * POST /api/projet-rse/projets/[id]/notes/upload-session
 * Body: { filename, size, actionKey }
 * Returns: { uploadUrl, attachmentId, finalName, annexeIndex }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireProjet(params.id)
    if (guard instanceof NextResponse) return guard
    const { projet } = guard

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    const { filename, size, actionKey } = body
    if (!filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (!actionKey) return NextResponse.json({ error: 'actionKey requis' }, { status: 400 })
    if (size === undefined || size === null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const attachmentId = crypto.randomUUID()
    const safeName = sanitizeSegment(filename)

    // Préfixe atomique A00x_ via fonction SQL (pattern iso53001)
    const admin = createAdminClient()
    const { data: counterData, error: counterError } = await admin
      .rpc('increment_projet_rse_notes_counter', { p_id: params.id })
    if (counterError || counterData == null) {
      console.error('[projet-rse/notes/upload-session/counter]', counterError)
      return NextResponse.json({ error: 'Échec génération index annexe' }, { status: 500 })
    }
    const annexeIndex = counterData as number
    const prefix = 'A' + String(annexeIndex).padStart(3, '0') + '_'
    const finalName = prefix + safeName

    const dossierProjet = sanitizeSegment(projet.nom) || params.id
    const dossierAction = sanitizeSegment(actionKey) || 'notes'

    const config = await getConfigForApp(APP_KEY)
    const spPath = `/root:/${config.rootFolder}/Plan-Strategique/${dossierProjet}/${dossierAction}/${finalName}:/createUploadSession`

    const spRes = await spGraphForApp(APP_KEY, spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[projet-rse/notes/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, attachmentId, finalName, annexeIndex })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
