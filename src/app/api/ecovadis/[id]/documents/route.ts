import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'

export const dynamic = 'force-dynamic'

/**
 * Règle universelle RSE : aucun transit de fichier par Vercel ou Supabase.
 * Cet endpoint retourne UNIQUEMENT des métadonnées + URLs SharePoint directes.
 */

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin
    .from('ecovadis_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * GET /api/ecovadis/[id]/documents
 * Retourne tous les documents avec leurs URLs de téléchargement SharePoint directes.
 * Le téléchargement réel se fait navigateur → SharePoint, sans passer par Vercel.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: docs, error: dbErr } = await admin
      .from('ecovadis_documents')
      .select('*')
      .eq('diagnostic_id', params.id)
      .order('annexe_index', { ascending: true, nullsFirst: false })

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    if (!docs?.length) return NextResponse.json({ data: [] })

    // Obtenir les URLs SharePoint directes en parallèle
    const results = await Promise.allSettled(
      docs.map(async doc => {
        const res = await spGraphForApp('ecovadis-diagnostic', `/items/${doc.sp_item_id}`)
        if (!res.ok) {
          console.warn(`[ecovadis/documents] SP item not found: ${doc.sp_item_id}`)
          return null
        }
        const item = await res.json() as Record<string, unknown>
        const url = item['@microsoft.graph.downloadUrl'] as string | undefined
        if (!url) return null
        return { ...doc, url }
      })
    )

    const data = results
      .filter((r): r is PromiseFulfilledResult<NonNullable<(typeof results)[0] extends PromiseFulfilledResult<infer T> ? T : never>> =>
        r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * DELETE /api/ecovadis/[id]/documents?doc_id=xxx
 * Supprime le document de la DB ET de SharePoint.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const docId = searchParams.get('doc_id')
    if (!docId) return NextResponse.json({ error: 'doc_id requis' }, { status: 400 })

    const admin = createAdminClient()

    // Récupérer l'sp_item_id avant suppression
    const { data: doc } = await admin
      .from('ecovadis_documents')
      .select('sp_item_id')
      .eq('id', docId)
      .eq('diagnostic_id', params.id)
      .single()

    // Supprimer de la DB
    const { error } = await admin
      .from('ecovadis_documents')
      .delete()
      .eq('id', docId)
      .eq('diagnostic_id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Supprimer de SharePoint (fail-silent)
    if (doc?.sp_item_id) {
      try {
        await spGraphForApp('ecovadis-diagnostic', `/items/${doc.sp_item_id}`, { method: 'DELETE' })
      } catch (e) {
        console.warn('[ecovadis/documents/delete] SP delete failed', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
