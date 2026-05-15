'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Organisation, OrganisationSearchResult } from '@/types/organisation'

export function useOrganisations() {
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('organisations')
      .select('*')
      .order('denomination', { ascending: true })
    setOrganisations((data ?? []) as Organisation[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save(result: OrganisationSearchResult): Promise<Organisation | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const payload = {
      siren: result.siren,
      siret_siege: result.siret_siege,
      identifiant_association: result.identifiant_association,
      denomination: result.nom_complet,
      nom_commercial: result.nom_commercial,
      sigle: result.sigle,
      forme_juridique: result.forme_juridique,
      etat_administratif: result.etat_administratif,
      activite_principale: result.activite_principale,
      libelle_activite: result.libelle_activite,
      categorie_entreprise: result.categorie_entreprise,
      effectif_tranche: result.effectif_tranche,
      adresse: result.adresse,
      code_postal: result.code_postal,
      ville: result.ville,
      region: result.region,
      est_association: result.est_association,
      est_ess: result.est_ess,
      est_societe_mission: result.est_societe_mission,
      est_service_public: result.est_service_public,
      dirigeants: result.dirigeants,
      raw_data: result.raw_data,
      user_id: user.id,
    }

    const { data, error } = await supabase
      .from('organisations')
      .upsert(payload, { onConflict: result.siren ? 'siren' : 'id' })
      .select()
      .single()

    if (error) { console.error('[useOrganisations] save error', error); return null }
    await load()
    return data as Organisation
  }

  async function saveManual(denomination: string, siren?: string): Promise<Organisation | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('organisations')
      .insert({ denomination, siren: siren ?? null, user_id: user.id, dirigeants: [] })
      .select()
      .single()

    if (error) { console.error('[useOrganisations] saveManual error', error); return null }
    await load()
    return data as Organisation
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('organisations').delete().eq('id', id)
    setOrganisations(prev => prev.filter(o => o.id !== id))
  }

  return { organisations, loading, reload: load, save, saveManual, remove }
}
