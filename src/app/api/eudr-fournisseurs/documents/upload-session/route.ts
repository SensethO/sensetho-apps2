import { NextRequest, NextResponse } from 'next/server'
import { spGraphForApp, getConfigForApp } from '@/lib/sharepointMulti'
import { guard } from '../../traces/_auth'
import { baseDe, separerExtension, composerNom, prochaineVersion } from '@/lib/eudr/fichiers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP = 'eudr-fournisseurs'

/**
 * POST { org_id, entity_type, entity_id, filename }
 * Crée une upload session SharePoint pour
 * EUDR-FOURNISSEURS/{org}/{entity_type}/{entity_id}/{base}__v{NNN}{ext}.
 *
 * Le fichier part ensuite DIRECTEMENT du navigateur vers SharePoint : aucun octet
 * ne transite par Vercel ni par Supabase (règle du marbre, docs/MAINTENANCE.md §5).
 *
 * Le nom est imposé par le serveur, pas par le client : c'est ce qui rend la
 * version opposable. Un client qui renverrait un autre nom serait démenti par
 * `sp_path`, figé ici et contrôlable à tout moment contre SharePoint.
 *
 * `conflictBehavior: 'fail'` est délibéré. L'ancien réglage ('rename') laissait
 * SharePoint inventer « fichier 1.geojson » en silence, si bien que le nom
 * enregistré en base pouvait ne pas être celui du fichier réel. Ici une collision
 * est une anomalie — deux dépôts concurrents sur la même version — et doit se voir.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; entity_type?: string; entity_id?: string; filename?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = body.entity_type === 'contract' ? 'contract' : body.entity_type === 'supplier' ? 'supplier' : null
    if (!entityType || !body.entity_id) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })
    if (!body.filename) return NextResponse.json({ error: 'filename requis' }, { status: 400 })

    const base = baseDe(body.filename)
    const { ext } = separerExtension(body.filename)
    if (!base) return NextResponse.json({ error: 'Nom de fichier inexploitable' }, { status: 400 })

    const version = await prochaineVersion(body.org_id!, entityType, body.entity_id, base)
    const finalName = composerNom(base, version, ext)

    const config = await getConfigForApp(APP)
    const dossier = `${config.rootFolder}/${body.org_id}/${entityType}/${body.entity_id}`
    const spPath = `/root:/${dossier}/${finalName}:/createUploadSession`
    const spRes = await spGraphForApp(APP, spPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'fail', name: finalName } }),
    })
    if (!spRes.ok) {
      const detail = await spRes.text()
      const message = spRes.status === 409
        ? `Un fichier « ${finalName} » existe déjà : le dépôt est refusé plutôt que renommé en silence. Réessayez ; si l'erreur persiste, un dépôt concurrent est en cours.`
        : 'Échec upload session SharePoint'
      return NextResponse.json({ error: message, detail }, { status: 502 })
    }
    const spJson = await spRes.json() as { uploadUrl: string }
    // baseName / version / spPath sont renvoyés pour que la confirmation les
    // rejoue à l'identique : le client ne les invente pas, il les recopie.
    return NextResponse.json({
      uploadUrl: spJson.uploadUrl,
      finalName,
      baseName: base,
      versionNum: version,
      spPath: `${dossier}/${finalName}`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
