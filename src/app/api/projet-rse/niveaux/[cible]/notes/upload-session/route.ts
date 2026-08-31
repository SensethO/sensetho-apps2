// Ouvre une session d'envoi Graph pour un élément hors projet.
//
// Le compteur d'annexes est celui de l'organisation, créé par la migration
// 20260901 : les niveaux supérieurs n'ont pas de compteur propre comme les
// projets. RÈGLE ABSOLUE : aucun octet ne transite par Vercel — le serveur
// n'ouvre qu'une adresse d'envoi pré-autorisée.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCible, dossierDeCible } from '@/lib/projet-rse/cible'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

const APP_KEY = 'projet-rse'

function propre(s: string): string {
  return s.replace(/[/\\:*?"<>|#%]/g, '_').trim()
}

/** POST { filename, size, actionKey } → { uploadUrl, attachmentId, finalName, annexeIndex } */
export async function POST(req: NextRequest, { params }: { params: { cible: string } }) {
  try {
    const cible = await requireCible(params.cible)
    if (cible instanceof NextResponse) return cible

    const body = await req.json() as { filename?: string; size?: number; actionKey?: string }
    if (!body.filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    if (!body.actionKey) return NextResponse.json({ error: 'actionKey requis' }, { status: 400 })
    if (body.size == null) return NextResponse.json({ error: 'size requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: compteur, error: eCompteur } = await admin
      .rpc('increment_projet_rse_compteur_org', { p_org: cible.organisationId })
    if (eCompteur || compteur == null) {
      console.error('[projet-rse/niveaux/upload-session/compteur]', eCompteur)
      return NextResponse.json({
        error: 'Compteur d’annexes indisponible : la migration '
             + '20260901_projet_rse_notes_multi_niveaux.sql n’a pas encore été exécutée '
             + 'dans Supabase.',
      }, { status: 500 })
    }

    const annexeIndex = compteur as number
    const finalName = 'A' + String(annexeIndex).padStart(3, '0') + '_' + propre(body.filename)

    const config = await getConfigForApp(APP_KEY)
    const chemin = '/root:/' + config.rootFolder + '/Plan-Strategique/'
      + dossierDeCible(cible) + '/' + (propre(body.actionKey) || 'notes') + '/' + finalName
      + ':/createUploadSession'

    const res = await spGraphForApp(APP_KEY, chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: finalName },
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('[projet-rse/niveaux/upload-session/sp]', res.status, detail)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail }, { status: 502 })
    }

    const { uploadUrl } = await res.json() as { uploadUrl: string }
    return NextResponse.json({
      uploadUrl, attachmentId: crypto.randomUUID(), finalName, annexeIndex,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
