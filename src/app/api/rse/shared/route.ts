import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findSharedOrgs } from '@/lib/rseShares'

export const dynamic = 'force-dynamic'

// Apps métier scopées par organisation : le partage utilise diagnostic_id = org_id (pas de table de diagnostic).
const ORG_KEYED = new Set(['eudr-fournisseurs'])

/**
 * GET /api/rse/shared?app=<slug>
 * Renvoie les organisations + années dont un diagnostic a été partagé avec
 * l'utilisateur courant pour cette app (les orgs/années étant privées via RLS,
 * on les remonte ici via le service role pour alimenter la sidebar du destinataire).
 * Réponse : { organisations: Organisation[], yearsByOrg: { [orgId]: number[] }, permissionByOrg: { [orgId]: 'read'|'edit' } }
 */

// Slugs marbre autorisés → nom de table (évite toute injection sur .from())
const SLUG_TABLE: Record<string, string> = {
  'collecte-rse': 'collecte_rse_diagnostics',
  'gpsr': 'gpsr_diagnostics',
  'bilan-ges': 'bilan_ges_diagnostics',
  'act-carbone': 'act_carbone_diagnostics',
  'label-nr': 'label_nr_diagnostics',
  'bcorp': 'bcorp_diagnostics',
  'iso45001': 'iso45001_diagnostics',
  'iso50001': 'iso50001_diagnostics',
  'afaq26000': 'afaq26000_diagnostics',
  'eudr': 'eudr_diagnostics',
  'vigilance': 'vigilance_diagnostics',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const app = req.nextUrl.searchParams.get('app') ?? ''

    // Apps métier org-scopées (ex. eudr-fournisseurs) : org partagée directement, sans année ni diagnostic.
    if (ORG_KEYED.has(app)) {
      const organisations = await findSharedOrgs(app, user.id)
      return NextResponse.json({ organisations, yearsByOrg: {}, permissionByOrg: {} })
    }

    const table = SLUG_TABLE[app]
    if (!table) return NextResponse.json({ organisations: [], yearsByOrg: {}, permissionByOrg: {} })

    const admin = createAdminClient()
    const { data: shares } = await admin
      .from('rse_diagnostic_shares')
      .select('diagnostic_id, permission')
      .eq('app_slug', app)
      .eq('shared_with_user_id', user.id)

    const diagIds = (shares ?? []).map(s => s.diagnostic_id as string)
    if (!diagIds.length) return NextResponse.json({ organisations: [], yearsByOrg: {}, permissionByOrg: {} })
    const permByDiag = Object.fromEntries((shares ?? []).map(s => [s.diagnostic_id, s.permission]))

    const { data: diags } = await admin
      .from(table)
      .select('id, org_id, annee')
      .in('id', diagIds)

    const yearsByOrg: Record<string, number[]> = {}
    const permissionByOrg: Record<string, string> = {}
    const orgIds = new Set<string>()
    for (const d of (diags ?? [])) {
      const orgId = d.org_id as string
      if (!orgId) continue
      orgIds.add(orgId)
      ;(yearsByOrg[orgId] ??= []).push(d.annee as number)
      // si plusieurs partages sur la même org, 'edit' l'emporte
      const p = permByDiag[d.id as string] as string
      if (p === 'edit' || !permissionByOrg[orgId]) permissionByOrg[orgId] = p
    }
    for (const k of Object.keys(yearsByOrg)) yearsByOrg[k] = [...new Set(yearsByOrg[k])].sort((a, b) => a - b)

    let organisations: unknown[] = []
    if (orgIds.size) {
      const { data: orgs } = await admin.from('organisations').select('*').in('id', [...orgIds])
      organisations = orgs ?? []
    }

    return NextResponse.json({ organisations, yearsByOrg, permissionByOrg })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
