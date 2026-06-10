/**
 * GET  /api/bilan-ges/sessions  → mes sessions Bilan GES (calculateur)
 * POST /api/bilan-ges/sessions  → créer une nouvelle session
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_sessions')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'archive')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { name, organisation = '', organisation_id = null, secteur = '', exercice, methode = 'ghg_protocol' } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bilan_ges_sessions')
      .insert({
        user_id:         user.id,
        name:            name.trim(),
        organisation:    organisation.trim(),
        organisation_id: organisation_id ?? null,
        secteur:         secteur?.trim() ?? '',
        exercice:        exercice ?? new Date().getFullYear().toString(),
        methode,
        status:          'actif',
        scope1:          { entries: [] },
        scope2:          { entries: [], methode_s2: 'location' },
        scope3:          { entries: [], categories_pertinentes: {} },
        esrs_e1:         methode === 'csrd_esrs' ? {
          objectifs: [], energie_renouvelable_mwh: null, energie_non_renouvelable_mwh: null,
          absorptions: [], notes_objectifs: '', notes_energie: '', notes_absorptions: '',
        } : null,
        total_scope1: 0, total_scope2: 0, total_scope3: 0, total_global: 0,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
