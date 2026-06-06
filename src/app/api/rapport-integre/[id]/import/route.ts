import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rapport-integre/[id]/import
 * Récupère les scores de tous les diagnostics RSE disponibles pour le même org+annee.
 * Chaque source retourne : { score, statut, label, url }
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: rapport } = await admin
      .from('rapports_integres')
      .select('org_id, annee, user_id')
      .eq('id', params.id)
      .single()

    if (!rapport) return NextResponse.json({ error: 'Rapport non trouvé' }, { status: 404 })

    const isAdmin = await admin.from('profiles').select('role').eq('id', user.id).single()
      .then(r => r.data?.role === 'admin')
    if (!isAdmin && rapport.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { org_id, annee } = rapport
    const sources: Record<string, { score: number | null; statut: string | null; label: string; route: string; color: string }> = {}

    // Diagnostic initial guidé
    try {
      const { data } = await admin.from('guided_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.diagnostic_initial = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'Diagnostic RSE Guidé', route: '/rse/diagnostic-initial', color: '#6366f1' }
    } catch { sources.diagnostic_initial = { score: null, statut: null, label: 'Diagnostic RSE Guidé', route: '/rse/diagnostic-initial', color: '#6366f1' } }

    // ISO 26000
    try {
      const { data } = await admin.from('iso26000_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.iso26000 = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'ISO 26000', route: '/rse/iso26000', color: '#0ea5e9' }
    } catch { sources.iso26000 = { score: null, statut: null, label: 'ISO 26000', route: '/rse/iso26000', color: '#0ea5e9' } }

    // EUDR
    try {
      const { data } = await admin.from('eudr_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.eudr = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'EUDR', route: '/rse/eudr', color: '#16a34a' }
    } catch { sources.eudr = { score: null, statut: null, label: 'EUDR', route: '/rse/eudr', color: '#16a34a' } }

    // Sapin II
    try {
      const { data } = await admin.from('sapin2_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.sapin2 = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'Loi Sapin II', route: '/rse/sapin2', color: '#065f46' }
    } catch { sources.sapin2 = { score: null, statut: null, label: 'Loi Sapin II', route: '/rse/sapin2', color: '#065f46' } }

    // Devoir de Vigilance
    try {
      const { data } = await admin.from('vigilance_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.vigilance = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'Devoir de Vigilance', route: '/rse/vigilance', color: '#7c3aed' }
    } catch { sources.vigilance = { score: null, statut: null, label: 'Devoir de Vigilance', route: '/rse/vigilance', color: '#7c3aed' } }

    // VSME EFRAG
    try {
      const { data } = await admin.from('vsme_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.vsme = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'VSME EFRAG', route: '/rse/vsme-efrag', color: '#b45309' }
    } catch { sources.vsme = { score: null, statut: null, label: 'VSME EFRAG', route: '/rse/vsme-efrag', color: '#b45309' } }

    // EcoVadis
    try {
      const { data } = await admin.from('ecovadis_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.ecovadis = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'EcoVadis', route: '/rse/ecovadis', color: '#ea580c' }
    } catch { sources.ecovadis = { score: null, statut: null, label: 'EcoVadis', route: '/rse/ecovadis', color: '#ea580c' } }

    // Label AFNOR RSE
    try {
      const { data } = await admin.from('afnor_diagnostics')
        .select('score_global, statut').eq('org_id', org_id).eq('annee', annee).eq('user_id', rapport.user_id).maybeSingle()
      sources.afnor = { score: data?.score_global ?? null, statut: data?.statut ?? null, label: 'Label AFNOR RSE', route: '/rse/afnor-rse', color: '#dc2626' }
    } catch { sources.afnor = { score: null, statut: null, label: 'Label AFNOR RSE', route: '/rse/afnor-rse', color: '#dc2626' } }

    return NextResponse.json({ data: sources })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
