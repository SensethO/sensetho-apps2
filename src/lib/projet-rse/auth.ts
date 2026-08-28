// Garde d'autorisation commune aux routes /api/projet-rse/*.
// Dupliquée du pattern sindup (src/lib/sindup/auth.ts) pour garder
// l'app Projet RSE indépendante des autres modules.

import { NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ProjetRseProjet {
  id: string
  organisation_id: string
  nom: string
  description: string | null
  contexte: string | null
  statut: 'actif' | 'suspendu' | 'clos'
  phase: 'pre_project' | 'discovery' | 'design' | 'delivery' | 'closure'
  date_debut: string | null
  date_fin_prevue: string | null
  business_case: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Ordre du cycle PRiSM — utilisé pour l'avancement automatique après un « go ». */
export const PHASES = ['pre_project', 'discovery', 'design', 'delivery', 'closure'] as const

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

/**
 * Garde par projet : utilisateur connecté + propriétaire de l'organisation
 * du projet (ou admin). Retourne { userId, projet } ou une NextResponse d'erreur.
 */
export async function requireProjet(
  projetId: string
): Promise<{ userId: string; projet: ProjetRseProjet } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: projet } = await admin
    .from('projet_rse_projets')
    .select('*')
    .eq('id', projetId)
    .maybeSingle()
  if (!projet) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  if (!await isOrgOwner(user.id, projet.organisation_id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  return { userId: user.id, projet: projet as ProjetRseProjet }
}
