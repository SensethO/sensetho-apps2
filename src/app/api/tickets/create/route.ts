import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TicketType } from '@/types'

export async function POST(request: NextRequest) {
  const { email, subject, message, type } = await request.json() as {
    email?: string
    subject: string
    message?: string
    type?: TicketType
  }

  if (!subject?.trim()) {
    return NextResponse.json({ error: 'Le sujet est requis' }, { status: 400 })
  }

  // Essaie de récupérer l'utilisateur connecté
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Utilise service role pour contourner les RLS (tickets anonymes)
  const admin = createAdminClient()
  const { error } = await admin.from('tickets').insert({
    user_id: user?.id ?? null,
    email: email ?? user?.email ?? null,
    type: type ?? 'support',
    subject: subject.trim(),
    message: message?.trim() ?? null,
    status: 'open',
    priority: 'normal',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
