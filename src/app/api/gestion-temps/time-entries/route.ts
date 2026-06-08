import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gestion-temps/time-entries?project_id=...&action_id=...&date_from=...&date_to=...
 * Retourne les saisies de l'utilisateur (et de tous pour ses projets en tant que owner)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')
    const actionId  = url.searchParams.get('action_id')
    const dateFrom  = url.searchParams.get('date_from')
    const dateTo    = url.searchParams.get('date_to')
    const orgId     = url.searchParams.get('org_id')

    const admin = createAdminClient()

    // Projets dont je suis propriétaire (pour voir toutes les saisies), filtrés par org si spécifié
    let ownedQuery = admin.from('gt_projects').select('id').eq('owner_id', user.id)
    if (orgId) ownedQuery = ownedQuery.eq('org_id', orgId)
    const { data: ownedProjects } = await ownedQuery
    const ownedIds = new Set((ownedProjects ?? []).map((p: { id: string }) => p.id))

    // Si org_id spécifié, restreindre aussi les projets partagés à cette org
    if (orgId && !projectId) {
      const { data: sharedRows } = await admin
        .from('gt_project_members').select('project_id').eq('user_id', user.id)
      const sharedProjectIds = (sharedRows ?? []).map(r => r.project_id)
      if (sharedProjectIds.length > 0) {
        const { data: sharedInOrg } = await admin
          .from('gt_projects').select('id').in('id', sharedProjectIds).eq('org_id', orgId)
        ;(sharedInOrg ?? []).forEach((p: { id: string }) => ownedIds.add(p.id))
      }
    }

    let query = admin.from('gt_time_entries').select(`
      id, action_id, project_id, user_id, user_email, date, hours, note, created_at,
      gt_actions!inner(name),
      gt_projects!inner(name, color, type)
    `)

    // Filtrer par projet si spécifié
    if (projectId) {
      query = query.eq('project_id', projectId)
      // Vérifier l'accès
      const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', projectId).single()
      if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
      if (project.owner_id !== user.id) {
        // Je ne peux voir que mes propres saisies
        query = query.eq('user_id', user.id)
      }
    } else {
      // Sans filtre projet : mes saisies + saisies de tous sur mes projets
      query = query.or(`user_id.eq.${user.id},project_id.in.(${Array.from(ownedIds).join(',') || 'null'})`)
    }

    if (actionId) query = query.eq('action_id', actionId)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo)   query = query.lte('date', dateTo)

    const { data: entries, error } = await query.order('date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = (entries ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      action_name:  (e.gt_actions as { name: string } | null)?.name,
      project_name: (e.gt_projects as { name: string; color: string; type: string } | null)?.name,
      project_color: (e.gt_projects as { name: string; color: string; type: string } | null)?.color,
      project_type: (e.gt_projects as { name: string; color: string; type: string } | null)?.type,
    }))

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * POST /api/gestion-temps/time-entries — enregistrer une saisie de temps
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action_id, date, hours, note } = body
    if (!action_id || !date || !hours) return NextResponse.json({ error: 'action_id, date, hours requis' }, { status: 400 })
    if (Number(hours) <= 0 || Number(hours) > 24) return NextResponse.json({ error: 'hours doit être entre 0 et 24' }, { status: 400 })

    const admin = createAdminClient()
    // Récupérer le projet depuis l'action
    const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', action_id).single()
    if (!action) return NextResponse.json({ error: 'Action introuvable' }, { status: 404 })

    // Vérifier l'accès au projet
    const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', action.project_id).single()
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

    if (project.owner_id !== user.id) {
      const { data: member } = await admin.from('gt_project_members')
        .select('role').eq('project_id', action.project_id).eq('user_id', user.id).maybeSingle()
      if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const userEmail = user.email ?? ''
    const { data, error } = await admin.from('gt_time_entries').insert({
      action_id,
      project_id: action.project_id,
      user_id: user.id,
      user_email: userEmail,
      date,
      hours: Number(hours),
      note: note || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
