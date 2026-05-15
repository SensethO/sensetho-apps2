import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Theme } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { theme } = await request.json() as { theme: Theme }
  if (!['light', 'dark', 'system'].includes(theme)) {
    return NextResponse.json({ error: 'Thème invalide' }, { status: 400 })
  }

  await supabase.from('user_preferences').upsert({ user_id: user.id, theme }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
