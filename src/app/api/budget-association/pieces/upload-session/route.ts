import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

/**
 * Écriture autorisée : admin (profiles.role) OU propriétaire de l’organisation
 * (organisations.user_id) rattachée à l’exercice — même logique que la RLS
 * `budget_exercices_write` utilisée par les handlers.
 */
async function canWrite(
  userId: string,
  exerciceId: string
): Promise<{ ok: boolean; exercice: { nom: string } | null }> {
  const admin = createAdminClient()
  const { data: exercice } = await admin
    .from('budget_exercices')
    .select('nom, structure_id')
    .eq('id', exerciceId)
    .single()
  if (!exercice) return { ok: false, exercice: null }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return { ok: true, exercice }

  if (!exercice.structure_id) return { ok: false, exercice }
  const { data: org } = await admin
    .from('organisations')
    .select('user_id')
    .eq('id', exercice.structure_id)
    .single()
  return { ok: org?.user_id === userId, exercice }
}

/**
 * POST /api/budget-association/pieces/upload-session
 * Body: { fileName, exercice_id }
 * Returns: { uploadUrl, itemPath }
 * Crée une session d’upload Graph dans le dossier `Budget/<exercice>/`.
 * Règle absolue : aucun transit de fichier par Vercel — le client PUT
 * directement vers SharePoint, puis référence la pièce via POST /pieces.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { fileName?: string; exercice_id?: string }
    const { fileName, exercice_id } = body
    if (!fileName) return NextResponse.json({ error: 'fileName requis' }, { status: 400 })
    if (!exercice_id) return NextResponse.json({ error: 'exercice_id requis' }, { status: 400 })

    const { ok, exercice } = await canWrite(user.id, exercice_id)
    if (!exercice) return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const safeName = fileName.replace(/[/\\:*?"<>|]/g, '_').trim()
    const folderName = (exercice.nom || exercice_id).replace(/[/\\:*?"<>|]/g, '_').trim()

    // Fallback config par défaut géré par getConfigForApp ; les dossiers
    // intermédiaires sont créés automatiquement par Graph (chemin :/…:/).
    const config = await getConfigForApp('budget-association')
    const itemPath = `${config.rootFolder}/Budget/${folderName}/${safeName}`
    const spPath = `/root:/${config.rootFolder}/Budget/${folderName}/${safeName}:/createUploadSession`

    const spRes = await spGraphForApp('budget-association', spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: safeName },
      }),
    })

    if (!spRes.ok) {
      const errText = await spRes.text()
      console.error('[budget-association/pieces/upload-session/sp]', spRes.status, errText)
      return NextResponse.json({ error: 'Échec session upload SharePoint', detail: errText }, { status: 502 })
    }

    const spJson = await spRes.json() as { uploadUrl: string }
    return NextResponse.json({ uploadUrl: spJson.uploadUrl, itemPath })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
