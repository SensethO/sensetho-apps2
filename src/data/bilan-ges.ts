/**
 * Bilan GES — Données de référence
 * Sources : ADEME Base Carbone v22 (2023), GHG Protocol Corporate Standard
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type GESMethode = 'ghg_protocol' | 'bilan_carbone' | 'csrd_esrs'
export type ScopeId = 'scope1' | 'scope2' | 'scope3'
export type S3CatId =
  | 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5'
  | 'cat6' | 'cat7' | 'cat8' | 'cat9' | 'cat10'
  | 'cat11' | 'cat12' | 'cat13' | 'cat14' | 'cat15'

export interface EmissionSource {
  id: string
  label: string
  scope: ScopeId
  subcategory: string     // ex: 'combustion_fixe'
  s3_cat?: S3CatId        // uniquement pour scope3
  unit: string
  factor: number          // tCO2e / unité
  factor_source: string
  description?: string
}

export interface GESEntrySection {
  id: string
  title: string        // Tiptap HTML
  content: string      // Tiptap HTML
  attachments: GESEntryAttachment[]
}

export interface GESEntryAttachment {
  id: string
  name: string
  path: string        // SharePoint item ID (sans /)
  size: number        // bytes
  mime: string
  uploaded_at: string
  prefix?: string     // ex: "SC1", "SC2", "SC3-C6" — fixé à l'upload, non modifiable
}

export interface GESEntry {
  id: string
  source_id: string | null
  source_label: string
  subcategory: string
  s3_cat?: S3CatId
  quantity: number
  unit: string
  factor: number          // tCO2e / unité
  factor_custom: boolean
  total_tco2e: number
  lieu: string            // site / bâtiment / département
  notes: string
  sections?: GESEntrySection[]
  attachments?: GESEntryAttachment[]
}

export interface GESObjectif {
  annee_baseline: string | null
  valeur_baseline_tco2e: number | null
  annee_cible: string | null
  reduction_pct: number | null
  perimetre: string       // ex: 'Scopes 1, 2 et 3'
  sbtialigne: boolean
  notes: string
}

export interface GESScope2Config {
  methode_s2: 'location' | 'market'
  entries: GESEntry[]
}

export interface GESScope3Config {
  entries: GESEntry[]
  categories_pertinentes: Partial<Record<S3CatId, boolean>>
}

export interface ESRSE1Data {
  objectifs: ESRSObjectif[]
  energie_renouvelable_mwh: number | null
  energie_non_renouvelable_mwh: number | null
  absorptions: ESRSAbsorption[]
  notes_objectifs: string
  notes_energie: string
  notes_absorptions: string
}

export interface ESRSObjectif {
  id: string
  label: string
  annee_baseline: number | null
  valeur_baseline_tco2e: number | null
  annee_cible: number | null
  reduction_pct: number | null
  perimetre: string
  sbtialigne: boolean
  notes: string
}

export interface ESRSAbsorption {
  id: string
  label: string
  type: 'nature' | 'technologie' | 'autre'
  tco2e_annuel: number | null
  notes: string
}

export interface GESSessionData {
  id: string
  user_id: string
  name: string
  organisation: string
  organisation_id: string | null
  secteur: string
  exercice: string
  methode: GESMethode
  status: 'actif' | 'archive' | 'termine'
  scope1: { entries: GESEntry[] }
  scope2: GESScope2Config
  scope3: GESScope3Config
  esrs_e1: ESRSE1Data | null
  objectif: GESObjectif | null
  total_scope1: number
  total_scope2: number
  total_scope3: number
  total_global: number
  notes: string
  created_at: string
  updated_at: string
}

// ─── Méthodes ────────────────────────────────────────────────────────────────

export const GES_METHODES: Record<GESMethode, { label: string; description: string; color: string }> = {
  ghg_protocol: {
    label: 'GHG Protocol',
    description: 'Standard international (WRI/WBCSD) — référence mondiale pour le reporting carbone',
    color: 'blue',
  },
  bilan_carbone: {
    label: 'Bilan Carbone®',
    description: 'Méthode ADEME/ABC — référence française, facteurs Base Carbone, scopes 1-2-3',
    color: 'emerald',
  },
  csrd_esrs: {
    label: 'CSRD / ESRS E1',
    description: 'Reporting obligatoire selon ESRS E1 — inclut objectifs E1-4, énergie E1-5, GES E1-6, absorptions E1-7',
    color: 'purple',
  },
}

// ─── Scope 3 — 15 catégories GHG Protocol ────────────────────────────────────

export const SCOPE3_CATEGORIES: Record<S3CatId, { label: string; direction: 'amont' | 'aval'; description: string }> = {
  cat1:  { label: 'Cat. 1 — Achats de biens et services',        direction: 'amont', description: 'Extraction, production et transport des biens/services achetés' },
  cat2:  { label: 'Cat. 2 — Biens d\'équipement',                direction: 'amont', description: 'Fabrication des immobilisations corporelles' },
  cat3:  { label: 'Cat. 3 — Combustibles & énergie (hors S1/S2)',direction: 'amont', description: 'Extraction, production et transport des combustibles consommés' },
  cat4:  { label: 'Cat. 4 — Transport & distribution (amont)',   direction: 'amont', description: 'Transport des produits achetés jusqu\'au site' },
  cat5:  { label: 'Cat. 5 — Déchets générés',                    direction: 'amont', description: 'Gestion des déchets produits par l\'activité' },
  cat6:  { label: 'Cat. 6 — Déplacements professionnels',        direction: 'amont', description: 'Transport des employés en mission' },
  cat7:  { label: 'Cat. 7 — Pendularité des collaborateurs',     direction: 'amont', description: 'Trajets domicile-travail' },
  cat8:  { label: 'Cat. 8 — Actifs en leasing (amont)',          direction: 'amont', description: 'Actifs loués exploités par l\'entreprise' },
  cat9:  { label: 'Cat. 9 — Transport & distribution (aval)',    direction: 'aval',  description: 'Transport des produits vendus vers clients' },
  cat10: { label: 'Cat. 10 — Transformation des produits vendus',direction: 'aval',  description: 'Transformation par des tiers des produits intermédiaires' },
  cat11: { label: 'Cat. 11 — Utilisation des produits vendus',   direction: 'aval',  description: 'Utilisation des produits par les clients finaux' },
  cat12: { label: 'Cat. 12 — Fin de vie des produits vendus',    direction: 'aval',  description: 'Traitement en fin de vie des produits' },
  cat13: { label: 'Cat. 13 — Actifs en leasing (aval)',          direction: 'aval',  description: 'Actifs loués par l\'entreprise à des tiers' },
  cat14: { label: 'Cat. 14 — Franchises',                        direction: 'aval',  description: 'Opérations des franchisés' },
  cat15: { label: 'Cat. 15 — Investissements',                   direction: 'aval',  description: 'Emissions liées aux investissements et participations' },
}

// ─── Sources d'émission avec facteurs ADEME Base Carbone ─────────────────────

export const EMISSION_SOURCES: EmissionSource[] = [

  // ═══ SCOPE 1 ══════════════════════════════════════════════════════════════

  // Combustion fixe
  { id: 's1_gaz_kwh',    label: 'Gaz naturel (réseau)', scope: 'scope1', subcategory: 'Combustion fixe', unit: 'kWh PCI', factor: 0.000227, factor_source: 'ADEME BC 2023' },
  { id: 's1_gaz_m3',     label: 'Gaz naturel (réseau)', scope: 'scope1', subcategory: 'Combustion fixe', unit: 'm³',      factor: 0.00205,  factor_source: 'ADEME BC 2023' },
  { id: 's1_fioul_kwh',  label: 'Fioul domestique',     scope: 'scope1', subcategory: 'Combustion fixe', unit: 'kWh PCI', factor: 0.000324, factor_source: 'ADEME BC 2023' },
  { id: 's1_fioul_l',    label: 'Fioul domestique',     scope: 'scope1', subcategory: 'Combustion fixe', unit: 'L',       factor: 0.00326,  factor_source: 'ADEME BC 2023' },
  { id: 's1_charbon',    label: 'Charbon (houille)',     scope: 'scope1', subcategory: 'Combustion fixe', unit: 'tonne',   factor: 2.34,     factor_source: 'ADEME BC 2023' },
  { id: 's1_gpl_kwh',    label: 'GPL / Propane',        scope: 'scope1', subcategory: 'Combustion fixe', unit: 'kWh PCI', factor: 0.000282, factor_source: 'ADEME BC 2023' },
  { id: 's1_gpl_l',      label: 'GPL / Propane',        scope: 'scope1', subcategory: 'Combustion fixe', unit: 'L',       factor: 0.00196,  factor_source: 'ADEME BC 2023' },
  { id: 's1_bois_kwh',   label: 'Bois / Biomasse',      scope: 'scope1', subcategory: 'Combustion fixe', unit: 'kWh PCI', factor: 0.000030, factor_source: 'ADEME BC 2023', description: 'Hors biogénique' },
  { id: 's1_bois_t',     label: 'Granulés bois (pellets)',scope: 'scope1',subcategory: 'Combustion fixe', unit: 'tonne',   factor: 0.045,    factor_source: 'ADEME BC 2023' },

  // Combustion mobile
  { id: 's1_essence_l',  label: 'Essence (SP95/SP98)',  scope: 'scope1', subcategory: 'Combustion mobile (flotte)', unit: 'L',  factor: 0.00228, factor_source: 'ADEME BC 2023' },
  { id: 's1_gazole_l',   label: 'Gazole (diesel)',      scope: 'scope1', subcategory: 'Combustion mobile (flotte)', unit: 'L',  factor: 0.00267, factor_source: 'ADEME BC 2023' },
  { id: 's1_gnv_kg',     label: 'GNV (gaz naturel véhicule)', scope: 'scope1', subcategory: 'Combustion mobile (flotte)', unit: 'kg', factor: 0.00222, factor_source: 'ADEME BC 2023' },
  { id: 's1_gpl_veh_l',  label: 'GPL véhicule',         scope: 'scope1', subcategory: 'Combustion mobile (flotte)', unit: 'L',  factor: 0.00179, factor_source: 'ADEME BC 2023' },
  { id: 's1_biocarb_l',  label: 'Biocarburant B100',    scope: 'scope1', subcategory: 'Combustion mobile (flotte)', unit: 'L',  factor: 0.00054, factor_source: 'ADEME BC 2023' },

  // Fluides frigorigènes
  { id: 's1_r410a',  label: 'R410A (PAC/clim)',     scope: 'scope1', subcategory: 'Fuites fluides frigorigènes', unit: 'kg', factor: 2.088, factor_source: 'ADEME BC 2023', description: 'PRG 2088' },
  { id: 's1_r32',    label: 'R32',                  scope: 'scope1', subcategory: 'Fuites fluides frigorigènes', unit: 'kg', factor: 0.675, factor_source: 'ADEME BC 2023', description: 'PRG 675' },
  { id: 's1_r134a',  label: 'R134a',                scope: 'scope1', subcategory: 'Fuites fluides frigorigènes', unit: 'kg', factor: 1.430, factor_source: 'ADEME BC 2023', description: 'PRG 1430' },
  { id: 's1_r407c',  label: 'R407C',                scope: 'scope1', subcategory: 'Fuites fluides frigorigènes', unit: 'kg', factor: 1.774, factor_source: 'ADEME BC 2023', description: 'PRG 1774' },
  { id: 's1_r22',    label: 'R22 (HCFC)',           scope: 'scope1', subcategory: 'Fuites fluides frigorigènes', unit: 'kg', factor: 1.810, factor_source: 'ADEME BC 2023', description: 'PRG 1810' },

  // ═══ SCOPE 2 ══════════════════════════════════════════════════════════════

  { id: 's2_elec_fr',    label: 'Électricité — France (réseau)',     scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0000520, factor_source: 'ADEME BC 2023' },
  { id: 's2_elec_vert',  label: 'Électricité verte certifiée (FR)',  scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0000240, factor_source: 'ADEME BC 2023' },
  { id: 's2_elec_eu',    label: 'Électricité — Moyenne UE-27',       scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0002760, factor_source: 'IEA 2022' },
  { id: 's2_elec_de',    label: 'Électricité — Allemagne',           scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0004340, factor_source: 'IEA 2022' },
  { id: 's2_elec_es',    label: 'Électricité — Espagne',             scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0001950, factor_source: 'IEA 2022' },
  { id: 's2_elec_it',    label: 'Électricité — Italie',              scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0002330, factor_source: 'IEA 2022' },
  { id: 's2_elec_world', label: 'Électricité — Monde (moyen)',       scope: 'scope2', subcategory: 'Électricité', unit: 'kWh', factor: 0.0004940, factor_source: 'IEA 2022' },
  { id: 's2_chaleur_fr', label: 'Réseau de chaleur (France moyen)',  scope: 'scope2', subcategory: 'Chaleur / Vapeur', unit: 'kWh', factor: 0.0001100, factor_source: 'ADEME BC 2023' },
  { id: 's2_chaleur_gaz',label: 'Réseau de chaleur (gaz)',           scope: 'scope2', subcategory: 'Chaleur / Vapeur', unit: 'kWh', factor: 0.0001800, factor_source: 'ADEME BC 2023' },
  { id: 's2_froid',      label: 'Réseau de froid',                   scope: 'scope2', subcategory: 'Froid', unit: 'kWh', factor: 0.0000250, factor_source: 'ADEME BC 2023' },

  // ═══ SCOPE 3 ══════════════════════════════════════════════════════════════

  // Cat 1 — Achats biens et services
  { id: 's3_achats_services',   label: 'Prestations de service (moyen)',   scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: '€ HT', factor: 0.0000860, factor_source: 'ADEME BC 2023' },
  { id: 's3_achats_num',        label: 'Services numériques',              scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: '€ HT', factor: 0.0000230, factor_source: 'ADEME BC 2023' },
  { id: 's3_achats_alim',       label: 'Alimentation (moyen)',             scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: '€ HT', factor: 0.0001400, factor_source: 'ADEME BC 2023' },
  { id: 's3_achats_papier',     label: 'Papier bureau',                    scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: 'kg',   factor: 0.00094,   factor_source: 'ADEME BC 2023' },
  { id: 's3_achats_pc',         label: 'Ordinateur portable',              scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: 'unité',factor: 0.156,     factor_source: 'ADEME BC 2023' },
  { id: 's3_achats_server',     label: 'Serveur informatique',             scope: 'scope3', subcategory: 'Achats', s3_cat: 'cat1', unit: 'unité',factor: 0.420,     factor_source: 'ADEME BC 2023' },

  // Cat 2 — Biens d'équipement
  { id: 's3_equip_bat',         label: 'Bâtiment (construction neuve)',    scope: 'scope3', subcategory: 'Équipements', s3_cat: 'cat2', unit: 'm²',  factor: 0.450,     factor_source: 'ADEME BC 2023' },
  { id: 's3_equip_voiture',     label: 'Voiture (achat)',                  scope: 'scope3', subcategory: 'Équipements', s3_cat: 'cat2', unit: 'unité',factor: 6.7,      factor_source: 'ADEME BC 2023' },
  { id: 's3_equip_camion',      label: 'Camion (achat)',                   scope: 'scope3', subcategory: 'Équipements', s3_cat: 'cat2', unit: 'unité',factor: 35.0,     factor_source: 'ADEME BC 2023' },

  // Cat 3 — Combustibles & énergie hors S1/S2
  { id: 's3_energie_gaz_up',    label: 'Amont gaz naturel (extraction/transport)', scope: 'scope3', subcategory: 'Énergie amont', s3_cat: 'cat3', unit: 'kWh', factor: 0.0000490, factor_source: 'ADEME BC 2023' },
  { id: 's3_energie_elec_up',   label: 'Amont électricité France',                scope: 'scope3', subcategory: 'Énergie amont', s3_cat: 'cat3', unit: 'kWh', factor: 0.0000130, factor_source: 'ADEME BC 2023' },

  // Cat 4 — Transport amont
  { id: 's3_trans_route',       label: 'Transport routier (poids lourd)',   scope: 'scope3', subcategory: 'Transport amont', s3_cat: 'cat4', unit: 't.km', factor: 0.000196,  factor_source: 'ADEME BC 2023' },
  { id: 's3_trans_maritime',    label: 'Transport maritime',                scope: 'scope3', subcategory: 'Transport amont', s3_cat: 'cat4', unit: 't.km', factor: 0.0000116, factor_source: 'ADEME BC 2023' },
  { id: 's3_trans_aerien_fret', label: 'Fret aérien',                       scope: 'scope3', subcategory: 'Transport amont', s3_cat: 'cat4', unit: 't.km', factor: 0.001220,  factor_source: 'ADEME BC 2023' },
  { id: 's3_trans_ferroviaire', label: 'Transport ferroviaire (fret)',       scope: 'scope3', subcategory: 'Transport amont', s3_cat: 'cat4', unit: 't.km', factor: 0.0000280, factor_source: 'ADEME BC 2023' },

  // Cat 5 — Déchets
  { id: 's3_dechet_decharge',   label: 'Déchets ménagers en décharge',     scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.587,     factor_source: 'ADEME BC 2023' },
  { id: 's3_dechet_incin',      label: 'Déchets incinérés',                scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.283,     factor_source: 'ADEME BC 2023' },
  { id: 's3_dechet_carton',     label: 'Cartons recyclés',                 scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.021,     factor_source: 'ADEME BC 2023' },
  { id: 's3_dechet_plastique',  label: 'Plastiques recyclés',              scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.040,     factor_source: 'ADEME BC 2023' },
  { id: 's3_dechet_metal',      label: 'Métaux recyclés',                  scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.012,     factor_source: 'ADEME BC 2023' },
  { id: 's3_dechet_organique',  label: 'Déchets organiques (compost)',     scope: 'scope3', subcategory: 'Déchets', s3_cat: 'cat5', unit: 'tonne', factor: 0.085,     factor_source: 'ADEME BC 2023' },

  // Cat 6 — Déplacements professionnels
  { id: 's3_avion_court',       label: 'Avion court-courrier (<1000km)',   scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km.passager', factor: 0.000259, factor_source: 'ADEME BC 2023' },
  { id: 's3_avion_moyen',       label: 'Avion moyen-courrier (1000-3500)', scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km.passager', factor: 0.000187, factor_source: 'ADEME BC 2023' },
  { id: 's3_avion_long',        label: 'Avion long-courrier (>3500km)',    scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km.passager', factor: 0.000152, factor_source: 'ADEME BC 2023' },
  { id: 's3_tgv',               label: 'TGV / Train grande vitesse',       scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km.passager', factor: 0.0000050,factor_source: 'ADEME BC 2023' },
  { id: 's3_train_interc',      label: 'Train intercités / RER',           scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km.passager', factor: 0.0000167,factor_source: 'ADEME BC 2023' },
  { id: 's3_voiture_pro',       label: 'Voiture (essence/diesel moyen)',   scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km',          factor: 0.000218, factor_source: 'ADEME BC 2023' },
  { id: 's3_taxi_vtc',          label: 'Taxi / VTC',                       scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'km',          factor: 0.000184, factor_source: 'ADEME BC 2023' },
  { id: 's3_hotel_fr',          label: 'Nuitée hôtel France',              scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'nuitée',       factor: 0.00648,  factor_source: 'ADEME BC 2023' },
  { id: 's3_hotel_int',         label: 'Nuitée hôtel international',       scope: 'scope3', subcategory: 'Déplacements pro', s3_cat: 'cat6', unit: 'nuitée',       factor: 0.0120,   factor_source: 'ADEME BC 2023' },

  // Cat 7 — Pendularité
  { id: 's3_pend_voiture',      label: 'Voiture (essence/diesel moyen)',   scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km',          factor: 0.000218, factor_source: 'ADEME BC 2023' },
  { id: 's3_pend_velo_elec',    label: 'Vélo à assistance électrique',     scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km',          factor: 0.0000110,factor_source: 'ADEME BC 2023' },
  { id: 's3_pend_metro',        label: 'Métro / RER',                      scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km.passager', factor: 0.0000037,factor_source: 'ADEME BC 2023' },
  { id: 's3_pend_bus',          label: 'Bus urbain',                       scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km.passager', factor: 0.0000103,factor_source: 'ADEME BC 2023' },
  { id: 's3_pend_tram',         label: 'Tramway',                          scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km.passager', factor: 0.0000029,factor_source: 'ADEME BC 2023' },
  { id: 's3_pend_teletravail',  label: 'Télétravail (économie)',           scope: 'scope3', subcategory: 'Pendularité', s3_cat: 'cat7', unit: 'km',          factor: -0.000218,factor_source: 'Calcul', description: 'Valeur négative = réduction' },

  // Cat 9 — Transport aval
  { id: 's3_transaval_route',   label: 'Transport routier aval (PL)',      scope: 'scope3', subcategory: 'Transport aval', s3_cat: 'cat9', unit: 't.km', factor: 0.000196, factor_source: 'ADEME BC 2023' },
  { id: 's3_transaval_maritime',label: 'Transport maritime aval',          scope: 'scope3', subcategory: 'Transport aval', s3_cat: 'cat9', unit: 't.km', factor: 0.0000116,factor_source: 'ADEME BC 2023' },

  // Cat 11 — Utilisation produits
  { id: 's3_use_elec',          label: 'Consommation électrique produits', scope: 'scope3', subcategory: 'Utilisation produits', s3_cat: 'cat11', unit: 'kWh/an', factor: 0.0000520, factor_source: 'ADEME BC 2023' },

  // Cat 12 — Fin de vie
  { id: 's3_fdv_deee',          label: 'Déchets DEEE (électronique)',      scope: 'scope3', subcategory: 'Fin de vie produits', s3_cat: 'cat12', unit: 'tonne', factor: 0.0350, factor_source: 'ADEME BC 2023' },
  { id: 's3_fdv_emballage',     label: 'Emballages (fin de vie)',          scope: 'scope3', subcategory: 'Fin de vie produits', s3_cat: 'cat12', unit: 'tonne', factor: 0.0210, factor_source: 'ADEME BC 2023' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSourceById(id: string): EmissionSource | undefined {
  return EMISSION_SOURCES.find(s => s.id === id)
}

export function getSourcesByScope(scope: ScopeId): EmissionSource[] {
  return EMISSION_SOURCES.filter(s => s.scope === scope)
}

export function getSourcesByS3Cat(cat: S3CatId): EmissionSource[] {
  return EMISSION_SOURCES.filter(s => s.s3_cat === cat)
}

export function groupBySubcategory(sources: EmissionSource[]): Record<string, EmissionSource[]> {
  return sources.reduce((acc, s) => {
    if (!acc[s.subcategory]) acc[s.subcategory] = []
    acc[s.subcategory].push(s)
    return acc
  }, {} as Record<string, EmissionSource[]>)
}

export function computeEntryTotal(entry: GESEntry): number {
  return entry.quantity * entry.factor
}

export function computeScopeTotal(entries: GESEntry[]): number {
  return entries.reduce((sum, e) => sum + e.total_tco2e, 0)
}

export function formatTCO2e(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(2)} ktCO₂e`
  if (val >= 1)    return `${val.toFixed(2)} tCO₂e`
  return `${(val * 1000).toFixed(1)} kgCO₂e`
}

export function makeid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultGESScope3(): GESScope3Config {
  return { entries: [], categories_pertinentes: {} }
}

export function defaultGESScope2(): GESScope2Config {
  return { entries: [], methode_s2: 'location' }
}

export function defaultESRSE1(): ESRSE1Data {
  return {
    objectifs: [],
    energie_renouvelable_mwh: null,
    energie_non_renouvelable_mwh: null,
    absorptions: [],
    notes_objectifs: '',
    notes_energie: '',
    notes_absorptions: '',
  }
}
