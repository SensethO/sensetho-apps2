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

  const admin = createAdminClient()

  // Change le mot de passe via l'API admin
  const { error: pwdError } = await admin.auth.admin.updateUserById(user.id, { password })
  if (pwdError) return NextResponse.json({ error: pwdError.message }, { status: 500 })

  // Réinitialise le flag must_change_password
  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (profileError) {
    console.error('[change-password] profile update error:', profileError)
    // On retourne quand même ok=true car le mdp a changé
    // mais on log l'erreur pour debug
  }

  return NextResponse.json({ ok: true })
}
