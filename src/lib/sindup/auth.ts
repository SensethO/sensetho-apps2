// Garde d'autorisation commune aux routes /api/veille-sindup/*.
// Dupliquée du pattern qonto (src/lib/qonto/connections.ts) pour garder
// l'app Veille Sindup indépendante du module Qonto.

import { NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

/** Propriétaire de l'organisation (organisations.user_id) ou admin (profiles.role). */
export async function isOrgOwner(userId: string, organisationId: string): Promise<boolean> {
  if (await isAdmin(userId)) return true
  const admin = createAdminClient()
  const { data } = await admin.from('organisations').select('user_id').eq('id', organisationId).single()
  return data?.user_id === userId
}

/**
 * Garde commune : utilisateur connecté + propriétaire de l'organisation ciblée (ou admin).
 * Retourne { userId } ou une NextResponse d'erreur prête à renvoyer.
 */
export async function requireOrgOwner(
  organisationId: string | null
): Promise<{ userId: string } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!organisationId) return NextResponse.json({ error: 'organisation_id requis' }, { status: 400 })
  if (!await isOrgOwner(user.id, organisationId)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  return { userId: user.id }
}
