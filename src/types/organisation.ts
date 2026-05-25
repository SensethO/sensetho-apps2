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
  commune?: string
  departement?: string
  libelle_departement?: string
  region?: string
  libelle_region?: string
  latitude?: number | null
  longitude?: number | null
  date_creation?: string
  date_debut_activite?: string
  activite_principale?: string
  tranche_effectif_salarie?: string
  cedex?: string | null
}

export interface Complements {
  est_entrepreneur_individuel?: boolean | null
  est_entrepreneur_spectacle?: boolean | null
  est_finess?: boolean | null
  est_uai?: boolean | null
  est_rge?: boolean | null
  est_organisme_formation?: boolean | null
  est_qualiopi?: boolean | null
  est_bio?: boolean | null
  est_patrimoine_vivant?: boolean | null
  est_labor_agrement?: boolean | null
  convention_collective_renseignee?: boolean | null
  liste_idcc?: string[]
  liste_enseignes?: string[]
  liste_villes?: string[]
  liste_secteurs_activite_main_d_oeuvre?: string[]
}

export interface Organisation {
  id: string
  // ── Identifiants légaux ────────────────────────────────────────────────────
  siren: string | null
  siret_siege: string | null
  identifiant_association: string | null   // RNA
  // ── Dénomination ──────────────────────────────────────────────────────────
  denomination: string                     // nom affiché
  nom_commercial: string | null
  sigle: string | null
  liste_enseignes: string[] | null         // enseignes
  // ── Statut juridique ──────────────────────────────────────────────────────
  forme_juridique: string | null
  nature_juridique: string | null          // code
  etat_administratif: string | null        // A / C / F
  date_creation: string | null
  date_mise_a_jour: string | null
  // ── Activité ──────────────────────────────────────────────────────────────
  activite_principale: string | null       // code NAF
  section_activite_principale: string | null // A–U
  libelle_activite: string | null
  date_debut_activite: string | null
  // ── Effectif ──────────────────────────────────────────────────────────────
  effectif_tranche: string | null
  annee_effectif: string | null
  categorie_entreprise: string | null      // PME / ETI / GE
  // ── Établissements ────────────────────────────────────────────────────────
  nombre_etablissements: number | null
  nombre_etablissements_ouverts: number | null
  // ── Siège ─────────────────────────────────────────────────────────────────
  adresse: string | null
  code_postal: string | null
  commune: string | null                   // code INSEE
  ville: string | null
  departement: string | null              // code département
  libelle_departement: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  // ── Labels / statuts ──────────────────────────────────────────────────────
  est_association: boolean | null
  est_ess: boolean | null
  est_societe_mission: boolean | null
  est_service_public: boolean | null
  est_entrepreneur_individuel: boolean | null
  est_entrepreneur_spectacle: boolean | null
  est_finess: boolean | null
  est_uai: boolean | null
  est_rge: boolean | null                  // Reconnu Garant de l'Environnement
  est_organisme_formation: boolean | null
  est_qualiopi: boolean | null
  est_bio: boolean | null
  est_patrimoine_vivant: boolean | null
  est_labor_agrement: boolean | null       // Agrément service à la personne
  convention_collective_renseignee: boolean | null
  liste_idcc: string[] | null              // codes IDCC conventions collectives
  // ── Personnes ─────────────────────────────────────────────────────────────
  dirigeants: Dirigeant[]
  // ── Raw ───────────────────────────────────────────────────────────────────
  raw_data: Record<string, unknown> | null
  // ── Meta ──────────────────────────────────────────────────────────────────
  user_id: string
  created_at: string
  updated_at: string
}

// ── Résultat de recherche DATA.GOUV ───────────────────────────────────────────

export interface OrganisationSearchResult {
  // Identifiants
  siren: string | null
  siret_siege: string | null
  identifiant_association: string | null
  // Dénomination
  nom_complet: string
  nom_commercial: string | null
  sigle: string | null
  liste_enseignes: string[]
  // Statut juridique
  forme_juridique: string | null
  nature_juridique: string | null
  etat_administratif: string | null
  date_creation: string | null
  date_mise_a_jour: string | null
  // Activité
  activite_principale: string | null
  section_activite_principale: string | null
  libelle_activite: string | null
  date_debut_activite: string | null
  // Effectif
  effectif_tranche: string | null
  annee_effectif: string | null
  categorie_entreprise: string | null
  // Établissements
  nombre_etablissements: number | null
  nombre_etablissements_ouverts: number | null
  // Siège
  adresse: string | null
  code_postal: string | null
  commune: string | null
  ville: string | null
  departement: string | null
  libelle_departement: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  // Labels
  est_association: boolean | null
  est_ess: boolean | null
  est_societe_mission: boolean | null
  est_service_public: boolean | null
  est_entrepreneur_individuel: boolean | null
  est_entrepreneur_spectacle: boolean | null
  est_finess: boolean | null
  est_uai: boolean | null
  est_rge: boolean | null
  est_organisme_formation: boolean | null
  est_qualiopi: boolean | null
  est_bio: boolean | null
  est_patrimoine_vivant: boolean | null
  est_labor_agrement: boolean | null
  convention_collective_renseignee: boolean | null
  liste_idcc: string[]
  // Dirigeants
  dirigeants: Dirigeant[]
  // Raw
  raw_data: Record<string, unknown>
  // Enrichi côté front
  already_saved?: boolean
}
