/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Constats de non-conformité ECGT.
 *
 *  GET   /api/ecgt/constats?contenu_id=xxx      → { data: Constat[] }
 *  GET   /api/ecgt/constats?diagnostic_id=xxx   → tous les constats du diagnostic
 *  PATCH /api/ecgt/constats?id=xxx              → { statut: 'ouvert'|'corrige'|'ecarte' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessDiagnostic } from '@/lib/rseShares'
import type { EcgtConstatStatut } from '@/lib/ecgt/referentiel'

export const dynamic = 'force-dynamic'

const APP_SLUG = 'ecgt'
const TABLE = 'ecgt_diagnostics'
const STATUTS: EcgtConstatStatut[] = ['ouvert', 'corrige', 'ecarte']

const canAccess = (userId: string, diagnosticId: string, requireEdit = false) =>
  canAccessDiagnostic(APP_SLUG, TABLE, userId, diagnosticId, { requireEdit })

/** GET /api/ecgt/constats?contenu_id=xxx | ?diagnostic_id=xxx */
export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contenuId = req.nextUrl.searchParams.get('contenu_id')
    const diagnosticId = req.nextUrl.searchParams.get('diagnostic_id')
    if (!contenuId && !diagnosticId) {
      return NextResponse.json({ error: 'contenu_id ou diagnostic_id requis' }, { status: 400 })
    }

    const admin = createAdminClient()

    if (contenuId) {
      const { data: contenu } = await admin.from('ecgt_contenus').select('diagnostic_id').eq('id', contenuId).maybeSingle()
      if (!contenu) return NextResponse.json({ error: 'Contenu non trouvé' }, { status: 404 })
      if (!await canAccess(user.id, contenu.diagnostic_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const { data, error } = await admin
        .from('ecgt_constats')
        .select('*')
        .eq('contenu_id', contenuId)
        .order('created_at')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: data ?? [] })
    }

    if (!await canAccess(user.id, diagnosticId as string)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: contenus } = await admin.from('ecgt_contenus').select('id').eq('diagnostic_id', diagnosticId)
    const ids = (contenus ?? []).map((c: any) => c.id)
    if (!ids.length) return NextResponse.json({ data: [] })

    const { data, error } = await admin
      .from('ecgt_constats')
      .select('*')
      .in('contenu_id', ids)
      .order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PATCH /api/ecgt/constats?id=xxx — body { statut } */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const body = await req.json() as { statut?: string }
    const statut = (body.statut ?? '').trim() as EcgtConstatStatut
    if (!STATUTS.includes(statut)) {
      return NextResponse.json({ error: `statut requis parmi ${STATUTS.join(', ')}` }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: constat } = await admin
      .from('ecgt_constats')
      .select('id, contenu_id, ecgt_contenus!inner(diagnostic_id)')
      .eq('id', id)
      .maybeSingle()
    if (!constat) return NextResponse.json({ error: 'Constat non trouvé' }, { status: 404 })

    const joined = (constat as any).ecgt_contenus
    const diagnosticId = Array.isArray(joined) ? joined[0]?.diagnostic_id : joined?.diagnostic_id
    if (!diagnosticId) return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })
    if (!await canAccess(user.id, diagnosticId, true)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await admin
      .from('ecgt_constats')
      .update({ statut })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
