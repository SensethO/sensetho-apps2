import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** GET /api/parties-prenantes/sessions — liste avec compteurs (PP identifiées, enquêtes, sujets matériels) */
export async function GET() {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    // Inclut les JSONB pour calculer les compteurs côté serveur
    const { data, error } = await admin
      .from('pp_sessions')
      .select('id, name, organisation, secteur, exercice, mode, materiality_type, status, created_at, updated_at, stakeholders, surveys, materiality_scores')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Extraire les compteurs et supprimer les JSONB lourds de la réponse
    const processed = (data ?? []).map(s => {
      const stakeholders = Array.isArray(s.stakeholders) ? s.stakeholders : []
      const surveys = Array.isArray(s.surveys) ? s.surveys : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matScores = Array.isArray(s.materiality_scores) ? s.materiality_scores : []
      return {
        id: s.id,
        name: s.name,
        organisation: s.organisation,
        secteur: s.secteur,
        exercice: s.exercice,
        mode: s.mode,
        materiality_type: s.materiality_type,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at,
        pp_count: stakeholders.length,
        surveys_count: surveys.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        material_count: matScores.filter((ms: any) => ms.is_material === true).length,
      }
    })

    return NextResponse.json({ data: processed })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/parties-prenantes/sessions — crée une session */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      name: string
      organisation?: string
      secteur?: string
      exercice?: string
      mode?: string
      materiality_type?: string
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pp_sessions')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        organisation: body.organisation ?? null,
        secteur: body.secteur ?? null,
        exercice: body.exercice ?? new Date().getFullYear().toString(),
        mode: body.mode ?? 'csrd',
        materiality_type: body.materiality_type ?? 'double',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
