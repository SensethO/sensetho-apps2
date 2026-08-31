import { NextRequest, NextResponse } from 'next/server'
import { spGraph, spAuthCheck, assertSafeId } from '@/lib/sharepoint'

const SELECT = '$select=id,name,size,createdDateTime,lastModifiedDateTime,folder,file,@microsoft.graph.downloadUrl,parentReference'
const PROTECTED = process.env.SHAREPOINT_BASE_FOLDER_NAME ?? 'General'


/**
 * Zones sous conservation probante : ni renommage, ni déplacement, ni suppression
 * depuis l'explorateur de fichiers.
 *
 * Les fichiers EUDR sont immuables (décision du 2026-09-01, cf.
 * `src/lib/eudr/fichiers.ts`) : leur nom porte le numéro de version et sert de
 * preuve du rattachement d'une déclaration TRACES à la pièce qui l'a alimentée.
 * L'explorateur générique ignorait cette règle et pouvait défaire d'un clic ce
 * que le versionnage établit — d'où ce garde-fou, posé ici plutôt que dans l'UI :
 * une protection qui ne vit que dans l'interface n'en est pas une.
 */
const ZONES_IMMUABLES = ['EUDR-FOURNISSEURS']

/** Renvoie le nom de la zone protégée si l'item s'y trouve, sinon null. */
async function zoneImmuable(itemId: string): Promise<string | null> {
  try {
    const res = await spGraph(`/items/${itemId}?$select=name,folder,parentReference`)
    if (!res.ok) return null
    const item = await res.json() as { name?: string; folder?: unknown; parentReference?: { path?: string } }
    const chemin = `${item.parentReference?.path ?? ''}/${item.name ?? ''}`
    return ZONES_IMMUABLES.find(z => chemin.split('/').includes(z)) ?? null
  } catch {
    return null // en cas de doute on n'invente pas une protection : la route suit son cours
  }
}

function refusImmuable(zone: string) {
  return NextResponse.json({
    error: `Les fichiers du dossier ${zone} sont sous conservation probante : ils ne peuvent être ni renommés,`
      + ' ni déplacés, ni supprimés depuis l’explorateur. Leur nom porte le numéro de version et rattache'
      + ' les déclarations TRACES à la pièce exacte qui les a alimentées (art. 33 du règlement UE 2023/1115,'
      + ' cinq ans de conservation). Passez par l’application : un nouveau dépôt crée une version, il n’écrase rien.',
  }, { status: 403 })
}

/* GET — liste dossier */
export async function GET(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const rawFolder = req.nextUrl.searchParams.get('folder')
    const path = rawFolder
      ? `/items/${assertSafeId(rawFolder, 'folder')}/children?${SELECT}&$orderby=name asc`
      : `/root/children?${SELECT}&$orderby=name asc`
    const res  = await spGraph(path)
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json(data.value ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/* POST — créer dossier */
export async function POST(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const { parentId, name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    const path = parentId
      ? `/items/${assertSafeId(parentId, 'parentId')}/children`
      : '/root/children'
    const res = await spGraph(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/* PATCH — déplacer ou renommer */
export async function PATCH(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const { itemId: rawId, destinationFolderId: rawDest, name } = await req.json()
    const itemId = assertSafeId(rawId, 'itemId')
    const zone = await zoneImmuable(itemId)
    if (zone) return refusImmuable(zone)
    let body: Record<string, unknown>
    if (name !== undefined) {
      if (!name?.trim()) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 })
      body = { name: name.trim() }
    } else {
      body = { parentReference: { id: assertSafeId(rawDest, 'destinationFolderId') } }
    }
    const res = await spGraph(`/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/* DELETE — supprimer élément */
export async function DELETE(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const id = assertSafeId(req.nextUrl.searchParams.get('id'))
    const zone = await zoneImmuable(id)
    if (zone) return refusImmuable(zone)
    // Vérifier que ce n'est pas le dossier protégé
    const meta = await spGraph(`/items/${id}?$select=name`)
    if (meta.ok) {
      const { name } = await meta.json()
      if (name === PROTECTED)
        return NextResponse.json({ error: `Le dossier ${PROTECTED} ne peut pas être supprimé.` }, { status: 403 })
    }
    const res = await spGraph(`/items/${id}`, { method: 'DELETE' })
    if (res.status === 204) return NextResponse.json({ ok: true })
    const data = await res.json()
    return NextResponse.json({ error: data }, { status: res.status })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
