import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Stakeholder } from '@/types/parties-prenantes'

export const dynamic = 'force-dynamic'

/** POST /api/parties-prenantes/sessions/[id]/surveys/[surveyId]/import-stakeholders
 *  Reçoit { stakeholders: [{name, email}] }, les ajoute à session.stakeholders */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; surveyId: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: session } = await admin
      .from('pp_sessions')
      .select('id, stakeholders')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { stakeholders?: Array<{ name: string; email?: string }> }
    const incoming = body.stakeholders ?? []

    const existing = (session.stakeholders ?? []) as Stakeholder[]

    const now = new Date().toISOString()
    const newOnes: Stakeholder[] = incoming.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      email: s.email,
      category: 'externe',
      type: 'clients',
      influence: 3,
      interest: 3,
      engagement_type: 'csrd',
      created_at: now,
    }))

    const merged = [...existing, ...newOnes]

    const { error } = await admin
      .from('pp_sessions')
      .update({ stakeholders: merged })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { stakeholders: merged } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
