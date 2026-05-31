'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import ActionNotePanel from '@/components/apps/ActionNotePanel'
const AgriCRM = dynamic(() => import('./CRM'), { ssr: false, loading: () => <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Chargement CRM…</div> })

// Carte Leaflet — import dynamique (SSR impossible : Leaflet nécessite window)
const ChampsMap = dynamic(
  () => import('./ChampsMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm">
        Chargement de la carte…
      </div>
    ),
  }
)
import type {
  Plantation,
  Champ,
  ObservationMeteo,
  PhotoTerrain,
  WeatherData,
  FaostatCrop,
  AgriTab,
  AcheteurTab,
  Periode,
  CouvertureNuageuse,
  TypeSujet,
} from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMES_JURIDIQUES = ['SARL', 'SA', 'SAS', 'SASU', 'EI', 'Coopérative', 'Autre']

const PERIODES: { key: Periode; label: string; icon: string }[] = [
  { key: 'nuit', label: 'Nuit', icon: '🌙' },
  { key: 'matin', label: 'Matin', icon: '☀️' },
  { key: 'apres-midi', label: 'Après-midi', icon: '🌆' },
]

const COUVERTURES: { key: CouvertureNuageuse; label: string; icon: string }[] = [
  { key: 'ciel_clair', label: 'Ciel clair', icon: '☀️' },
  { key: 'peu_nuageux', label: 'Peu nuageux', icon: '🌤️' },
  { key: 'partiellement_nuageux', label: 'Partiellement nuageux', icon: '⛅' },
  { key: 'nuageux', label: 'Nuageux', icon: '☁️' },
  { key: 'tres_nuageux', label: 'Très nuageux', icon: '🌧️' },
  { key: 'brouillard', label: 'Brouillard', icon: '🌫️' },
]

const VENT_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

const TYPE_SUJETS: { key: TypeSujet; label: string; icon: string }[] = [
  { key: 'fruit', label: 'Fruit', icon: '🍎' },
  { key: 'plante', label: 'Plante', icon: '🌱' },
  { key: 'arbre', label: 'Arbre', icon: '🌳' },
  { key: 'sol', label: 'Sol', icon: '🪨' },
  { key: 'maladie', label: 'Maladie', icon: '🦠' },
  { key: 'autre', label: 'Autre', icon: '📷' },
]

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ─── Shared helpers ────────────────────────────────────────────────────────────

function inputClass(extra = '') {
  return `w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 text-sm ${extra}`
}

function labelClass() {
  return 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
}

function cardClass(extra = '') {
  return `bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${extra}`
}

function btnPrimary(extra = '') {
  return `px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${extra}`
}

function btnSecondary(extra = '') {
  return `px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors ${extra}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'
  return (
    <div className={`${sz} animate-spin rounded-full border-2 border-emerald-600 border-t-transparent`} />
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; icon?: string }[]
  active: T
  onChange: (t: T) => void
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === t.key
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── PlantationForm ───────────────────────────────────────────────────────────

function PlantationForm({
  initial,
  onSave,
  saving,
}: {
  initial: Partial<Plantation>
  onSave: (data: Partial<Plantation>) => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<Plantation>>({
    nom: '',
    pays_nom: "Côte d'Ivoire",
    pays_code: 'CI',
    region: '',
    ville: '',
    adresse: '',
    forme_juridique: '',
    numero_registre: '',
    superficie_totale_ha: undefined,
    ...initial,
  })

  function set(k: keyof Plantation, v: string | number | null) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass()}>Nom de la plantation *</label>
          <input
            className={inputClass()}
            value={form.nom ?? ''}
            onChange={(e) => set('nom', e.target.value)}
            placeholder="Ex : Plantation Kouamé"
          />
        </div>
        <div>
          <label className={labelClass()}>Pays</label>
          <input
            className={inputClass()}
            value={form.pays_nom ?? ''}
            onChange={(e) => set('pays_nom', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass()}>Code pays</label>
          <input
            className={inputClass()}
            value={form.pays_code ?? ''}
            onChange={(e) => set('pays_code', e.target.value.toUpperCase())}
            placeholder="CI"
            maxLength={3}
          />
        </div>
        <div>
          <label className={labelClass()}>Région</label>
          <input
            className={inputClass()}
            value={form.region ?? ''}
            onChange={(e) => set('region', e.target.value)}
            placeholder="Ex : Yamoussoukro"
          />
        </div>
        <div>
          <label className={labelClass()}>Ville</label>
          <input
            className={inputClass()}
            value={form.ville ?? ''}
            onChange={(e) => set('ville', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass()}>Adresse</label>
          <input
            className={inputClass()}
            value={form.adresse ?? ''}
            onChange={(e) => set('adresse', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass()}>Forme juridique</label>
          <select
            className={inputClass()}
            value={form.forme_juridique ?? ''}
            onChange={(e) => set('forme_juridique', e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {FORMES_JURIDIQUES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass()}>N° registre de commerce</label>
          <input
            className={inputClass()}
            value={form.numero_registre ?? ''}
            onChange={(e) => set('numero_registre', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass()}>Superficie totale (ha)</label>
          <input
            type="number"
            className={inputClass()}
            value={form.superficie_totale_ha ?? ''}
            onChange={(e) =>
              set('superficie_totale_ha', e.target.value ? parseFloat(e.target.value) : null)
            }
            min={0}
            step={0.1}
          />
        </div>
      </div>
      <button
        className={btnPrimary('mt-2')}
        onClick={() => onSave(form)}
        disabled={saving || !form.nom}
      >
        {saving ? 'Enregistrement…' : initial.id ? 'Enregistrer les modifications' : 'Créer la plantation'}
      </button>
    </div>
  )
}

// ─── ChampModal ───────────────────────────────────────────────────────────────

function ChampModal({
  plantationId,
  onSaved,
  onClose,
}: {
  plantationId: string
  onSaved: (c: Champ) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nom: '',
    produit_faostat: '',
    produit_code: '',
    variete: '',
    superficie_ha: '',
    lat: '',
    lon: '',
  })
  const [crops, setCrops] = useState<FaostatCrop[]>([])
  const [cropSearch, setCropSearch] = useState('')
  const [loadingCrops, setLoadingCrops] = useState(false)
  const [saving, setSaving] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoadingCrops(true)
    fetch('/api/agri/faostat?type=crops')
      .then((r) => r.json())
      .then((d) => setCrops(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => setCrops([]))
      .finally(() => setLoadingCrops(false))
  }, [])

  const filteredCrops = useMemo(() => {
    if (!cropSearch) return crops.slice(0, 50)
    const q = cropSearch.toLowerCase()
    return crops.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50)
  }, [crops, cropSearch])

  function getLocation() {
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non disponible')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lon: pos.coords.longitude.toFixed(6),
        }))
      },
      () => setGeoError('Impossible d\'obtenir la position')
    )
  }

  async function handleSave() {
    if (!form.nom || !form.produit_faostat) {
      setError('Nom et produit requis')
      return
    }
    setSaving(true)
    setError('')
    try {
      const coordonnees =
        form.lat && form.lon
          ? { lat: parseFloat(form.lat), lon: parseFloat(form.lon) }
          : null
      // Utilise l'API route (auth serveur) pour garantir l'accès en écriture
      const res = await fetch('/api/agri/champs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantation_id: plantationId,
          nom: form.nom,
          produit_faostat: form.produit_faostat,
          produit_code: form.produit_code || null,
          variete: form.variete || null,
          superficie_ha: form.superficie_ha ? parseFloat(form.superficie_ha) : null,
          coordonnees,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      onSaved(json.champ as Champ)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const mapsUrl =
    form.lat && form.lon
      ? `https://maps.google.com/?q=${form.lat},${form.lon}`
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`${cardClass('p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl')}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau champ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass()}>Nom du champ *</label>
            <input
              className={inputClass()}
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              placeholder="Ex : Parcelle Nord"
            />
          </div>
          <div>
            <label className={labelClass()}>Produit (FAOSTAT) *</label>
            <input
              className={inputClass('mb-1')}
              placeholder={loadingCrops ? 'Chargement…' : 'Rechercher un produit…'}
              value={cropSearch || form.produit_faostat}
              onChange={(e) => {
                setCropSearch(e.target.value)
                setForm((f) => ({ ...f, produit_faostat: e.target.value, produit_code: '' }))
              }}
            />
            {cropSearch && filteredCrops.length > 0 && (
              <ul className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-auto max-h-40 bg-white dark:bg-gray-700 text-sm">
                {filteredCrops.map((c) => (
                  <li
                    key={c.code}
                    className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer text-gray-800 dark:text-gray-200"
                    onClick={() => {
                      setForm((f) => ({ ...f, produit_faostat: c.name, produit_code: c.code }))
                      setCropSearch('')
                    }}
                  >
                    {c.name} <span className="text-gray-400 text-xs">({c.code})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass()}>Variété</label>
              <input
                className={inputClass()}
                value={form.variete}
                onChange={(e) => setForm((f) => ({ ...f, variete: e.target.value }))}
                placeholder="Optionnel"
              />
            </div>
            <div>
              <label className={labelClass()}>Superficie (ha)</label>
              <input
                type="number"
                className={inputClass()}
                value={form.superficie_ha}
                onChange={(e) => setForm((f) => ({ ...f, superficie_ha: e.target.value }))}
                min={0}
                step={0.1}
              />
            </div>
          </div>
          <div>
            <label className={labelClass()}>Coordonnées GPS</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                className={inputClass()}
                placeholder="Latitude"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                step="any"
              />
              <input
                type="number"
                className={inputClass()}
                placeholder="Longitude"
                value={form.lon}
                onChange={(e) => setForm((f) => ({ ...f, lon: e.target.value }))}
                step="any"
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={getLocation}
                className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                📍 Ma position
              </button>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Vérifier sur Google Maps →
                </a>
              )}
            </div>
            {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button className={btnPrimary('flex-1')} onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button className={btnSecondary()} onClick={onClose}>Annuler</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Weather widget ────────────────────────────────────────────────────────────

function WeatherWidget({ lat, lon }: { lat: number; lon: number }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agri/weather?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError('Météo indisponible'))
      .finally(() => setLoading(false))
  }, [lat, lon])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!data) return null

  const { current, daily } = data

  return (
    <div className="space-y-3">
      {data.mock && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs">
          Données simulées — configurez OPENWEATHER_API_KEY pour les données réelles
        </div>
      )}
      <div className={`${cardClass('p-4')} flex items-center gap-4`}>
        {current.weather[0] && (
          <img
            src={`https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`}
            alt={current.weather[0].description}
            className="w-12 h-12"
          />
        )}
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(current.temp)}°C</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {current.weather[0]?.description}
          </div>
        </div>
        <div className="ml-auto text-right text-sm text-gray-600 dark:text-gray-400">
          <div>💧 {current.humidity}%</div>
          <div>💨 {Math.round(current.wind_speed)} km/h</div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {daily.slice(0, 5).map((d) => {
          const date = new Date(d.dt * 1000)
          return (
            <div key={d.dt} className={`${cardClass('p-2 text-center text-xs')} space-y-1`}>
              <div className="font-medium text-gray-700 dark:text-gray-300">
                {DAYS_FR[(date.getDay() + 6) % 7]}
              </div>
              {d.weather[0] && (
                <img
                  src={`https://openweathermap.org/img/wn/${d.weather[0].icon}.png`}
                  alt=""
                  className="w-8 h-8 mx-auto"
                />
              )}
              <div className="text-gray-900 dark:text-white">{Math.round(d.temp.max)}°</div>
              <div className="text-gray-400">{Math.round(d.temp.min)}°</div>
              {d.rain != null && <div className="text-blue-500">{d.rain.toFixed(1)}mm</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MeteoCalendar ─────────────────────────────────────────────────────────────

function MeteoCalendar({
  plantationId,
  observations,
  onObsChange,
  readOnly,
}: {
  plantationId: string
  champs: Champ[]
  observations: ObservationMeteo[]
  onObsChange: () => void
  readOnly?: boolean
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedPeriode, setSelectedPeriode] = useState<Periode>('matin')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    temperature_c: '',
    humidite_pct: '',
    precipitation_mm: '',
    vent_kmh: '',
    vent_direction: '',
    couverture_nuageuse: '' as CouvertureNuageuse | '',
    commentaire: '',
  })

  // Build day grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0
  const totalDays = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const obsByDate = useMemo(() => {
    const map: Record<string, Periode[]> = {}
    for (const o of observations) {
      if (!map[o.date]) map[o.date] = []
      map[o.date].push(o.periode)
    }
    return map
  }, [observations])

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function openDay(day: number) {
    const ds = dateStr(day)
    setSelectedDate(ds)
    // Pre-fill if observation exists
    const existing = observations.find((o) => o.date === ds && o.periode === selectedPeriode)
    setFormData({
      temperature_c: existing?.temperature_c?.toString() ?? '',
      humidite_pct: existing?.humidite_pct?.toString() ?? '',
      precipitation_mm: existing?.precipitation_mm?.toString() ?? '',
      vent_kmh: existing?.vent_kmh?.toString() ?? '',
      vent_direction: existing?.vent_direction ?? '',
      couverture_nuageuse: (existing?.couverture_nuageuse as CouvertureNuageuse | '') ?? '',
      commentaire: existing?.commentaire ?? '',
    })
  }

  useEffect(() => {
    if (!selectedDate) return
    const existing = observations.find((o) => o.date === selectedDate && o.periode === selectedPeriode)
    setFormData({
      temperature_c: existing?.temperature_c?.toString() ?? '',
      humidite_pct: existing?.humidite_pct?.toString() ?? '',
      precipitation_mm: existing?.precipitation_mm?.toString() ?? '',
      vent_kmh: existing?.vent_kmh?.toString() ?? '',
      vent_direction: existing?.vent_direction ?? '',
      couverture_nuageuse: (existing?.couverture_nuageuse as CouvertureNuageuse | '') ?? '',
      commentaire: existing?.commentaire ?? '',
    })
  }, [selectedDate, selectedPeriode, observations])

  const [saveError, setSaveError] = useState('')

  async function saveObservation() {
    if (!selectedDate) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        plantation_id: plantationId,
        date: selectedDate,
        periode: selectedPeriode,
        temperature_c: formData.temperature_c ? parseFloat(formData.temperature_c) : null,
        humidite_pct: formData.humidite_pct ? parseFloat(formData.humidite_pct) : null,
        precipitation_mm: formData.precipitation_mm ? parseFloat(formData.precipitation_mm) : null,
        vent_kmh: formData.vent_kmh ? parseFloat(formData.vent_kmh) : null,
        vent_direction: formData.vent_direction || null,
        couverture_nuageuse: (formData.couverture_nuageuse as CouvertureNuageuse) || null,
        commentaire: formData.commentaire || null,
      }
      // Utilise l'API route (auth serveur) au lieu du browser client
      const res = await fetch('/api/agri/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      onObsChange()
      setSelectedDate(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className={btnSecondary('px-3 py-1.5')}>‹</button>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {MONTHS_FR[month]} {year}
          </h3>
          <button onClick={nextMonth} className={btnSecondary('px-3 py-1.5')}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const ds = dateStr(day)
            const periodes = obsByDate[ds] ?? []
            const isSelected = selectedDate === ds
            const isToday = ds === todayStr()
            const hasObs = periodes.length > 0
            return (
              <button
                key={ds}
                onClick={() => openDay(day)}
                className={`relative p-1 rounded-lg text-sm transition-colors min-h-[48px] flex flex-col items-center ${
                  isSelected
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500'
                    : isToday
                    ? 'bg-blue-50 dark:bg-blue-900/20 font-bold'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${readOnly && !hasObs ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className={`text-xs ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                  {day}
                </span>
                <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                  {periodes.map((p) => {
                    const icon = PERIODES.find((x) => x.key === p)?.icon ?? '•'
                    return <span key={p} className="text-[10px]">{icon}</span>
                  })}
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
          {PERIODES.map((p) => (
            <span key={p.key}>{p.icon} {p.label}</span>
          ))}
        </div>
      </div>

      {/* Side panel */}
      {selectedDate && !readOnly && (
        <div className={`${cardClass('p-4 w-full lg:w-80 flex-shrink-0')} space-y-4`}>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h4>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">×</button>
          </div>

          {/* Periode selector */}
          <div className="flex gap-1">
            {PERIODES.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPeriode(p.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriode === p.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass()}>Temp (°C)</label>
              <input
                type="number"
                className={inputClass()}
                value={formData.temperature_c}
                onChange={(e) => setFormData((f) => ({ ...f, temperature_c: e.target.value }))}
                step={0.1}
              />
            </div>
            <div>
              <label className={labelClass()}>Humidité (%)</label>
              <input
                type="number"
                className={inputClass()}
                value={formData.humidite_pct}
                onChange={(e) => setFormData((f) => ({ ...f, humidite_pct: e.target.value }))}
                min={0}
                max={100}
              />
            </div>
            <div>
              <label className={labelClass()}>Précipitations (mm)</label>
              <input
                type="number"
                className={inputClass()}
                value={formData.precipitation_mm}
                onChange={(e) => setFormData((f) => ({ ...f, precipitation_mm: e.target.value }))}
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <label className={labelClass()}>Vent (km/h)</label>
              <input
                type="number"
                className={inputClass()}
                value={formData.vent_kmh}
                onChange={(e) => setFormData((f) => ({ ...f, vent_kmh: e.target.value }))}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className={labelClass()}>Direction du vent</label>
            <select
              className={inputClass()}
              value={formData.vent_direction}
              onChange={(e) => setFormData((f) => ({ ...f, vent_direction: e.target.value }))}
            >
              <option value="">—</option>
              {VENT_DIRECTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()}>Couverture nuageuse</label>
            <select
              className={inputClass()}
              value={formData.couverture_nuageuse}
              onChange={(e) => setFormData((f) => ({ ...f, couverture_nuageuse: e.target.value as CouvertureNuageuse | '' }))}
            >
              <option value="">—</option>
              {COUVERTURES.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()}>Commentaire</label>
            <textarea
              className={inputClass('resize-none')}
              rows={3}
              value={formData.commentaire}
              onChange={(e) => setFormData((f) => ({ ...f, commentaire: e.target.value }))}
            />
          </div>

          {saveError && (
            <p className="text-xs text-red-500">{saveError}</p>
          )}
          <button
            className={btnPrimary('w-full')}
            onClick={saveObservation}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer l\'observation'}
          </button>
        </div>
      )}

      {selectedDate && readOnly && (
        <div className={`${cardClass('w-full lg:w-80 flex-shrink-0')} overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white capitalize text-sm">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </h4>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
          </div>

          {/* Observations par période */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {PERIODES.map((p) => {
              const obs = observations.find((o) => o.date === selectedDate && o.periode === p.key)
              if (!obs) return null
              const couv = COUVERTURES.find(c => c.key === obs.couverture_nuageuse)
              return (
                <div key={p.key} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-800 dark:text-gray-200">
                    <span>{p.icon}</span><span>{p.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {obs.temperature_c != null && (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span className="text-base">🌡️</span>
                        <span><span className="font-medium">{obs.temperature_c}</span> °C</span>
                      </div>
                    )}
                    {obs.humidite_pct != null && (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span className="text-base">💧</span>
                        <span><span className="font-medium">{obs.humidite_pct}</span> %</span>
                      </div>
                    )}
                    {obs.precipitation_mm != null && (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span className="text-base">🌧️</span>
                        <span><span className="font-medium">{obs.precipitation_mm}</span> mm</span>
                      </div>
                    )}
                    {obs.vent_kmh != null && (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span className="text-base">💨</span>
                        <span>
                          <span className="font-medium">{obs.vent_kmh}</span> km/h
                          {obs.vent_direction && <span className="text-gray-500 ml-1">({obs.vent_direction})</span>}
                        </span>
                      </div>
                    )}
                    {couv && (
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 col-span-2">
                        <span className="text-base">{couv.icon}</span>
                        <span>{couv.label}</span>
                      </div>
                    )}
                  </div>
                  {obs.commentaire && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1.5">
                      &ldquo;{obs.commentaire}&rdquo;
                    </p>
                  )}
                </div>
              )
            })}
            {!observations.some((o) => o.date === selectedDate) && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Aucune observation enregistrée ce jour
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Constantes Photos ─────────────────────────────────────────────────────────

const PHOTO_TYPE_ICONS: Record<TypeSujet, string> = {
  fruit: '🍎', plante: '🌱', arbre: '🌳', sol: '🪨', maladie: '🦠', autre: '📷',
}

// ─── Video helpers ──────────────────────────────────────────────────────────

function isVideoFile(filename: string | null | undefined): boolean {
  if (!filename) return false
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ['mp4', 'mov', 'avi', 'webm', 'mkv', '3gp', 'wmv', 'flv', 'm4v'].includes(ext)
}

function parseFilename(fn: string | null | undefined): { annexeRef: string; body: string; ext: string } {
  if (!fn) return { annexeRef: '', body: '', ext: '' }
  const lastDot = fn.lastIndexOf('.')
  const full = lastDot > 0 ? fn.slice(0, lastDot) : fn
  const ext  = lastDot > 0 ? fn.slice(lastDot) : ''
  const match = full.match(/^(A\d+)_(.*)$/)
  return { annexeRef: match?.[1] ?? '', body: match?.[2] ?? full, ext }
}

// ─── ObservationCard ────────────────────────────────────────────────────────────
// Une observation = groupe de photos avec carrousel glissant auto-avançant.

function ObservationCard({
  photos,
  signedUrls,
  thumbnailUrls,
  champs,
  onLightbox,
  onEdit,
  onHoverPhoto,
  readOnly = false,
}: {
  photos: PhotoTerrain[]
  signedUrls: Record<string, string>
  thumbnailUrls: Record<string, string>
  champs: Champ[]
  onLightbox: (p: PhotoTerrain) => void
  onEdit: (p: PhotoTerrain, group: PhotoTerrain[]) => void
  onHoverPhoto?: (coords: { lat: number; lon: number } | null) => void
  readOnly?: boolean
}) {
  const meta = photos[0]
  const champ = champs.find(c => c.id === meta.champ_id)
  const { annexeRef: firstAnnexeRef } = parseFilename(photos[0]?.filename)
  const n = photos.length

  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-avance toutes les 3s — suspendu au hover
  useEffect(() => {
    if (n <= 1 || paused) return
    const t = setInterval(() => setIdx(i => (i + 1) % n), 3000)
    return () => clearInterval(t)
  }, [n, paused])

  function renderSlide(photo: PhotoTerrain) {
    const url = photo.url_sharepoint ? signedUrls[photo.url_sharepoint] : undefined
    const isVid = isVideoFile(photo.filename)
    const thumbUrl = isVid && photo.url_sharepoint ? thumbnailUrls[photo.url_sharepoint] : undefined
    return (
      <div
        key={photo.id}
        className="relative flex-shrink-0 w-full h-44 bg-gray-100 dark:bg-gray-800 cursor-pointer"
        style={{ minWidth: '100%' }}
        onClick={() => onLightbox(photo)}
      >
        {isVid ? (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            {thumbUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={thumbUrl} className="w-full h-full object-cover opacity-70" alt="" />
              : <span className="text-3xl">🎬</span>}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-black/60 border-2 border-white/70 flex items-center justify-center">
                <span className="text-white text-xs ml-0.5">▶</span>
              </div>
            </div>
          </div>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} className="w-full h-full object-cover" alt="" />
        ) : photo.url_sharepoint ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px] animate-pulse">…</div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">📷</div>
        )}
      </div>
    )
  }

  const hasGps = !!(meta.latitude && meta.longitude)
  const gpsCoords = hasGps ? { lat: Number(meta.latitude), lon: Number(meta.longitude) } : null

  return (
    <div
      className={`${cardClass()} overflow-hidden flex flex-col`}
      onMouseEnter={() => { setPaused(true); if (gpsCoords) onHoverPhoto?.(gpsCoords) }}
      onMouseLeave={() => { setPaused(false); onHoverPhoto?.(null) }}
    >
      {/* Carrousel glissant */}
      <div className="relative overflow-hidden h-44">
        {/* Piste glissante */}
        <div
          className="flex h-full"
          style={{ transform: `translateX(-${idx * 100}%)`, transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)' }}
        >
          {photos.map(p => renderSlide(p))}
        </div>

        {/* Flèches nav — visibles uniquement si plusieurs photos */}
        {n > 1 && (
          <>
            <button
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white text-xs flex items-center justify-center transition z-10"
              onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + n) % n) }}
            >‹</button>
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white text-xs flex items-center justify-center transition z-10"
              onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % n) }}
            >›</button>
          </>
        )}

        {/* Dots */}
        {n > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
            {photos.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`} />
            ))}
          </div>
        )}

        {/* Badge compteur */}
        {n > 1 && (
          <div className="absolute top-1.5 left-1.5 text-xs bg-black/60 text-white rounded px-1.5 py-0.5 leading-none tabular-nums pointer-events-none">
            {idx + 1}/{n} 📷
          </div>
        )}

        {/* Badge SharePoint */}
        {meta.url_sharepoint && (
          <div className="absolute top-1.5 right-1.5 text-xs bg-blue-500/80 text-white rounded px-1.5 py-0.5 leading-none pointer-events-none">☁️</div>
        )}
      </div>

      {/* Métadonnées de l'observation */}
      <div className="p-3 flex-1 flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold text-gray-900 dark:text-white text-xs leading-tight">
            {meta.type_sujet ? `${PHOTO_TYPE_ICONS[meta.type_sujet as TypeSujet]} ${meta.type_sujet}` : '📷 Observation'}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {firstAnnexeRef && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                {firstAnnexeRef}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(meta.date_prise).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </div>
        </div>
        {champ && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">📍 {champ.nom}</p>}
        {meta.produit && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">🌿 {meta.produit}</p>}
        {meta.commentaire && <p className="text-xs text-gray-400 italic line-clamp-2">&ldquo;{meta.commentaire}&rdquo;</p>}
        {hasGps && (
          <p className="text-xs text-gray-400 font-mono">📌 {Number(meta.latitude).toFixed(4)}, {Number(meta.longitude).toFixed(4)}</p>
        )}
        <div className="mt-auto pt-1.5 flex justify-end border-t border-gray-100 dark:border-gray-700">
          {readOnly ? (
            <button
              onClick={() => onEdit(meta, photos)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition"
            >
              👁 Voir
            </button>
          ) : (
            <button
              onClick={() => onEdit(meta, photos)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition"
            >
              ✏️ Modifier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PhotosTab ─────────────────────────────────────────────────────────────────

function PhotosTab({
  plantationId,
  champs,
  photos,
  onPhotoAdded,
  readOnly = false,
}: {
  plantationId: string
  champs: Champ[]
  photos: PhotoTerrain[]
  onPhotoAdded: () => void
  readOnly?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    date_prise: todayStr(),
    champ_id: '',
    type_sujet: '' as TypeSujet | '',
    produit: '',
    commentaire: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // UUID stable pour l'observation courante — généré au montage, renouvelé après chaque upload
  const [observationId, setObservationId] = useState<string>(() => crypto.randomUUID())
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [geoErr, setGeoErr] = useState('')

  // ── Lightbox state ──────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxName, setLightboxName] = useState<string>('')
  const [thumbnailUrls, setThumbnailUrls]   = useState<Record<string, string>>({})
  const [lightboxIsVideo, setLightboxIsVideo] = useState(false)

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editingPhoto, setEditingPhoto] = useState<PhotoTerrain | null>(null)
  const [editingGroup, setEditingGroup] = useState<PhotoTerrain[]>([])
  const [selectedGroupPhoto, setSelectedGroupPhoto] = useState<PhotoTerrain | null>(null)
  const [editForm, setEditForm] = useState({
    date_prise: todayStr(),
    champ_id: '',
    type_sujet: '' as TypeSujet | '',
    produit: '',
    commentaire: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLon, setEditLon] = useState('')
  const [renamingFile, setRenamingFile] = useState(false)
  const [renameValue, setRenameValue]   = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  // ── Hover GPS ─────────────────────────────────────────────────────────────
  const [hoveredPhotoCoords, setHoveredPhotoCoords] = useState<{ lat: number; lon: number } | null>(null)

  // Load signed URLs for photos that have a SharePoint item ID
  useEffect(() => {
    const missing = photos
      .filter(p => p.url_sharepoint && !signedUrls[p.url_sharepoint])
      .map(p => p.url_sharepoint!)
    if (missing.length === 0) return
    missing.forEach(itemId => {
      fetch(`/api/agri/photos/signed-url?item_id=${encodeURIComponent(itemId)}`)
        .then(r => r.json())
        .then(json => {
          if (json.url) setSignedUrls(prev => ({ ...prev, [itemId]: json.url }))
        })
        .catch(() => {/* silencieux */})
    })
  }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load thumbnails pour les vidéos via Microsoft Graph
  useEffect(() => {
    const videoItems = photos.filter(p =>
      p.url_sharepoint && isVideoFile(p.filename) && !thumbnailUrls[p.url_sharepoint]
    )
    if (videoItems.length === 0) return
    videoItems.forEach(p => {
      fetch(`/api/ms/sharepoint/thumbnail?path=${encodeURIComponent(p.url_sharepoint!)}`)
        .then(r => r.ok ? r.json() : null)
        .then((j: { url?: string | null } | null) => {
          if (j?.url) setThumbnailUrls(prev => ({ ...prev, [p.url_sharepoint!]: j.url! }))
        })
        .catch(() => {})
    })
  }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss success message après 3s
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(''), 3000)
    return () => clearTimeout(t)
  }, [success])

  function captureGeo() {
    setGeoErr('')
    if (!navigator.geolocation) { setGeoErr('Géolocalisation non disponible'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLon(pos.coords.longitude.toFixed(6))
      },
      () => setGeoErr('Position indisponible')
    )
  }

  function captureGeoForEdit() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setEditLat(pos.coords.latitude.toFixed(6))
      setEditLon(pos.coords.longitude.toFixed(6))
    })
  }

  function handleChampChange(champId: string) {
    const champ = champs.find((c) => c.id === champId)
    setForm((f) => ({
      ...f,
      champ_id: champId,
      produit: champ ? champ.produit_faostat : f.produit,
    }))
  }

  async function openLightbox(photo: PhotoTerrain) {
    if (!photo.url_sharepoint) return
    const isVid = isVideoFile(photo.filename)
    setLightboxIsVideo(isVid)
    const cached = signedUrls[photo.url_sharepoint]
    if (cached) { setLightboxUrl(cached); setLightboxName(photo.filename || ''); return }
    try {
      const r = await fetch(`/api/agri/photos/signed-url?item_id=${encodeURIComponent(photo.url_sharepoint)}`)
      const j = await r.json()
      if (j.url) {
        setSignedUrls(p => ({ ...p, [photo.url_sharepoint!]: j.url }))
        setLightboxUrl(j.url)
        setLightboxName(photo.filename || '')
      }
    } catch { /* silencieux */ }
  }

  function openEditModal(photo: PhotoTerrain, group: PhotoTerrain[] = [photo]) {
    setEditingPhoto(photo)
    setEditingGroup(group)
    setSelectedGroupPhoto(group[0] ?? photo)
    setEditForm({
      date_prise: photo.date_prise,
      champ_id: photo.champ_id || '',
      type_sujet: (photo.type_sujet as TypeSujet | '') || '',
      produit: photo.produit || '',
      commentaire: photo.commentaire || '',
    })
    setEditLat(photo.latitude?.toString() || '')
    setEditLon(photo.longitude?.toString() || '')
    setEditError('')
    // Initialiser renommage
    const { body } = parseFilename(photo.filename)
    setRenameValue(body)
    setRenamingFile(false)
  }

  async function confirmRenameFile() {
    if (!editingPhoto || !renameValue.trim()) return
    const { annexeRef, ext } = parseFilename(editingPhoto.filename)
    const newName = annexeRef ? `${annexeRef}_${renameValue.trim()}${ext}` : `${renameValue.trim()}${ext}`
    if (newName === editingPhoto.filename) { setRenamingFile(false); return }
    setRenameSaving(true)
    try {
      const res = await fetch(`/api/agri/photos/${editingPhoto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newName }),
      })
      if (res.ok) {
        setEditingPhoto(prev => prev ? { ...prev, filename: newName } : null)
        onPhotoAdded() // Recharger la liste
        setRenamingFile(false)
      }
    } catch { /* silencieux */ } finally {
      setRenameSaving(false)
    }
  }

  async function saveEditPhoto() {
    if (!editingPhoto) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/agri/photos/${editingPhoto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_prise: editForm.date_prise,
          champ_id: editForm.champ_id || null,
          type_sujet: editForm.type_sujet || null,
          produit: editForm.produit || null,
          commentaire: editForm.commentaire || null,
          latitude: editLat ? parseFloat(editLat) : null,
          longitude: editLon ? parseFloat(editLon) : null,
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Erreur') }
      setEditingPhoto(null)
      onPhotoAdded()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e))
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDeletePhoto(photo: PhotoTerrain) {
    if (!confirm('Supprimer cette photo ? Cette action est irréversible.')) return
    try {
      await fetch(`/api/agri/photos/${photo.id}`, { method: 'DELETE' })
      setEditingPhoto(null)
      onPhotoAdded()
    } catch { /* silencieux */ }
  }

  async function handleSubmit() {
    if (selectedFiles.length === 0) { setError('Sélectionnez au moins une photo ou vidéo'); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      for (const file of selectedFiles) {
        const mime = file.type || 'application/octet-stream'
        const metadata = {
          filename:       file.name,
          mime,
          size:           file.size,
          plantation_id:  plantationId,
          observation_id: observationId,
          date_prise:     form.date_prise,
          ...(form.champ_id    ? { champ_id:    form.champ_id }    : {}),
          ...(form.type_sujet  ? { type_sujet:  form.type_sujet }  : {}),
          ...(form.produit     ? { produit:      form.produit }     : {}),
          ...(form.commentaire ? { commentaire:  form.commentaire } : {}),
          ...(lat              ? { latitude:     lat }              : {}),
          ...(lon              ? { longitude:    lon }              : {}),
        }

        // ── Étape 1 : obtenir la session d'upload SharePoint (JSON léger, jamais le fichier) ──
        const sessionRes = await fetch('/api/agri/photos/upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        })
        if (!sessionRes.ok) {
          let msg = `Erreur session ${sessionRes.status}`
          try { const j = await sessionRes.json(); msg = j.error ?? msg } catch { /* non-JSON */ }
          throw new Error(msg)
        }
        const { uploadUrl, fileName } = await sessionRes.json() as { uploadUrl: string; fileName: string }

        // ── Étape 2 : PUT direct vers SharePoint — le fichier ne passe JAMAIS par Vercel ──
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mime,
            'Content-Length': String(file.size),
            'Content-Range': `bytes 0-${file.size - 1}/${file.size}`,
          },
          body: file,
        })
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '')
          throw new Error(`Upload SharePoint ${uploadRes.status}: ${errText.slice(0, 120)}`)
        }
        const spItem = await uploadRes.json() as { id: string }

        // ── Étape 3 : enregistrer en DB via upload-confirm ──
        const confirmRes = await fetch('/api/agri/photos/upload-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...metadata, spItemId: spItem.id, fileName }),
        })
        if (!confirmRes.ok) {
          let msg = `Erreur confirm ${confirmRes.status}`
          try { const j = await confirmRes.json(); msg = j.error ?? msg } catch { /* non-JSON */ }
          throw new Error(msg)
        }
      }
      previews.forEach(url => URL.revokeObjectURL(url))
      setSelectedFiles([])
      setPreviews([])
      setForm({ date_prise: todayStr(), champ_id: '', type_sujet: '', produit: '', commentaire: '' })
      setLat('')
      setLon('')
      if (fileRef.current) fileRef.current.value = ''
      const count = selectedFiles.length
      setSuccess(`${count} fichier${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''} sur SharePoint ✓`)
      // Renouveler l'observation_id pour la prochaine observation
      setObservationId(crypto.randomUUID())
      onPhotoAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Grouper les photos en observations ───────────────────────────────────────
  // Toutes les photos soumises en même temps partagent les mêmes métadonnées.
  // Clé : date + champ + type + produit + commentaire → même observation.
  const observationGroups = (() => {
    const map = new Map<string, PhotoTerrain[]>()
    for (const p of photos) {
      const key = [p.date_prise, p.champ_id || '', p.type_sujet || '', p.produit || '', p.commentaire || ''].join('|')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b[0].date_prise).getTime() - new Date(a[0].date_prise).getTime())
  })()

  return (
    <div className="space-y-6">

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
            onClick={() => setLightboxUrl(null)}
          >×</button>
          {lightboxIsVideo ? (
            <video
              src={lightboxUrl}
              controls
              autoPlay
              preload="metadata"
              className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightboxUrl}
              alt={lightboxName}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Edit modal */}
      {editingPhoto && (
        <div
          className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
          style={{ zIndex: 9998 }}
          onClick={() => setEditingPhoto(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl my-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {readOnly ? '👁 Voir l\'observation' : '📷 Modifier la photo'}
              </h2>
              <button
                onClick={() => setEditingPhoto(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
              >×</button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Vignettes du groupe + photo sélectionnée */}
              {editingGroup.length > 0 && (() => {
                const active = selectedGroupPhoto ?? editingGroup[0]
                const activeUrl = active.url_sharepoint ? signedUrls[active.url_sharepoint] : undefined
                const isVid = isVideoFile(active.filename)
                return (
                  <div className="space-y-2">
                    {/* Photo active (grande) */}
                    {activeUrl && (
                      isVid ? (
                        <video src={activeUrl} controls preload="metadata"
                          className="w-full h-56 object-cover rounded-xl bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeUrl}
                          className="w-full h-56 object-cover rounded-xl cursor-pointer"
                          onClick={() => openLightbox(active)}
                          alt="photo" />
                      )
                    )}
                    {/* Grille de vignettes — visible seulement si plusieurs photos */}
                    {editingGroup.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
                        {editingGroup.map((p) => {
                          const url = p.url_sharepoint ? signedUrls[p.url_sharepoint] : undefined
                          const selected = p.id === active.id
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedGroupPhoto(p)}
                              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-emerald-500 ring-2 ring-emerald-400/50' : 'border-transparent opacity-60 hover:opacity-100 hover:border-gray-400'}`}
                            >
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl">
                                  {isVideoFile(p.filename) ? '🎬' : '📷'}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Nom du fichier + préfixe annexe */}
              {editingPhoto.filename && (() => {
                const { annexeRef, body: fnBody, ext } = parseFilename(editingPhoto.filename)
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {annexeRef && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                        {annexeRef}
                      </span>
                    )}
                    {!readOnly && renamingFile ? (
                      <div className="flex items-center gap-1 flex-1">
                        {annexeRef && <span className="text-xs text-gray-400 select-none shrink-0">{annexeRef}_</span>}
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRenameFile(); if (e.key === 'Escape') setRenamingFile(false) }}
                          className="flex-1 min-w-0 text-sm bg-transparent border-b border-indigo-400 outline-none text-gray-900 dark:text-white"
                        />
                        {ext && <span className="text-xs text-gray-400 select-none shrink-0">{ext}</span>}
                        <button onClick={confirmRenameFile} disabled={renameSaving} className="text-xs px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition">{renameSaving ? '…' : '✓'}</button>
                        <button onClick={() => setRenamingFile(false)} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{fnBody}{ext}</span>
                        {!readOnly && (
                          <button
                            onClick={() => { setRenameValue(fnBody); setRenamingFile(true) }}
                            className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition"
                            title="Renommer le fichier"
                          >✏️</button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass()}>Date</label>
                  <input
                    type="date"
                    className={inputClass()}
                    value={editForm.date_prise}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditForm(f => ({ ...f, date_prise: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass()}>Champ</label>
                  <select
                    className={inputClass()}
                    value={editForm.champ_id}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditForm(f => ({ ...f, champ_id: e.target.value }))}
                  >
                    <option value="">— Tous les champs —</option>
                    {champs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass()}>Type de sujet</label>
                  <select
                    className={inputClass()}
                    value={editForm.type_sujet}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditForm(f => ({ ...f, type_sujet: e.target.value as TypeSujet | '' }))}
                  >
                    <option value="">—</option>
                    {TYPE_SUJETS.map(t => (
                      <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass()}>Produit</label>
                  <input
                    className={inputClass()}
                    value={editForm.produit}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditForm(f => ({ ...f, produit: e.target.value }))}
                  />
                </div>
              </div>

              {/* Commentaire + Notes & Documents */}
              <div>
                <label className={labelClass()}>Commentaire</label>
                <textarea
                  className={inputClass('resize-none')}
                  rows={2}
                  value={editForm.commentaire}
                  disabled={readOnly}
                  onChange={e => !readOnly && setEditForm(f => ({ ...f, commentaire: e.target.value }))}
                  placeholder="Description de l'observation…"
                />
                <div className="mt-3">
                  {/* Si la photo a un observation_id, utiliser les notes d'observation ; sinon fallback sur photo */}
                  <ActionNotePanel
                    sessionId={(editingPhoto as PhotoTerrain & { observation_id?: string }).observation_id ?? editingPhoto.id}
                    actionKey="notes"
                    initialSections={null}
                    apiBase={(editingPhoto as PhotoTerrain & { observation_id?: string }).observation_id
                      ? '/api/agri/observations'
                      : '/api/agri/photos'}
                    realtimeTable={(editingPhoto as PhotoTerrain & { observation_id?: string }).observation_id
                      ? 'agri_observation_notes'
                      : 'photos_terrain'}
                    uploadExtraFormData={{ plantation_id: plantationId }}
                    readOnly={readOnly}
                  />
                </div>
              </div>

              {/* GPS avec point sur la carte */}
              <div>
                <label className={labelClass()}>
                  {readOnly ? 'Géolocalisation' : 'Géolocalisation — maintenez 10s sur la carte pour définir un point'}
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    className={inputClass()}
                    placeholder="Latitude"
                    value={editLat}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditLat(e.target.value)}
                  />
                  <input
                    type="text"
                    className={inputClass()}
                    placeholder="Longitude"
                    value={editLon}
                    disabled={readOnly}
                    onChange={e => !readOnly && setEditLon(e.target.value)}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={captureGeoForEdit}
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline mb-2"
                  >
                    📍 Capturer ma position
                  </button>
                )}
                <ChampsMap
                  champs={champs}
                  height="200px"
                  onLongPress={readOnly ? undefined : (lat, lon) => { setEditLat(lat.toFixed(6)); setEditLon(lon.toFixed(6)) }}
                  longPressSecs={10}
                  pulsedPoint={editLat && editLon ? { lat: parseFloat(editLat), lon: parseFloat(editLon) } : undefined}
                />
              </div>

              {/* Footer */}
              {!readOnly && editError && <p className="text-sm text-red-500">{editError}</p>}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                {readOnly ? (
                  <span />
                ) : (
                  <button
                    onClick={() => confirmDeletePhoto(editingPhoto)}
                    className="px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    🗑️ Supprimer la photo
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setEditingPhoto(null)} className={btnSecondary()}>
                    {readOnly ? 'Fermer' : 'Annuler'}
                  </button>
                  {!readOnly && (
                    <button onClick={saveEditPhoto} className={btnPrimary()} disabled={editSaving}>
                      {editSaving ? 'Enregistrement…' : '✓ Enregistrer'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste des observations */}
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          Liste des observations ({observationGroups.length})
        </h3>
        {observationGroups.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune observation enregistrée</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {observationGroups.map((group) => (
              <ObservationCard
                key={group[0].id}
                photos={group}
                signedUrls={signedUrls}
                thumbnailUrls={thumbnailUrls}
                champs={champs}
                onLightbox={openLightbox}
                onEdit={openEditModal}
                onHoverPhoto={setHoveredPhotoCoords}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>

      {/* Carte GPS — champs (vert) + photos géolocalisées (orange) */}
      <ChampsMap champs={champs} photos={photos} height="260px" pulsedPoint={hoveredPhotoCoords ?? undefined} />

      {/* Upload form — masqué en mode lecture seule (vue acheteur) */}
      {!readOnly && <div className={`${cardClass('p-5')} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">📷 Ajouter une observation</h3>
        </div>
        {/* File drop zone */}
        <div>
          <label className={labelClass()}>Photos &amp; Vidéos *</label>
          <div
            className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {selectedFiles.length > 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 py-2">+ Ajouter d&apos;autres fichiers</p>
            ) : (
              <div className="py-4">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm text-gray-500">Cliquez ou glissez des photos / vidéos ici</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, MP4, MOV… — upload direct SharePoint, aucune limite</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length === 0) return
                const newPreviews = files.map(f =>
                  f.type.startsWith('video/') ? '' : URL.createObjectURL(f)
                )
                setSelectedFiles(prev => [...prev, ...files])
                setPreviews(prev => [...prev, ...newPreviews])
                setError('')
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
          </div>
          {/* Thumbnail carousel */}
          {selectedFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2" style={{ scrollbarWidth: 'thin' }}>
              {previews.map((src, idx) => (
                <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                      <span className="text-2xl">🎬</span>
                      <span className="text-[10px] mt-1 px-1 text-center truncate w-full text-center">{selectedFiles[idx]?.name.split('.').pop()?.toUpperCase()}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(src)
                      setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
                      setPreviews(prev => prev.filter((_, i) => i !== idx))
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white text-xs rounded-full leading-none transition"
                    title="Supprimer"
                  >✕</button>
                </div>
              ))}
              {/* + tile */}
              <div
                className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-2xl text-gray-400 cursor-pointer hover:border-emerald-400 transition-colors"
                onClick={() => fileRef.current?.click()}
                title="Ajouter d'autres photos"
              >+</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass()}>Date</label>
            <input
              type="date"
              className={inputClass()}
              value={form.date_prise}
              onChange={(e) => setForm((f) => ({ ...f, date_prise: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass()}>Champ (optionnel)</label>
            <select
              className={inputClass()}
              value={form.champ_id}
              onChange={(e) => handleChampChange(e.target.value)}
            >
              <option value="">— Tous les champs —</option>
              {champs.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass()}>Type de sujet</label>
            <select
              className={inputClass()}
              value={form.type_sujet}
              onChange={(e) => setForm((f) => ({ ...f, type_sujet: e.target.value as TypeSujet | '' }))}
            >
              <option value="">—</option>
              {TYPE_SUJETS.map((t) => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass()}>Produit</label>
            <input
              className={inputClass()}
              value={form.produit}
              onChange={(e) => setForm((f) => ({ ...f, produit: e.target.value }))}
              placeholder="Auto-rempli depuis champ"
            />
          </div>
        </div>
        <div>
          <label className={labelClass()}>Commentaire</label>
          <textarea
            className={inputClass('resize-none')}
            rows={2}
            value={form.commentaire}
            onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
          />
          {/* Notes & Documents — liés à l'observation, disponibles immédiatement */}
          <div className="mt-3">
            <ActionNotePanel
              sessionId={observationId}
              actionKey="notes"
              initialSections={null}
              apiBase="/api/agri/observations"
              realtimeTable="agri_observation_notes"
              uploadExtraFormData={{ plantation_id: plantationId }}
              readOnly={false}
            />
          </div>
        </div>
        <div>
          <label className={labelClass()}>Géolocalisation</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              className={inputClass()}
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <input
              type="text"
              className={inputClass()}
              placeholder="Longitude"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </div>
          <button type="button" onClick={captureGeo} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
            📍 Capturer ma position
          </button>
          {geoErr && <p className="text-xs text-red-500 mt-1">{geoErr}</p>}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-4 flex-wrap">
          <button className={btnPrimary()} onClick={handleSubmit} disabled={saving || selectedFiles.length === 0}>
            {saving ? 'Upload en cours…' : `📷 Enregistrer l'observation${selectedFiles.length > 0 ? ` (${selectedFiles.length} fichier${selectedFiles.length !== 1 ? 's' : ''})` : ''}`}
          </button>
          {success && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              ✅ {success}
            </span>
          )}
        </div>

      </div>}
    </div>
  )
}

// ─── TutoModal ────────────────────────────────────────────────────────────────

type TutoRole = 'planteur' | 'acheteur'

function TutoModal({ defaultRole = 'planteur', solo = false, onClose }: { defaultRole?: TutoRole; solo?: boolean; onClose: () => void }) {
  const [role, setRole] = useState<TutoRole>(defaultRole)

  const steps: Record<TutoRole, { icon: string; title: string; items: { label: string; detail: string }[] }[]> = {
    planteur: [
      {
        icon: '🏡', title: 'Créer votre plantation',
        items: [
          { label: 'Nom & localisation', detail: 'Renseignez le nom, le pays, la région et la ville. Ces informations sont visibles par vos acheteurs autorisés.' },
          { label: 'Informations légales', detail: 'Ajoutez la forme juridique (SARL, Coopérative…) et le numéro de registre si disponibles.' },
          { label: 'Superficie totale', detail: 'Indiquez la superficie en hectares. Elle sera comparée à la somme de vos champs.' },
          { label: 'Plusieurs plantations', detail: 'Vous pouvez gérer plusieurs plantations avec le bouton « + Nouvelle plantation ».' },
        ],
      },
      {
        icon: '🌾', title: 'Gérer vos champs (parcelles)',
        items: [
          { label: 'Créer un champ', detail: 'Chaque champ représente une parcelle cultivée. Cliquez sur « + Nouveau champ » dans l\'onglet Champs.' },
          { label: 'Produit FAOSTAT', detail: 'Choisissez votre culture dans la liste officielle FAO : cacao, café, banane, etc.' },
          { label: 'Variété & superficie', detail: 'Précisez la variété cultivée et la superficie en hectares pour chaque parcelle.' },
          { label: 'Coordonnées GPS', detail: 'Ajoutez la latitude et longitude — la carte s\'affiche automatiquement pour localiser vos parcelles.' },
        ],
      },
      {
        icon: '🌤️', title: 'Saisir les observations météo',
        items: [
          { label: 'Calendrier', detail: 'L\'onglet Météo affiche un calendrier mensuel. Les jours avec des relevés sont marqués par des icônes.' },
          { label: '3 périodes par jour', detail: 'Nuit 🌙, Matin ☀️ et Après-midi 🌆 : vous pouvez saisir une observation par période.' },
          { label: 'Données saisies', detail: 'Température (°C), humidité (%), précipitations (mm), vitesse et direction du vent, couverture nuageuse.' },
          { label: 'Commentaire', detail: 'Un champ libre vous permet d\'ajouter toute observation particulière (gel, orage, brume…).' },
          { label: 'Météo prévisionnelle', detail: 'La section du bas affiche 7 jours de prévisions basées sur les coordonnées GPS de votre champ.' },
        ],
      },
      {
        icon: '📷', title: 'Documenter avec des photos',
        items: [
          { label: 'Uploader une photo', detail: 'Cliquez sur « + Ajouter une photo » pour importer une image depuis votre appareil ou mobile.' },
          { label: 'Type de sujet', detail: 'Taguez la photo : Fruit 🍎, Plante 🌱, Arbre 🌳, Sol 🪨, Maladie 🦠 ou Autre 📷.' },
          { label: 'Informations complémentaires', detail: 'Associez une date, une heure, un commentaire et les coordonnées GPS de prise de vue.' },
          { label: 'Utilité pour l\'IA', detail: 'Plus vous avez de photos annotées, plus l\'analyse IA sera précise et pertinente.' },
        ],
      },
      {
        icon: '🤖', title: 'Partage avec les acheteurs',
        items: [
          { label: 'Accès acheteur', detail: 'Les acheteurs autorisés voient vos observations météo et photos mais ne peuvent pas les modifier.' },
          { label: 'Analyse IA', detail: 'L\'acheteur peut générer une analyse IA de votre plantation depuis sa vue. Elle est sauvegardée et reste visible.' },
          { label: 'Confidentialité', detail: 'Seuls les acheteurs explicitement autorisés par l\'administrateur peuvent accéder à votre plantation.' },
        ],
      },
    ],
    acheteur: [
      {
        icon: '☕🍫', title: 'Marchés café et cacao',
        items: [
          { label: 'Onglets Café et Cacao', detail: 'Ces deux onglets affichent les données de production mondiale officielle (source : FAO / FAOSTAT).' },
          { label: 'Historique de production', detail: 'Graphique en barres des 10 dernières années (en millions de tonnes), avec le détail annuel.' },
          { label: 'Top producteurs', detail: 'Répartition en % des principaux pays producteurs (ex: Côte d\'Ivoire 40%, Ghana 17% pour le cacao).' },
          { label: 'Mise à jour', detail: 'Les données sont mises en cache 24h. Cliquez sur 🔄 pour forcer un rafraîchissement.' },
        ],
      },
      {
        icon: '📈', title: 'Cours de Londres (ICE Futures)',
        items: [
          { label: 'Cacao et Café Robusta', detail: 'Prix des futures sur ICE Futures Europe — le marché de référence mondial pour ces matières premières.' },
          { label: 'Graphique sparkline', detail: 'Courbe sur 30 jours avec zone colorée, axes gradués, prix le plus haut et plus bas de la période.' },
          { label: 'Prix de clôture', detail: 'Le grand chiffre affiché est le dernier cours de clôture journalier, en USD/tonne.' },
          { label: 'Variations', detail: 'Variation sur J-1 (badge vert/rouge) et performance sur 5 jours et 30 jours.' },
          { label: 'Source', detail: 'Données Stooq.com — cotations journalières gratuites (~15 min de décalage). Mises en cache 1h.' },
        ],
      },
      {
        icon: '🌿', title: 'Accéder aux plantations',
        items: [
          { label: 'Liste des plantations', detail: 'L\'onglet Plantations liste toutes les exploitations pour lesquelles vous avez été autorisé.' },
          { label: 'Ouvrir une plantation', detail: 'Cliquez sur une carte de plantation pour accéder à sa fiche détaillée (4 onglets).' },
          { label: 'Aucune plantation ?', detail: 'Si la liste est vide, contactez un planteur partenaire ou l\'administrateur de la plateforme.' },
        ],
      },
      {
        icon: '📋', title: 'Aperçu d\'une plantation',
        items: [
          { label: 'Informations générales', detail: 'Pays, région, ville, superficie totale, forme juridique et numéro de registre.' },
          { label: 'Champs cultivés', detail: 'Liste des parcelles avec produit, variété et superficie. La carte Leaflet localise chaque champ.' },
          { label: 'Navigation', detail: 'Utilisez le bouton ← Retour pour revenir à la liste des plantations.' },
        ],
      },
      {
        icon: '🌤️', title: 'Observations météo (lecture seule)',
        items: [
          { label: 'Calendrier', detail: 'Calendrier mensuel avec icônes sur les jours ayant des relevés météo.' },
          { label: 'Lire les données', detail: 'Cliquez sur n\'importe quel jour pour afficher les observations : température, humidité, pluie, vent, nuages.' },
          { label: 'Lecture seule', detail: 'Vous pouvez consulter les données mais pas les modifier — seul le planteur peut saisir des relevés.' },
          { label: 'Navigation mensuelle', detail: 'Les flèches ◀ ▶ permettent de naviguer d\'un mois à l\'autre.' },
        ],
      },
      {
        icon: '📷', title: 'Photos terrain (lecture seule)',
        items: [
          { label: 'Galerie', detail: 'Toutes les photos prises par le planteur, avec leur date, sujet et commentaire.' },
          { label: 'Voir une photo', detail: 'Cliquez sur 👁 Voir pour ouvrir la fiche complète d\'une observation photo.' },
          { label: 'Filtres', detail: 'Filtrez par type de sujet : fruit, plante, arbre, sol, maladie ou autre.' },
          { label: 'Lecture seule', detail: 'Aucune modification n\'est possible depuis la vue acheteur.' },
        ],
      },
      {
        icon: '🤖', title: 'Analyse IA',
        items: [
          { label: 'Générer une analyse', detail: 'Cliquez sur « ✨ Générer une analyse » — l\'IA analyse les observations météo, les photos et les cours du marché.' },
          { label: 'Trois horizons', detail: 'Court terme (0–3 mois), Moyen terme (3–12 mois) et Long terme (12+ mois) avec une perspective claire.' },
          { label: 'Risques & Opportunités', detail: 'Tags colorés identifiant les principaux facteurs de risque et les opportunités à saisir.' },
          { label: 'Recommandations', detail: 'Liste priorisée d\'actions concrètes à envisager pour cette plantation.' },
          { label: 'Score qualité', detail: 'Note sur 100 reflétant la richesse des données disponibles. Plus de relevés = analyse plus fiable.' },
          { label: 'Persistance', detail: 'La dernière analyse est sauvegardée — elle reste visible à chaque visite. Cliquez sur 🔄 Regénérer pour la mettre à jour.' },
        ],
      },
    ],
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className="text-lg font-bold text-white">Guide d&apos;utilisation — AgriTracker</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white">
            ✕
          </button>
        </div>

        {/* Tab switcher — masqué si solo (guide dédié à un seul rôle) */}
        {!solo && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {([['planteur', '👨‍🌾', 'Guide Planteur'], ['acheteur', '🏪', 'Guide Acheteur']] as [TutoRole, string, string][]).map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  role === key
                    ? 'text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 bg-white dark:bg-gray-900'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {steps[role].map((section, si) => (
            <div key={si} className="space-y-3">
              {/* Section header */}
              <div className="flex items-center gap-2">
                <span className="text-xl">{section.icon}</span>
                <h3 className="font-semibold text-gray-900 dark:text-white text-base">{section.title}</h3>
              </div>
              {/* Items */}
              <div className="space-y-2 pl-8">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex gap-2.5">
                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-center font-bold">
                      {ii + 1}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label} — </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-800 dark:text-emerald-300 text-center">
              💬 Une question ? Contactez votre administrateur de plateforme ou l&apos;équipe Sens&apos;ethO.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PlanteurView ──────────────────────────────────────────────────────────────

function PlanteurView({
  plantations,
  onPlantationsChange,
}: {
  plantations: Plantation[]
  onPlantationsChange: (p: Plantation[]) => void
}) {
  const supabase = createClient()
  const { profile: user, isAdmin } = useAuth()
  const [selectedPlantationId, setSelectedPlantationId] = useState<string | null>(
    () => plantations[0]?.id ?? null
  )
  const [tab, setTab] = useState<AgriTab>('plantation')
  const [champs, setChamps] = useState<Champ[]>([])
  const [observations, setObservations] = useState<ObservationMeteo[]>([])
  const [photos, setPhotos] = useState<PhotoTerrain[]>([])
  const [showChampModal, setShowChampModal] = useState(false)
  const [savingPlantation, setSavingPlantation] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [showTuto, setShowTuto] = useState(false)
  const [hoveredChampPoint, setHoveredChampPoint] = useState<{ lat: number; lon: number } | null>(null)

  // Si aucune plantation sélectionnée mais des plantations existent (ex: après chargement), sélectionner la première
  useEffect(() => {
    if (!selectedPlantationId && plantations.length > 0) {
      setSelectedPlantationId(plantations[0].id)
    }
  }, [plantations, selectedPlantationId])

  // Plantation active dérivée de l'état sélectionné
  const plantation = useMemo(
    () => plantations.find((p) => p.id === selectedPlantationId) ?? null,
    [plantations, selectedPlantationId]
  )

  const loadChamps = useCallback(async (pId: string) => {
    try {
      const res = await fetch(`/api/agri/champs?plantation_id=${pId}`)
      if (res.ok) {
        const json = await res.json()
        setChamps((json.champs as Champ[]) ?? [])
      }
    } catch { /* silencieux */ }
  }, [])

  const loadObs = useCallback(async (pId: string) => {
    try {
      const res = await fetch(`/api/agri/observations?plantation_id=${pId}`)
      if (res.ok) {
        const json = await res.json()
        setObservations((json.observations as ObservationMeteo[]) ?? [])
      }
    } catch { /* silencieux */ }
  }, [])

  const loadPhotos = useCallback(async (pId: string) => {
    try {
      const res = await fetch(`/api/agri/photos?plantation_id=${pId}`)
      if (res.ok) {
        const json = await res.json()
        setPhotos((json.photos as PhotoTerrain[]) ?? [])
      }
    } catch { /* silencieux */ }
  }, [])

  useEffect(() => {
    if (plantation) {
      setChamps([])
      setObservations([])
      setPhotos([])
      loadChamps(plantation.id)
      loadObs(plantation.id)
      loadPhotos(plantation.id)
    }
  }, [plantation?.id, loadChamps, loadObs, loadPhotos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function savePlantation(form: Partial<Plantation>) {
    setSavingPlantation(true)
    try {
      if (plantation && !creatingNew) {
        const { data, error } = await supabase
          .from('plantations')
          .update({
            nom: form.nom,
            pays_code: form.pays_code,
            pays_nom: form.pays_nom,
            region: form.region || null,
            ville: form.ville || null,
            adresse: form.adresse || null,
            forme_juridique: form.forme_juridique || null,
            numero_registre: form.numero_registre || null,
            superficie_totale_ha: form.superficie_totale_ha ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', plantation.id)
          .select()
          .single()
        if (!error && data) {
          onPlantationsChange(
            plantations.map((p) => (p.id === plantation.id ? (data as Plantation) : p))
          )
        }
      } else {
        if (!user) return
        const { data, error } = await supabase
          .from('plantations')
          .insert({
            user_id: user.id,
            nom: form.nom,
            pays_code: form.pays_code ?? 'CI',
            pays_nom: form.pays_nom ?? "Côte d'Ivoire",
            region: form.region || null,
            ville: form.ville || null,
            adresse: form.adresse || null,
            forme_juridique: form.forme_juridique || null,
            numero_registre: form.numero_registre || null,
            superficie_totale_ha: form.superficie_totale_ha ?? null,
          })
          .select()
          .single()
        if (!error && data) {
          const newPlantation = data as Plantation
          onPlantationsChange([...plantations, newPlantation])
          setSelectedPlantationId(newPlantation.id)
          setCreatingNew(false)
        }
      }
    } finally {
      setSavingPlantation(false)
    }
  }

  const firstCoords = useMemo(() => {
    const c = champs.find((ch) => ch.coordonnees)
    return c?.coordonnees ?? null
  }, [champs])

  const agriTabs = [
    { key: 'plantation' as AgriTab, label: 'Plantation', icon: '🏡' },
    { key: 'champs' as AgriTab, label: 'Champs', icon: '🌾' },
    { key: 'meteo' as AgriTab, label: 'Météo', icon: '🌤️' },
    { key: 'photos' as AgriTab, label: 'Observations', icon: '📷' },
    { key: 'crm' as AgriTab, label: 'CRM', icon: '🤝' },
  ]

  const showingForm = creatingNew || (!plantation && plantations.length === 0)

  return (
    <div>
      {showTuto && <TutoModal defaultRole="planteur" solo onClose={() => setShowTuto(false)} />}

      {/* Sélecteur de plantation — visible si plusieurs plantations ou si on peut en créer une nouvelle */}
      {(plantations.length > 1 || (!showingForm && plantation)) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {plantations.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPlantationId(p.id); setCreatingNew(false) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                p.id === selectedPlantationId && !creatingNew
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              }`}
            >
              🏡 {p.nom}
            </button>
          ))}
          <button
            onClick={() => { setCreatingNew(true); setTab('plantation') }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              creatingNew
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            + Nouvelle plantation
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1"><TabBar tabs={agriTabs} active={tab} onChange={setTab} /></div>
        <button
          onClick={() => setShowTuto(true)}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-sm font-bold flex items-center justify-center"
          title="Guide d'utilisation"
        >
          ?
        </button>
      </div>

      {tab === 'plantation' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {showingForm ? 'Créer une nouvelle plantation' : `Plantation : ${plantation?.nom}`}
          </h2>
          <PlantationForm
            key={creatingNew ? 'new' : (plantation?.id ?? 'empty')}
            initial={showingForm ? {} : (plantation ?? {})}
            onSave={savePlantation}
            saving={savingPlantation}
          />
        </div>
      )}

      {tab === 'champs' && plantation && !creatingNew && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Champs ({champs.length})
            </h2>
            <button className={btnPrimary()} onClick={() => setShowChampModal(true)}>
              + Nouveau champ
            </button>
          </div>

          {/* Carte interactive */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🗺️ Carte des champs
            </h3>
            <ChampsMap champs={champs} pulsedPoint={hoveredChampPoint ?? undefined} />
          </div>

          {champs.length === 0 ? (
            <div className={`${cardClass('p-8 text-center')} text-gray-500 dark:text-gray-400`}>
              <div className="text-3xl mb-2">🌾</div>
              <p>Aucun champ enregistré</p>
              <button className={`${btnPrimary('mt-3')}`} onClick={() => setShowChampModal(true)}>
                Ajouter le premier champ
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {champs.map((c) => {
                const coords = c.coordonnees && typeof c.coordonnees.lat === 'number'
                  ? { lat: c.coordonnees.lat, lon: c.coordonnees.lon }
                  : null
                return (
                  <div
                    key={c.id}
                    className={`${cardClass('p-4')} space-y-2 transition-shadow hover:shadow-md cursor-default`}
                    onMouseEnter={() => coords && setHoveredChampPoint(coords)}
                    onMouseLeave={() => setHoveredChampPoint(null)}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">{c.nom}</div>
                    <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      🌿 {c.produit_faostat}
                    </div>
                    {c.variete && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Variété : {c.variete}
                      </div>
                    )}
                    {c.superficie_ha != null && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        📐 {c.superficie_ha} ha
                      </div>
                    )}
                    {c.coordonnees && (
                      <a
                        href={`https://maps.google.com/?q=${c.coordonnees.lat},${c.coordonnees.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline block"
                      >
                        📍 {c.coordonnees.lat.toFixed(4)}, {c.coordonnees.lon.toFixed(4)}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {showChampModal && (
            <ChampModal
              plantationId={plantation.id}
              onSaved={(c) => {
                setChamps((cs) => [...cs, c])
                setShowChampModal(false)
              }}
              onClose={() => setShowChampModal(false)}
            />
          )}
        </div>
      )}

      {tab === 'champs' && (!plantation || creatingNew) && (
        <div className="text-center py-8 text-gray-400">
          Créez d&apos;abord votre plantation pour ajouter des champs
        </div>
      )}

      {tab === 'meteo' && plantation && !creatingNew && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Mon calendrier</h3>
              <MeteoCalendar
                plantationId={plantation.id}
                champs={champs}
                observations={observations}
                onObsChange={() => loadObs(plantation.id)}
              />
            </div>
            {firstCoords && (
              <div className="lg:w-80 flex-shrink-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Météo en temps réel</h3>
                <WeatherWidget lat={firstCoords.lat} lon={firstCoords.lon} />
              </div>
            )}
            {!firstCoords && (
              <div className="lg:w-80 flex-shrink-0">
                <div className={`${cardClass('p-4')} text-sm text-gray-400 dark:text-gray-500 text-center`}>
                  <div className="text-2xl mb-2">🌦️</div>
                  Ajoutez les coordonnées GPS d&apos;un champ pour afficher la météo API
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'meteo' && (!plantation || creatingNew) && (
        <div className="text-center py-8 text-gray-400">
          Créez d&apos;abord votre plantation
        </div>
      )}

      {tab === 'photos' && plantation && !creatingNew && (
        <PhotosTab
          plantationId={plantation.id}
          champs={champs}
          photos={photos}
          onPhotoAdded={() => loadPhotos(plantation.id)}
        />
      )}

      {tab === 'photos' && (!plantation || creatingNew) && (
        <div className="text-center py-8 text-gray-400">
          Créez d&apos;abord votre plantation
        </div>
      )}

      {tab === 'crm' && plantation && !creatingNew && user && (
        <AgriCRM
          plantationId={plantation.id}
          plantationNom={plantation.nom}
          isAcheteur={false}
          isAdmin={isAdmin}
          currentUserId={user.id}
        />
      )}
      {tab === 'crm' && (!plantation || creatingNew) && (
        <div className="text-center py-8 text-gray-400">
          Créez d&apos;abord votre plantation
        </div>
      )}
    </div>
  )
}

// ─── ProductionTab ─────────────────────────────────────────────────────────────

function ProductionTab({
  commodity,
  data,
  loading,
}: {
  commodity: 'cacao' | 'cafe'
  data: {
    label: string
    unit: string
    rows: { year: number; production_t: number }[]
    top_producers: { country: string; share_pct: number }[]
    source: string
  } | null
  loading: boolean
}) {
  const icon = commodity === 'cacao' ? '🍫' : '☕'
  const colorClass = commodity === 'cacao'
    ? 'bg-amber-500 dark:bg-amber-400'
    : 'bg-emerald-500 dark:bg-emerald-400'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {icon} Production mondiale — {commodity === 'cacao' ? 'Cacao (fèves)' : 'Café (vert)'}
        </h3>
        {/* Bouton Actualiser désactivé — données chargées une fois par session */}
        <button disabled className={btnSecondary('text-xs py-1.5 px-3 opacity-40 cursor-not-allowed')}>
          🔄 Actualiser
        </button>
      </div>

      {loading && !data && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

      {data && (
        <>
          {/* Graphique à barres horizontal simplifié */}
          <div className={`${cardClass('p-5')} space-y-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Production (millions de tonnes)</span>
              {data.source === 'fallback' && (
                <span className="text-xs text-amber-500 dark:text-amber-400">Données estimées</span>
              )}
            </div>
            {(() => {
              const recent = data.rows.slice(-10)
              const maxVal = Math.max(...recent.map(r => r.production_t))
              return recent.map(row => (
                <div key={row.year} className="flex items-center gap-3">
                  <span className="w-10 text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">{row.year}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorClass} transition-all`}
                      style={{ width: `${(row.production_t / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-xs text-gray-700 dark:text-gray-300 tabular-nums text-right shrink-0">
                    {(row.production_t / 1_000_000).toFixed(2)} Mt
                  </span>
                </div>
              ))
            })()}
          </div>

          {/* Top producteurs */}
          <div className={`${cardClass('p-5')} space-y-3`}>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Principaux pays producteurs (2022–23)</h4>
            {data.top_producers.map((p) => (
              <div key={p.country} className="flex items-center gap-3">
                <span className="w-36 text-xs text-gray-700 dark:text-gray-300 truncate shrink-0">{p.country}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${p.share_pct}%` }}
                  />
                </div>
                <span className="w-10 text-xs text-gray-500 dark:text-gray-400 tabular-nums text-right shrink-0">{p.share_pct}%</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">Source : FAOSTAT (FAO) · Quantité de production, élément 5510</p>
        </>
      )}
    </div>
  )
}

// ─── CoursCard ─────────────────────────────────────────────────────────────────

function CoursCard({
  data,
  color,
}: {
  data: {
    name: string
    unit: string
    prices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]
    last_close: number | null
    change_pct: number | null
    mock: boolean
  }
  color: 'amber' | 'green'
}) {
  const strokeColor  = color === 'amber' ? '#f59e0b' : '#10b981'
  const fillId       = `grad-${color}`
  const isPositive   = (data.change_pct ?? 0) >= 0
  const changeColor  = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
  const badgeBg      = isPositive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'

  const prices = data.prices
  const last   = prices[prices.length - 1]
  const prev   = prices[prices.length - 2]

  // Variation sur 1 jour
  const changeDay    = last && prev ? last.close - prev.close : null
  const changeDayPct = last && prev && prev.close ? ((last.close - prev.close) / prev.close * 100) : null

  // Stats 30 jours
  const max30  = prices.length ? Math.max(...prices.map(p => p.high  || p.close)) : null
  const min30  = prices.length ? Math.min(...prices.map(p => p.low   || p.close)) : null
  const vol30  = prices.length ? Math.round(prices.reduce((s, p) => s + (p.volume || 0), 0) / prices.length) : null
  const open30 = prices[0]?.close ?? null
  const chg30  = open30 && last?.close ? ((last.close - open30) / open30 * 100) : null

  // Graphique SVG
  const W = 400
  const H = 120
  const PAD = { t: 12, r: 8, b: 20, l: 52 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const chartData = prices.slice(-30)
  const maxV = chartData.length ? Math.max(...chartData.map(p => p.high || p.close)) : 1
  const minV = chartData.length ? Math.min(...chartData.map(p => p.low  || p.close)) : 0
  const range = maxV - minV || 1

  const toX = (i: number) => PAD.l + (i / Math.max(chartData.length - 1, 1)) * chartW
  const toY = (v: number) => PAD.t + chartH - ((v - minV) / range) * chartH

  const linePts  = chartData.map((p, i) => `${toX(i).toFixed(1)},${toY(p.close).toFixed(1)}`).join(' ')
  const areaPts  = chartData.length
    ? `${toX(0).toFixed(1)},${(PAD.t + chartH).toFixed(1)} ${linePts} ${toX(chartData.length - 1).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`
    : ''

  // Y-axis ticks (3 niveaux)
  const yTicks = [minV, minV + range / 2, maxV]

  // X-axis : 3 dates réparties
  const xTicks = chartData.length >= 3
    ? [0, Math.floor((chartData.length - 1) / 2), chartData.length - 1]
    : [0]

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  return (
    <div className={`${cardClass('')} overflow-hidden`}>
      {/* En-tête coloré */}
      <div className={`px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">{data.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ICE Futures Europe · {data.unit}</p>
          </div>
          <div className="text-right shrink-0">
            {data.last_close != null && (
              <p className="text-3xl font-black tabular-nums text-gray-900 dark:text-white">
                {fmt(data.last_close)}
              </p>
            )}
            <div className="flex items-center gap-1.5 justify-end mt-0.5 flex-wrap">
              {changeDayPct != null && changeDay != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold tabular-nums ${badgeBg}`}>
                  {isPositive ? '▲' : '▼'} {fmt(Math.abs(changeDay))} ({fmtPct(changeDayPct)}) 1j
                </span>
              )}
              {data.change_pct != null && (
                <span className={`text-xs tabular-nums font-medium ${changeColor}`}>
                  {fmtPct(data.change_pct)} 5j
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Graphique */}
      {chartData.length > 1 && (
        <div className="px-2 pt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grilles horizontales */}
            {yTicks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.l} y1={toY(v).toFixed(1)}
                  x2={W - PAD.r} y2={toY(v).toFixed(1)}
                  stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
                  className="text-gray-500"
                />
                <text
                  x={PAD.l - 4} y={toY(v)}
                  textAnchor="end" dominantBaseline="middle"
                  className="fill-gray-400 dark:fill-gray-500"
                  style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(v)}
                </text>
              </g>
            ))}

            {/* Zone remplie */}
            <polygon points={areaPts} fill={`url(#${fillId})`} />

            {/* Ligne */}
            <polyline
              points={linePts}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Point final */}
            {chartData.length > 0 && (
              <circle
                cx={toX(chartData.length - 1)}
                cy={toY(chartData[chartData.length - 1].close)}
                r="3.5"
                fill={strokeColor}
                stroke="white"
                strokeWidth="1.5"
              />
            )}

            {/* Dates X */}
            {xTicks.map((idx) => (
              <text
                key={idx}
                x={toX(idx)} y={H - 4}
                textAnchor="middle"
                className="fill-gray-400 dark:fill-gray-500"
                style={{ fontSize: 8.5 }}
              >
                {chartData[idx]?.date.slice(5).replace('-', '/')}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* Stats 30 jours */}
      <div className="grid grid-cols-4 gap-0 border-t border-gray-100 dark:border-gray-700 mt-1">
        {[
          { label: 'Plus haut 30j', value: max30 != null ? fmt(max30) : '—' },
          { label: 'Plus bas 30j',  value: min30 != null ? fmt(min30) : '—' },
          { label: 'Vol. moy.',     value: vol30 != null && vol30 > 0 ? vol30.toLocaleString('fr-FR') : '—' },
          { label: 'Perf. 30j',     value: chg30 != null ? fmtPct(chg30) : '—', colored: true, val: chg30 },
        ].map(stat => (
          <div key={stat.label} className="px-3 py-3 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0">
            <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-tight mb-0.5">{stat.label}</div>
            <div className={`text-sm font-bold tabular-nums ${stat.colored
              ? (stat.val ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              : 'text-gray-900 dark:text-white'}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Dernière cotation + avertissement */}
      <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          {last?.date ? `Clôture du ${new Date(last.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
          {' · '}Délai ≈ 15 min
        </p>
        {data.mock && (
          <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">⚠ Données simulées</span>
        )}
      </div>
    </div>
  )
}

// ─── AcheteurDrillDown ─────────────────────────────────────────────────────────

function AcheteurDrillDown({
  plantation,
  onBack,
  userId,
  isAdmin,
}: {
  plantation: Plantation
  onBack: () => void
  userId: string
  isAdmin?: boolean
}) {
  const [tab, setTab] = useState<AcheteurTab>('apercu')
  const [champs, setChamps] = useState<Champ[]>([])
  const [observations, setObservations] = useState<ObservationMeteo[]>([])
  const [photos, setPhotos] = useState<PhotoTerrain[]>([])
  const [hoveredChampId, setHoveredChampId] = useState<string | null>(null)

  type AnalyseResult = {
    court_terme: string
    moyen_terme: string
    long_terme: string
    risques: string[]
    opportunites: string[]
    recommandations: string[]
    score_qualite: number
  }
  const [analyse, setAnalyse] = useState<AnalyseResult | null>(null)
  const [analyseDate, setAnalyseDate] = useState<string | null>(null)
  const [analyseSavedId, setAnalyseSavedId] = useState<string | null>(null)
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseError, setAnalyseError] = useState('')

  useEffect(() => {
    fetch(`/api/agri/champs?plantation_id=${plantation.id}`)
      .then(r => r.json())
      .then((json) => setChamps((json.champs as Champ[]) ?? []))

    fetch(`/api/agri/observations?plantation_id=${plantation.id}`)
      .then(r => r.json())
      .then((json) => setObservations((json.observations as ObservationMeteo[]) ?? []))

    fetch(`/api/agri/photos?plantation_id=${plantation.id}`)
      .then(r => r.json())
      .then((json) => setPhotos((json.photos as PhotoTerrain[]) ?? []))

    // Charger la dernière analyse sauvegardée
    fetch(`/api/agri/analyses?plantation_id=${plantation.id}`)
      .then(r => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.analyse) {
          setAnalyse(json.analyse as AnalyseResult)
          setAnalyseDate(json.created_at ?? null)
          setAnalyseSavedId(json.id ?? null)
        }
      })
      .catch(() => {/* silencieux */})
  }, [plantation.id])

  async function generateAnalyse() {
    setAnalyseLoading(true)
    setAnalyseError('')
    try {
      const produits = Array.from(new Set(champs.map((c) => c.produit_faostat))).join(',')
      const marketRes = await fetch(`/api/agri/marches?produit=${encodeURIComponent(produits || 'cacao')}`)
      const marketData = await marketRes.json()

      const res = await fetch('/api/agri/ia-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantation,
          champs,
          observations: observations.slice(0, 100),
          photos: photos.slice(0, 20),
          marches: marketData,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur analyse')
      setAnalyse(data as AnalyseResult)
      const now = new Date().toISOString()
      setAnalyseDate(now)

      // Sauvegarder dans saved_simulations
      const saveRes = await fetch('/api/agri/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantation_id: plantation.id,
          plantation_nom: plantation.nom,
          analyse: data,
          existing_id: analyseSavedId,
        }),
      })
      if (saveRes.ok) {
        const saved = await saveRes.json()
        setAnalyseSavedId(saved.id ?? null)
      } else {
        console.error('[IA] Sauvegarde échouée:', await saveRes.json().catch(() => ({})))
        setAnalyseError('Analyse générée mais sauvegarde échouée — elle sera perdue à la prochaine visite')
      }
    } catch (e) {
      setAnalyseError(e instanceof Error ? e.message : String(e))
    } finally {
      setAnalyseLoading(false)
    }
  }

  const firstCoords = useMemo(() => {
    const c = champs.find((ch) => ch.coordonnees)
    return c?.coordonnees ?? null
  }, [champs])

  const acheteurTabs = [
    { key: 'apercu' as AcheteurTab, label: 'Aperçu', icon: '📋' },
    { key: 'meteo' as AcheteurTab, label: 'Météo', icon: '🌤️' },
    { key: 'photos' as AcheteurTab, label: 'Observations', icon: '📷' },
    { key: 'analyse' as AcheteurTab, label: 'Analyse IA', icon: '🤖' },
    { key: 'crm' as AcheteurTab, label: 'CRM', icon: '🤝' },
  ]

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        ← Retour
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="text-3xl">🌿</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plantation.nom}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {plantation.pays_nom} {plantation.region ? `· ${plantation.region}` : ''}
            {plantation.superficie_totale_ha ? ` · ${plantation.superficie_totale_ha} ha` : ''}
          </p>
        </div>
      </div>

      <TabBar tabs={acheteurTabs} active={tab} onChange={setTab} />

      {tab === 'apercu' && (
        <div className="space-y-6">
          <div className={`${cardClass('p-5')} grid grid-cols-2 sm:grid-cols-4 gap-4`}>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pays</div>
              <div className="font-semibold text-gray-900 dark:text-white mt-1">{plantation.pays_nom}</div>
            </div>
            {plantation.region && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Région</div>
                <div className="font-semibold text-gray-900 dark:text-white mt-1">{plantation.region}</div>
              </div>
            )}
            {plantation.ville && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ville</div>
                <div className="font-semibold text-gray-900 dark:text-white mt-1">{plantation.ville}</div>
              </div>
            )}
            {plantation.superficie_totale_ha != null && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Superficie</div>
                <div className="font-semibold text-gray-900 dark:text-white mt-1">{plantation.superficie_totale_ha} ha</div>
              </div>
            )}
          </div>

          {/* Carte interactive des champs */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🗺️ Carte des champs</h3>
            <ChampsMap
              champs={champs}
              readOnly
              highlightedChampId={hoveredChampId ?? undefined}
              pulsedPoint={(() => {
                if (!hoveredChampId) return undefined
                const c = champs.find(ch => ch.id === hoveredChampId)
                return c?.coordonnees && typeof c.coordonnees.lat === 'number'
                  ? { lat: c.coordonnees.lat, lon: c.coordonnees.lon }
                  : undefined
              })()}
            />
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Champs ({champs.length})</h3>
            {champs.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun champ enregistré</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {champs.map((c) => (
                  <div
                    key={c.id}
                    className={`${cardClass('p-3')} space-y-1 cursor-pointer transition-all duration-200 ${hoveredChampId === c.id ? 'ring-2 ring-emerald-500 shadow-lg' : 'hover:ring-1 hover:ring-emerald-400'}`}
                    onMouseEnter={() => setHoveredChampId(c.id)}
                    onMouseLeave={() => setHoveredChampId(null)}
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{c.nom}</div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">{c.produit_faostat}</div>
                    {c.superficie_ha != null && <div className="text-xs text-gray-500 dark:text-gray-400">{c.superficie_ha} ha</div>}
                    {c.coordonnees && (
                      <div className="text-xs text-gray-400">📍 {c.coordonnees.lat.toFixed(4)}, {c.coordonnees.lon.toFixed(4)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'meteo' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Observations du planteur</h3>
              <MeteoCalendar
                plantationId={plantation.id}
                champs={champs}
                observations={observations}
                onObsChange={() => {}}
                readOnly
              />
            </div>
            {firstCoords && (
              <div className="lg:w-80 flex-shrink-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Données API</h3>
                <WeatherWidget lat={firstCoords.lat} lon={firstCoords.lon} />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <PhotosTab
          plantationId={plantation.id}
          champs={champs}
          photos={photos}
          onPhotoAdded={() => {}}
          readOnly
        />
      )}

      {tab === 'analyse' && (
        <div className="space-y-6">
          {/* État vide — aucune analyse et pas en chargement */}
          {!analyse && !analyseLoading && (
            <div className={`${cardClass('p-8 text-center')} space-y-4`}>
              <div className="text-4xl">🤖</div>
              <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                Générez une analyse IA basée sur les observations météo des 30 derniers jours, les photos terrain et les cours du marché.
              </p>
              <button className={btnPrimary('mx-auto')} onClick={generateAnalyse} disabled={analyseLoading}>
                ✨ Générer une analyse
              </button>
              {analyseError && <p className="text-sm text-red-500">{analyseError}</p>}
            </div>
          )}

          {/* Indicateur de chargement */}
          {analyseLoading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Analyse IA en cours…</p>
            </div>
          )}

          {/* Résultats */}
          {analyse && !analyseLoading && (
            <div className="space-y-6">
              {/* En-tête : date + score + bouton regénérer */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Analyse IA</h3>
                  {analyseDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Dernière analyse — {new Date(analyseDate).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Score qualité</span>
                    <span className={`text-xl font-bold ${
                      analyse.score_qualite >= 70
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : analyse.score_qualite >= 40
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {analyse.score_qualite}/100
                    </span>
                  </div>
                  <button className={btnSecondary()} onClick={generateAnalyse} disabled={analyseLoading}>
                    🔄 Regénérer
                  </button>
                </div>
              </div>
              {analyseError && <p className="text-sm text-red-500">{analyseError}</p>}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${cardClass('p-4')} space-y-2`}>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Court terme (0–3 mois)</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{analyse.court_terme}</p>
                </div>
                <div className={`${cardClass('p-4')} space-y-2`}>
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Moyen terme (3–12 mois)</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{analyse.moyen_terme}</p>
                </div>
                <div className={`${cardClass('p-4')} space-y-2`}>
                  <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Long terme (12+ mois)</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{analyse.long_terme}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`${cardClass('p-4')} space-y-2`}>
                  <div className="text-sm font-semibold text-red-600 dark:text-red-400">Risques</div>
                  <div className="flex flex-wrap gap-2">
                    {analyse.risques.map((r, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`${cardClass('p-4')} space-y-2`}>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Opportunités</div>
                  <div className="flex flex-wrap gap-2">
                    {analyse.opportunites.map((o, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${cardClass('p-4')} space-y-2`}>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Recommandations</div>
                <ol className="space-y-2">
                  {analyse.recommandations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      {rec}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'crm' && (
        <AgriCRM
          plantationId={plantation.id}
          plantationNom={plantation.nom}
          isAcheteur
          isAdmin={isAdmin}
          currentUserId={userId}
        />
      )}
    </div>
  )
}

// ─── AcheteurView ──────────────────────────────────────────────────────────────

type AcheteurViewTab = 'cafe' | 'cacao' | 'plantations' | 'cours' | 'crm'

function AcheteurView({ isAdmin = false, userId }: { isAdmin?: boolean; userId: string }) {
  const [plantations, setPlantations] = useState<Plantation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Plantation | null>(null)
  const [viewTab, setViewTab] = useState<AcheteurViewTab>('cafe')
  const [showTuto, setShowTuto] = useState(false)
  const [crmUnread, setCrmUnread] = useState(0)

  // ── Données Café ──────────────────────────────────────────────────────────
  const [cafeData, setCafeData] = useState<{
    label: string; unit: string; rows: { year: number; production_t: number }[]
    top_producers: { country: string; share_pct: number }[]; source: string
  } | null>(null)
  const [cafeLoading, setCafeLoading] = useState(false)

  // ── Données Cacao ─────────────────────────────────────────────────────────
  const [cacaoData, setCacaoData] = useState<{
    label: string; unit: string; rows: { year: number; production_t: number }[]
    top_producers: { country: string; share_pct: number }[]; source: string
  } | null>(null)
  const [cacaoLoading, setCacaoLoading] = useState(false)

  // ── Cours de Londres ──────────────────────────────────────────────────────
  const [coursData, setCoursData] = useState<{
    cacao: { name: string; unit: string; prices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]; last_close: number | null; change_pct: number | null; mock: boolean }
    cafe:  { name: string; unit: string; prices: { date: string; open: number; high: number; low: number; close: number; volume: number }[]; last_close: number | null; change_pct: number | null; mock: boolean }
  } | null>(null)
  const [coursLoading, setCoursLoading] = useState(false)
  const [coursError, setCoursError] = useState('')

  async function loadCafe() {
    if (cafeLoading) return
    setCafeLoading(true)
    try {
      const r = await fetch('/api/agri/production?commodity=cafe')
      setCafeData(await r.json())
    } catch { /* silencieux */ } finally { setCafeLoading(false) }
  }

  async function loadCacao() {
    if (cacaoLoading) return
    setCacaoLoading(true)
    try {
      const r = await fetch('/api/agri/production?commodity=cacao')
      setCacaoData(await r.json())
    } catch { /* silencieux */ } finally { setCacaoLoading(false) }
  }

  async function loadCours() {
    setCoursLoading(true)
    setCoursError('')
    try {
      const r = await fetch('/api/agri/cours-london')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setCoursData(await r.json())
    } catch (e) {
      setCoursError(e instanceof Error ? e.message : String(e))
    } finally { setCoursLoading(false) }
  }

  // Chargement plantations
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/agri/plantations')
        if (!res.ok) throw new Error(`API error ${res.status}`)
        const json = await res.json()
        setPlantations((json.plantations as Plantation[]) ?? [])
      } catch {
        setPlantations([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin, userId])

  // Chargement à l'activation des onglets
  useEffect(() => {
    if (viewTab === 'cafe' && !cafeData && !cafeLoading) loadCafe()
    if (viewTab === 'cacao' && !cacaoData && !cacaoLoading) loadCacao()
    if (viewTab === 'cours' && !coursData && !coursLoading) loadCours()
  }, [viewTab]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  // Drill-down plantation : plein écran, pas de tabs
  if (selected) {
    return <AcheteurDrillDown plantation={selected} onBack={() => setSelected(null)} userId={userId} isAdmin={isAdmin} />
  }

  const viewTabs: { key: AcheteurViewTab; label: string; icon: string; badge?: number }[] = [
    { key: 'cafe',        label: 'Café',           icon: '☕' },
    { key: 'cacao',       label: 'Cacao',          icon: '🍫' },
    { key: 'plantations', label: 'Plantations',    icon: '🌿' },
    { key: 'cours',       label: 'Cours Londres',  icon: '📈' },
    { key: 'crm',         label: 'CRM',            icon: '💬', badge: crmUnread },
  ]

  return (
    <div className="space-y-4">
      {showTuto && <TutoModal defaultRole="acheteur" solo onClose={() => setShowTuto(false)} />}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {viewTabs.map(t => (
              <button key={t.key} onClick={() => setViewTab(t.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                  viewTab === t.key
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                <span>{t.icon}</span>{t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className="absolute -top-0.5 right-0 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {t.badge > 9 ? '9+' : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowTuto(true)}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-sm font-bold flex items-center justify-center"
          title="Guide d'utilisation"
        >
          ?
        </button>
      </div>

      {/* ── Onglet Café ───────────────────────────────────────────────────── */}
      {viewTab === 'cafe' && (
        <ProductionTab
          commodity="cafe"
          data={cafeData}
          loading={cafeLoading}
        />
      )}

      {/* ── Onglet Cacao ──────────────────────────────────────────────────── */}
      {viewTab === 'cacao' && (
        <ProductionTab
          commodity="cacao"
          data={cacaoData}
          loading={cacaoLoading}
        />
      )}

      {/* ── Onglet Plantations ────────────────────────────────────────────── */}
      {viewTab === 'plantations' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plantations accessibles</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cliquez sur une plantation pour voir les détails
            </p>
          </div>
          {plantations.length === 0 ? (
            <div className={`${cardClass('p-8 text-center')} space-y-3`}>
              <div className="text-3xl">🔒</div>
              <p className="text-gray-600 dark:text-gray-400">Aucune plantation accessible</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Contactez un planteur pour obtenir un accès à ses données
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plantations.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`${cardClass('p-5 text-left hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all')} space-y-2`}
                >
                  <div className="flex items-start gap-2">
                    <div className="text-2xl">🌿</div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{p.nom}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {p.pays_nom}{p.region ? ` · ${p.region}` : ''}
                      </div>
                    </div>
                  </div>
                  {p.superficie_totale_ha != null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">📐 {p.superficie_totale_ha} ha</div>
                  )}
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Voir les données →</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Cours de Londres ───────────────────────────────────────── */}
      {viewTab === 'cours' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">📈 Cours de Londres</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ICE Futures Europe · Clôture J-1 · Référence Afrique</p>
            </div>
            {/* Bouton Actualiser désactivé — données chargées une fois par session */}
            <button disabled className={btnSecondary('text-xs py-1.5 px-3 opacity-40 cursor-not-allowed')}>
              🔄 Actualiser
            </button>
          </div>
          {coursError && <p className="text-sm text-red-500">{coursError}</p>}
          {coursLoading && !coursData && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}
          {coursData && (
            <>
              {/* Bandeau synthèse */}
              <div className={`${cardClass('px-5 py-3')} flex flex-wrap gap-6`}>
                {[
                  { label: '🍫 Cacao Londres', d: coursData.cacao },
                  { label: '☕ Robusta Londres', d: coursData.cafe },
                ].map(({ label, d }) => {
                  const pos = (d.change_pct ?? 0) >= 0
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="text-xl font-black tabular-nums text-gray-900 dark:text-white">
                        {d.last_close != null ? d.last_close.toLocaleString('fr-FR') : '—'}
                      </span>
                      <span className="text-xs font-medium">{d.unit}</span>
                      {d.change_pct != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded tabular-nums ${pos ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                          {pos ? '▲' : '▼'} {Math.abs(d.change_pct).toFixed(2)}% 5j
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Cartes détaillées */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CoursCard data={coursData.cacao} color="amber" />
                <CoursCard data={coursData.cafe} color="green" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Onglet CRM global ─────────────────────────────────────────────── */}
      {viewTab === 'crm' && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">💬 Mes conversations</h3>
          <MessagesTabAcheteur
            plantationId=""
            currentUserId={userId}
            isAdmin={isAdmin}
            onUnreadChange={setCrmUnread}
          />
        </div>
      )}
    </div>
  )
}

// ─── NoAccessView ──────────────────────────────────────────────────────────────

function NoAccessView() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Accès non autorisé</h2>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Vous n&apos;avez pas encore accès à AgriTracker.
        Contactez un administrateur pour obtenir un rôle (planteur ou acheteur).
      </p>
    </div>
  )
}

// ─── AdminView ─────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string
  email: string
  full_name: string
  role: string
  agri_roles: string[]
  acces_plantation_ids: string[]
}

type AdminPlantation = {
  id: string
  nom: string
  region: string
  pays_nom: string
  superficie_totale_ha: number | null
  user_id: string
}

function AdminView() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [plantations, setPlantations] = useState<AdminPlantation[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  async function reload() {
    setApiError('')
    const res = await fetch('/api/agri/admin')
    const data = await res.json()
    if (!res.ok) {
      setApiError(`Erreur API (${res.status}): ${data.error ?? JSON.stringify(data)}`)
      return
    }
    setUsers(data.users ?? [])
    setPlantations(data.plantations ?? [])
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function toggleRole(userId: string, role: 'planteur' | 'acheteur', hasRole: boolean) {
    const key = `${userId}-${role}`
    setSaving(key)
    await fetch('/api/agri/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: hasRole ? 'revoke-role' : 'assign-role', userId, role }),
    })
    await reload()
    setSaving(null)
  }

  async function toggleAccess(userId: string, plantationId: string, hasAccess: boolean) {
    const key = `${userId}-${plantationId}`
    setSaving(key)
    await fetch('/api/agri/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: hasAccess ? 'revoke-access' : 'grant-access', userId, plantationId }),
    })
    await reload()
    setSaving(null)
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>

  if (apiError) return (
    <div className={`${cardClass('p-6')} text-red-600 dark:text-red-400 space-y-2`}>
      <div className="font-semibold">Erreur de chargement</div>
      <div className="text-sm font-mono">{apiError}</div>
      <button className={btnSecondary('mt-2')} onClick={() => { setLoading(true); reload().finally(() => setLoading(false)) }}>
        Réessayer
      </button>
    </div>
  )

  const nonAdmins = users.filter(u => u.role !== 'admin')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gestion des rôles AgriTracker</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Assignez les rôles <strong>planteur</strong> et/ou <strong>acheteur</strong> aux utilisateurs.
          Les acheteurs ont un accès en lecture seule aux plantations sélectionnées.
        </p>
      </div>

      <div className="space-y-3">
        {nonAdmins.length === 0 && (
          <div className={`${cardClass('p-6 text-center')} text-gray-400`}>Aucun utilisateur non-admin</div>
        )}
        {nonAdmins.map(u => {
          const isExpanded = expandedUser === u.id
          const isAcheteur = u.agri_roles.includes('acheteur')
          const isPlanteur = u.agri_roles.includes('planteur')

          return (
            <div key={u.id} className={cardClass('overflow-hidden')}>
              {/* Header row */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {u.full_name || u.email}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                </div>

                {/* Role toggles */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Planteur */}
                  <button
                    onClick={() => toggleRole(u.id, 'planteur', isPlanteur)}
                    disabled={saving === `${u.id}-planteur`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      isPlanteur
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    {saving === `${u.id}-planteur` ? <Spinner size="sm" /> : <span>{isPlanteur ? '✓' : '+'}</span>}
                    👨‍🌾 Planteur
                  </button>

                  {/* Acheteur */}
                  <button
                    onClick={() => toggleRole(u.id, 'acheteur', isAcheteur)}
                    disabled={saving === `${u.id}-acheteur`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      isAcheteur
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {saving === `${u.id}-acheteur` ? <Spinner size="sm" /> : <span>{isAcheteur ? '✓' : '+'}</span>}
                    🏪 Acheteur
                  </button>

                  {/* Expand accès plantations (only if acheteur) */}
                  {isAcheteur && (
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="Gérer les accès aux plantations"
                    >
                      {isExpanded ? '▲' : '▼'} Accès ({u.acces_plantation_ids.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Plantation access panel */}
              {isExpanded && isAcheteur && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Plantations accessibles
                  </div>
                  {plantations.length === 0 && (
                    <p className="text-sm text-gray-400">Aucune plantation enregistrée</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plantations.map(p => {
                      const hasAccess = u.acces_plantation_ids.includes(p.id)
                      const key = `${u.id}-${p.id}`
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleAccess(u.id, p.id, hasAccess)}
                          disabled={saving === key}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-left text-xs border transition-colors disabled:opacity-50 ${
                            hasAccess
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                          }`}
                        >
                          {saving === key ? (
                            <Spinner size="sm" />
                          ) : (
                            <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                              hasAccess ? 'bg-blue-500 text-white' : 'border border-gray-300 dark:border-gray-600'
                            }`}>
                              {hasAccess ? '✓' : ''}
                            </span>
                          )}
                          <div>
                            <div className="font-medium">{p.nom}</div>
                            <div className="text-gray-400 dark:text-gray-500">{p.pays_nom}{p.region ? ` · ${p.region}` : ''}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={`${cardClass('p-4')} text-xs text-gray-500 dark:text-gray-400 space-y-1`}>
        <div>👨‍🌾 <strong>Planteur</strong> — peut gérer sa plantation, ses champs, la météo et les photos (accès complet en écriture)</div>
        <div>🏪 <strong>Acheteur</strong> — accès en lecture seule aux plantations sélectionnées + analyse IA</div>
        <div>🔒 <strong>Sans rôle</strong> — ne peut pas accéder à AgriTracker</div>
      </div>
    </div>
  )
}

// ─── AdminPlanteurWrapper ─────────────────────────────────────────────────────
// Sélecteur de plantation pour l'admin : permet de choisir n'importe quelle
// plantation à gérer (pas seulement celle appartenant à l'admin).

function AdminPlanteurWrapper() {
  const [allPlantations, setAllPlantations] = useState<Plantation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Plantation | null>(null)

  useEffect(() => {
    fetch('/api/agri/plantations')
      .then(r => r.json())
      .then(data => { setAllPlantations(data.plantations ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  // Si une plantation est sélectionnée → PlanteurView avec bouton retour
  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className={btnSecondary('flex items-center gap-2 text-sm')}
        >
          ← Changer de plantation
        </button>
        <PlanteurView
          plantations={[selected]}
          onPlantationsChange={arr => {
            if (arr.length > 0) setSelected(arr[0])
            else setSelected(null)
          }}
        />
      </div>
    )
  }

  // Sélecteur de plantation
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gérer une plantation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sélectionnez une plantation existante ou créez-en une nouvelle
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allPlantations.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className={`${cardClass('p-5 text-left hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all')} space-y-2`}
          >
            <div className="flex items-start gap-2">
              <div className="text-2xl">🌿</div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{p.nom}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {p.pays_nom}{p.region ? ` · ${p.region}` : ''}
                </div>
              </div>
            </div>
            {p.superficie_totale_ha != null && (
              <div className="text-xs text-gray-500 dark:text-gray-400">📐 {p.superficie_totale_ha} ha</div>
            )}
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Modifier →
            </div>
          </button>
        ))}

        {/* Créer une nouvelle plantation */}
        <button
          onClick={() => setSelected({ id: '', nom: '', pays_code: 'CI', pays_nom: "Côte d'Ivoire", user_id: '', created_at: '', updated_at: '' } as unknown as Plantation)}
          className={`${cardClass('p-5 text-left hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all border-dashed')} space-y-2`}
        >
          <div className="flex items-start gap-2">
            <div className="text-2xl">➕</div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Nouvelle plantation</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Créer une plantation</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Main AgriTracker ─────────────────────────────────────────────────────────

type AgriStatus = 'loading' | 'no-access' | 'planteur' | 'acheteur' | 'both' | 'admin'
type AdminTab = 'planteur' | 'acheteur' | 'admin'

export function AgriTracker() {
  const { profile: user, isAdmin, loading } = useAuth()
  const authLoading = loading
  const supabase = createClient()
  const [status, setStatus] = useState<AgriStatus>('loading')
  const [plantations, setPlantations] = useState<Plantation[]>([])
  const [adminTab, setAdminTab] = useState<AdminTab>('admin')

  useEffect(() => {
    if (authLoading) return // Attendre que l'auth context soit prêt
    if (!user) { setStatus('no-access'); return }

    async function init() {
      try {
        if (isAdmin) {
          setStatus('admin')
          return
        }

        const { data: rolesData } = await supabase
          .from('agri_user_roles').select('role').eq('user_id', user!.id)

        const hasPlanteur = rolesData?.some((r: { role: string }) => r.role === 'planteur') ?? false
        const hasAcheteur = rolesData?.some((r: { role: string }) => r.role === 'acheteur') ?? false

        if (hasPlanteur) {
          const { data: plantData } = await supabase
            .from('plantations').select('*').eq('user_id', user!.id).order('nom')
          if (plantData) setPlantations(plantData as Plantation[])
        }

        if (hasPlanteur && hasAcheteur) setStatus('both')
        else if (hasPlanteur) setStatus('planteur')
        else if (hasAcheteur) setStatus('acheteur')
        else setStatus('no-access')
      } catch {
        setStatus('no-access')
      }
    }
    init()
  }, [authLoading, user, isAdmin, supabase])

  if (status === 'loading') {
    return <div className="flex justify-center items-center py-20"><Spinner size="lg" /></div>
  }

  if (status === 'no-access') return <NoAccessView />

  if (status === 'planteur') {
    return <PlanteurView plantations={plantations} onPlantationsChange={setPlantations} />
  }

  if (status === 'acheteur') {
    return <AcheteurView userId={user!.id} />
  }

  // 'both' ou 'admin' — tab switcher
  const tabs =
    status === 'admin'
      ? [
          { key: 'admin' as AdminTab, label: 'Administration', icon: '⚙️' },
          { key: 'acheteur' as AdminTab, label: 'Vue acheteur', icon: '🏪' },
          { key: 'planteur' as AdminTab, label: 'Vue planteur', icon: '👨‍🌾' },
        ]
      : [
          { key: 'planteur' as AdminTab, label: 'Ma plantation', icon: '👨‍🌾' },
          { key: 'acheteur' as AdminTab, label: 'Acheteur', icon: '🏪' },
        ]

  return (
    <div className="space-y-6">
      <TabBar tabs={tabs} active={adminTab} onChange={setAdminTab} />
      {adminTab === 'planteur' && <AdminPlanteurWrapper />}
      {adminTab === 'acheteur' && <AcheteurView isAdmin={status === 'admin'} userId={user!.id} />}
      {adminTab === 'admin' && <AdminView />}
    </div>
  )
}
