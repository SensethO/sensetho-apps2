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
      // Identifiants
      siren:                    result.siren,
      siret_siege:              result.siret_siege,
      identifiant_association:  result.identifiant_association,
      // Dénomination
      denomination:             result.nom_complet,
      nom_commercial:           result.nom_commercial,
      sigle:                    result.sigle,
      liste_enseignes:          result.liste_enseignes,
      // Statut juridique
      forme_juridique:          result.forme_juridique,
      nature_juridique:         result.nature_juridique,
      etat_administratif:       result.etat_administratif,
      date_creation:            result.date_creation,
      date_mise_a_jour:         result.date_mise_a_jour,
      // Activité
      activite_principale:         result.activite_principale,
      section_activite_principale: result.section_activite_principale,
      libelle_activite:            result.libelle_activite,
      date_debut_activite:         result.date_debut_activite,
      // Effectif
      effectif_tranche:         result.effectif_tranche,
      annee_effectif:           result.annee_effectif,
      categorie_entreprise:     result.categorie_entreprise,
      // Établissements
      nombre_etablissements:         result.nombre_etablissements,
      nombre_etablissements_ouverts: result.nombre_etablissements_ouverts,
      // Siège
      adresse:             result.adresse,
      code_postal:         result.code_postal,
      commune:             result.commune,
      ville:               result.ville,
      departement:         result.departement,
      libelle_departement: result.libelle_departement,
      region:              result.region,
      latitude:            result.latitude,
      longitude:           result.longitude,
      // Labels
      est_association:             result.est_association,
      est_ess:                     result.est_ess,
      est_societe_mission:         result.est_societe_mission,
      est_service_public:          result.est_service_public,
      est_entrepreneur_individuel: result.est_entrepreneur_individuel,
      est_entrepreneur_spectacle:  result.est_entrepreneur_spectacle,
      est_finess:                  result.est_finess,
      est_uai:                     result.est_uai,
      est_rge:                     result.est_rge,
      est_organisme_formation:     result.est_organisme_formation,
      est_qualiopi:                result.est_qualiopi,
      est_bio:                     result.est_bio,
      est_patrimoine_vivant:       result.est_patrimoine_vivant,
      est_labor_agrement:          result.est_labor_agrement,
      convention_collective_renseignee: result.convention_collective_renseignee,
      liste_idcc:                  result.liste_idcc,
      // Personnes
      dirigeants: result.dirigeants,
      raw_data:   result.raw_data,
      user_id:    user.id,
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

  async function toggleFavorite(id: string) {
    const supabase = createClient()
    const org = organisations.find(o => o.id === id)
    if (!org) return
    const next = !org.is_favorite
    // Optimistic update
    setOrganisations(prev => prev.map(o => o.id === id ? { ...o, is_favorite: next } : o))
    const { error } = await supabase
      .from('organisations')
      .update({ is_favorite: next })
      .eq('id', id)
    if (error) {
      // Rollback
      setOrganisations(prev => prev.map(o => o.id === id ? { ...o, is_favorite: !next } : o))
      console.error('[useOrganisations] toggleFavorite error', error)
    }
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('organisations').delete().eq('id', id)
    setOrganisations(prev => prev.filter(o => o.id !== id))
  }

  return { organisations, loading, reload: load, save, saveManual, remove, toggleFavorite }
}
