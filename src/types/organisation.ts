// ── Types Organisation (DATA.GOUV / Supabase) ─────────────────────────────────

export interface Dirigeant {
  nom: string
  prenoms?: string
  qualite?: string
  date_naissance_partielle?: string
  nationalite?: string
  type_dirigeant?: 'personne_physique' | 'personne_morale'
  denomination?: string
  siren?: string
}

export interface Siege {
  siret?: string
  adresse?: string
  code_postal?: string
  libelle_commune?: string
  departement?: string
  region?: string
  latitude?: number | null
  longitude?: number | null
}

export interface Organisation {
  id: string
  // Identifiants légaux
  siren: string | null
  siret_siege: string | null
  identifiant_association: string | null   // RNA
  // Dénomination
  denomination: string                     // nom affiché
  nom_commercial: string | null
  sigle: string | null
  // Statut juridique
  forme_juridique: string | null
  nature_juridique: string | null
  etat_administratif: string | null        // A / C / F
  date_creation: string | null
  // Activité
  activite_principale: string | null
  libelle_activite: string | null
  categorie_entreprise: string | null      // PME / ETI / GE
  // Effectif
  effectif_tranche: string | null
  // Siège
  adresse: string | null
  code_postal: string | null
  ville: string | null
  region: string | null
  // Caractéristiques
  est_association: boolean | null
  est_ess: boolean | null
  est_societe_mission: boolean | null
  est_service_public: boolean | null
  // Personnes
  dirigeants: Dirigeant[]
  // Raw
  raw_data: Record<string, unknown> | null
  // Meta
  user_id: string
  created_at: string
  updated_at: string
}

// ── Résultat de recherche DATA.GOUV ───────────────────────────────────────────

export interface OrganisationSearchResult {
  siren: string | null
  siret_siege: string | null
  nom_complet: string
  nom_commercial: string | null
  sigle: string | null
  forme_juridique: string | null
  etat_administratif: string | null
  activite_principale: string | null
  libelle_activite: string | null
  categorie_entreprise: string | null
  effectif_tranche: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  region: string | null
  est_association: boolean | null
  est_ess: boolean | null
  est_societe_mission: boolean | null
  est_service_public: boolean | null
  dirigeants: Dirigeant[]
  identifiant_association: string | null
  raw_data: Record<string, unknown>
  // enrichi côté front
  already_saved?: boolean
}
