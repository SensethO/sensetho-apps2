// Accès serveur à la table qonto_connections (une connexion Qonto par organisation)
// + garde d'autorisation commune aux routes /api/qonto/*.
// Lecture/écriture via le client service-role (les policies RLS protègent l'accès direct).

import { NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from './crypto'
import type { QontoCreds } from './client'

export interface QontoConnectionRow {
  id: string
  organisation_id: string
  login: string
  secret_key_cipher: string
  created_at: string
  updated_at: string
}

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

/** Ligne de connexion brute (secret chiffré) ou null si aucune connexion. */
export async function getConnection(organisationId: string): Promise<QontoConnectionRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('qonto_connections')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return (data as QontoConnectionRow | null) ?? null
}

/** Identifiants Qonto déchiffrés pour une organisation, ou null si aucune connexion. */
export async function getCreds(organisationId: string): Promise<QontoCreds | null> {
  const row = await getConnection(organisationId)
  if (!row) return null
  return { login: row.login, secretKey: decryptSecret(row.secret_key_cipher) }
}

/** Masque un login pour affichage (ex. "monheure-1234" → "mo•••••••234"). */
export function maskLogin(login: string): string {
  if (login.length <= 5) return `${login[0] ?? ''}••••`
  return `${login.slice(0, 2)}${'•'.repeat(Math.max(3, login.length - 5))}${login.slice(-3)}`
}
