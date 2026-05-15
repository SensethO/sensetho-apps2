import { NextRequest, NextResponse } from 'next/server'
import { spGraph, spAuthCheck, assertSafeId } from '@/lib/sharepoint'

/* POST — crée une session d'upload Microsoft Graph */
export async function POST(req: NextRequest) {
  const authErr = await spAuthCheck()
  if (authErr) return authErr
  try {
    const { parentId, filename, size } = await req.json()
    if (!filename?.trim()) return NextResponse.json({ error: 'filename requis' }, { status: 400 })
    const safeName = filename.trim().replace(/[<>:"/\\|?*]/g, '_')
    const path = parentId
      ? `/items/${assertSafeId(parentId, 'parentId')}:/${encodeURIComponent(safeName)}:/createUploadSession`
      : `/root:/${encodeURIComponent(safeName)}:/createUploadSession`
    const res = await spGraph(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
          name: safeName,
          ...(size ? { size } : {}),
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
    return NextResponse.json({ uploadUrl: data.uploadUrl })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
