/**
 * GET /api/users/search?q=...
 * Recherche d'utilisateurs par prénom, nom ou email.
 * Accessible à tous les utilisateurs connectés.
 * Retourne : id, full_name, email (pour l'autocomplete partage).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return NextResponse.json({ data: [] })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, full_name, role')
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', user.id)          // Exclure soi-même
      .eq('status', 'active')      // Seulement les comptes actifs
      .limit(8)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
