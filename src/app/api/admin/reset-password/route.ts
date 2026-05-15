import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { userId, password } = await request.json()
  if (!userId || !password) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Mot de passe trop court (8 car. min.)' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
