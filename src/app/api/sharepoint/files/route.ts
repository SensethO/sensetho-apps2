import { NextRequest, NextResponse } from 'next/server'
import { spGraph, spAuthCheck, assertSafeId } from '@/lib/sharepoint'

const SELECT = '$select=id,name,size,createdDateTime,lastModifiedDateTime,folder,file,@microsoft.graph.downloadUrl,parentReference'
const PROTECTED = process.env.SHAREPOINT_BASE_FOLDER_NAME ?? 'General'

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
