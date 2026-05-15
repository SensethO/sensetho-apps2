import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { password } = await request.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 })
  }

  // Utilise le client admin pour changer le mot de passe
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Réinitialise le flag must_change_password
  await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
