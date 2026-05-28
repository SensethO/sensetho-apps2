import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Génère un mot de passe temporaire lisible : 12 caractères sans ambiguïté (pas O/0/I/l) */
function generateTempPassword(): string {
  const upper  = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower  = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$'
  const all = upper + lower + digits + special

  // Garantit au moins un de chaque type
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const base = [pick(upper), pick(lower), pick(digits), pick(special)]
  for (let i = 0; i < 8; i++) base.push(pick(all))

  // Mélange (Fisher-Yates)
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]]
  }
  return base.join('')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId manquant' }, { status: 400 })

  const tempPassword = generateTempPassword()

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)

  // Retourne le mot de passe temporaire pour que l'admin puisse le copier/coller
  return NextResponse.json({ ok: true, tempPassword })
}
