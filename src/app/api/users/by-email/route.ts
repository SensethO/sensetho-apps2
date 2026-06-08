import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/users/by-email
 * Résoudre un user_id à partir d'un email (requiert d'être authentifié).
 * Utilisé pour le partage de projets entre collaborateurs.
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await req.json()
    if (!email?.trim()) return NextResponse.json({ error: 'email requis' }, { status: 400 })

    const admin = createAdminClient()
    // Recherche dans auth.users via l'admin API
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const found = data.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
    if (!found) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    // Ne renvoyer que le minimum nécessaire
    return NextResponse.json({ data: { id: found.id, email: found.email } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
