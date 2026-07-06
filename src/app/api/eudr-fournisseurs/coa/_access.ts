import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessOrgDossier } from '@/lib/rseShares'
import { isOrgOwner } from '../traces/_auth'

/**
 * Résout les droits COA de l'utilisateur courant pour une organisation.
 *  - propriétaire du dossier (ou admin) : tous les droits ;
 *  - membre COA : rôle lecture (voir) / ecriture (remplir + analyser) / superviseur (+ valider) ;
 *  - l'accès en écriture s'appuie aussi sur le partage du dossier (rse_diagnostic_shares, droit édition).
 * La validation exige le rôle superviseur (ou propriétaire/admin).
 */
export interface CoaAccess {
  ok: boolean; status?: number; error?: string
  userId: string; email: string
  isOwner: boolean; role: 'lecture' | 'ecriture' | 'superviseur' | null
  canRead: boolean; canWrite: boolean; canValidate: boolean
}

export async function resolveCoaAccess(orgId: string | null): Promise<CoaAccess> {
  const empty = { userId: '', email: '', isOwner: false, role: null, canRead: false, canWrite: false, canValidate: false }
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized', ...empty }
  if (!orgId) return { ok: false, status: 400, error: 'org_id requis', ...empty }

  const admin = createAdminClient()
  const email = (user.email ?? '').toLowerCase()
  const isOwner = await isOrgOwner(user.id, orgId)

  const { data: member } = await admin.from('eudr_coa_members')
    .select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
  const role = (member?.role as CoaAccess['role']) ?? null

  const canRead = isOwner || role !== null || await canAccessOrgDossier('eudr-fournisseurs', user.id, orgId)
  const canWrite = isOwner || role === 'ecriture' || role === 'superviseur' || await canAccessOrgDossier('eudr-fournisseurs', user.id, orgId, { requireEdit: true })
  const canValidate = isOwner || role === 'superviseur'

  return { ok: true, userId: user.id, email, isOwner, role, canRead, canWrite, canValidate }
}
