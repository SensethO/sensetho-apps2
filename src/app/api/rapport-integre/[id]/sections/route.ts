import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canWrite(userId: string, rapportId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('rapports_integres').select('user_id').eq('id', rapportId).single()
  return data?.user_id === userId
}

/** GET /api/rapport-integre/[id]/sections */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('rapport_sections')
      .select('*')
      .eq('rapport_id', params.id)
      .order('ordre')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT /api/rapport-integre/[id]/sections
 * Body: { element_id, titre?, content?, data_imports?, ordre? }
 * Upsert sur (rapport_id, element_id)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      element_id: string; titre?: string; content?: string
      data_imports?: unknown[]; ordre?: number
    }
    if (!body.element_id) return NextResponse.json({ error: 'element_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('rapport_sections')
      .upsert({
        rapport_id: params.id,
        element_id: body.element_id,
        titre: body.titre,
        content: body.content ?? '',
        data_imports: body.data_imports ?? [],
        ordre: body.ordre ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'rapport_id,element_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recalculer score_completion : % de sections renseignées
    const { data: allSections } = await admin
      .from('rapport_sections')
      .select('content')
      .eq('rapport_id', params.id)

    const filled = (allSections ?? []).filter(s => (s.content ?? '').trim().length > 0).length
    const total = (allSections ?? []).length
    const score = total > 0 ? Math.round((filled / total) * 100) : 0

    await admin.from('rapports_integres')
      .update({ score_completion: score, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
