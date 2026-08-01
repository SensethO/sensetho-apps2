/**
 * Le Miroir — droit de pilotage d'une campagne (côté serveur).
 *
 * Règle : seul le **responsable validé** de la campagne, ou un administrateur
 * du site, peut piloter (cellules, socle, liens d'invitation, envois, clôture).
 * Créer une campagne ne confère pas ce droit — un administrateur doit désigner
 * le responsable (le verrou est aussi posé en base par un déclencheur).
 */
import { createAdminClient } from '@/lib/supabase/admin'

export async function peutPiloter(userId: string, campagneId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: camp } = await admin
    .from('le_miroir_campagnes').select('responsable_id').eq('id', campagneId).maybeSingle()
  if (!camp) return false
  if (camp.responsable_id && camp.responsable_id === userId) return true
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return prof?.role === 'admin'
}

export async function estAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}
