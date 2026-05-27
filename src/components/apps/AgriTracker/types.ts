export interface Plantation {
  id: string
  user_id: string
  nom: string
  pays_code: string
  pays_nom: string
  region: string | null
  ville: string | null
  adresse: string | null
  forme_juridique: string | null
  numero_registre: string | null
  superficie_totale_ha: number | null
  created_at: string
  updated_at: string
}

export interface Champ {
  id: string
  plantation_id: string
  nom: string
  produit_faostat: string
  produit_code: string | null
  variete: string | null
  superficie_ha: number | null
  coordonnees: { lat: number; lon: number } | null
  created_at: string
}

export type Periode = 'nuit' | 'matin' | 'apres-midi'
export type CouvertureNuageuse =
  | 'ciel_clair'
  | 'peu_nuageux'
  | 'partiellement_nuageux'
  | 'nuageux'
  | 'tres_nuageux'
  | 'brouillard'
export type TypeSujet = 'fruit' | 'plante' | 'arbre' | 'sol' | 'maladie' | 'autre'

export interface ObservationMeteo {
  id: string
  plantation_id: string
  champ_id: string | null
  date: string
  periode: Periode
  temperature_c: number | null
  humidite_pct: number | null
  precipitation_mm: number | null
  vent_kmh: number | null
  vent_direction: string | null
  couverture_nuageuse: CouvertureNuageuse | null
  commentaire: string | null
  created_at: string
}

export interface PhotoTerrain {
  id: string
  plantation_id: string
  champ_id: string | null
  date_prise: string
  heure_prise: string | null
  url_sharepoint: string
  filename: string | null
  latitude: number | null
  longitude: number | null
  type_sujet: TypeSujet | null
  produit: string | null
  commentaire: string | null
  created_at: string
}

export interface FaostatCrop {
  code: string
  name: string
}

export interface WeatherDay {
  dt: number
  temp: { min: number; max: number; day: number }
  humidity: number
  rain?: number
  weather: { icon: string; description: string }[]
}

export interface WeatherData {
  current: {
    temp: number
    humidity: number
    weather: { description: string; icon: string }[]
    wind_speed: number
  }
  daily: WeatherDay[]
  mock: boolean
}

export type AgriTab = 'plantation' | 'champs' | 'meteo' | 'photos' | 'crm'
export type AcheteurTab = 'cafe' | 'cacao' | 'apercu' | 'meteo' | 'photos' | 'cours' | 'analyse' | 'crm'

// ─── CRM ──────────────────────────────────────────────────────────────────────

export interface CRMMessage {
  id: string
  plantation_id: string
  sender_user_id: string
  sender_nom: string | null
  content: string
  lu_par: string[]
  created_at: string
}

export type CRMRdvType = 'sur_place' | 'en_ligne' | 'autre'
export type CRMRdvStatut = 'planifie' | 'confirme' | 'annule' | 'termine'

export interface CRMRdv {
  id: string
  plantation_id: string
  titre: string
  date_rdv: string
  heure: string | null
  duree_min: number | null
  type: CRMRdvType
  lieu: string | null
  lien: string | null
  statut: CRMRdvStatut
  compte_rendu: string | null
  compte_rendu_updated_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CRMNote {
  id: string
  plantation_id: string
  titre: string
  contenu: string
  fichiers: Array<{ name: string; item_id: string; mime: string; size: number }> | null
  created_by: string
  created_by_nom: string | null
  created_at: string
  updated_at: string
}

export interface CRMConfianceEntry {
  id: string
  plantation_id: string
  acheteur_user_id: string
  score: number
  note: string | null
  interaction_ref: string | null
  created_at: string
  updated_at: string
}
