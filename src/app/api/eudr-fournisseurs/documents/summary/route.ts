import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?org_id — Présence des types de documents par entité (fournisseurs & contrats),
 * en un seul appel, pour afficher la complétude EUDR dans la liste sans N requêtes.
 * Ne renvoie que des métadonnées agrégées (jamais de fichier). Documents retirés exclus.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()
    const { data } = await admin.from('eudr_attachments')
      .select('entity_id, doc_type')
      .eq('org_id', orgId)
      .is('retire_le', null)

    const map: Record<string, string[]> = {}
    for (const r of (data ?? [])) {
      const key = r.entity_id as string
      const t = r.doc_type as string
      if (!map[key]) map[key] = []
      if (!map[key].includes(t)) map[key].push(t)
    }
    return NextResponse.json({ data: map })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
