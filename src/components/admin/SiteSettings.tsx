'use client'

import { useEffect, useState } from 'react'

interface Setting {
  key: string
  value: string
  label: string
  description?: string
  category: string
}

type CategoryKey =
  | 'identite'
  | 'contact'
  | 'legal'
  | 'hero'
  | 'features'
  | 'apps_section'
  | 'rse'
  | 'cta'
  | 'footer'

interface SettingMeta {
  key: string
  label: string
  description?: string
  category: CategoryKey
  multiline?: boolean
}

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'identite', label: 'Identité', emoji: '🏢' },
  { key: 'contact', label: 'Contact', emoji: '📬' },
  { key: 'legal', label: 'Légal', emoji: '⚖️' },
  { key: 'hero', label: "Page d'accueil Hero", emoji: '🚀' },
  { key: 'features', label: 'Avantages', emoji: '✨' },
  { key: 'apps_section', label: 'Section Apps', emoji: '📦' },
  { key: 'rse', label: 'Bloc RSE', emoji: '🌿' },
  { key: 'cta', label: 'CTA', emoji: '🎯' },
  { key: 'footer', label: 'Footer', emoji: '🔻' },
]

const SETTINGS_META: SettingMeta[] = [
  // identite
  { key: 'brand_name', label: 'Nom de marque', description: "Nom affiché dans l'interface et les emails", category: 'identite' },
  { key: 'company_name', label: 'Raison sociale', description: 'Nom légal de la société', category: 'identite' },

  // contact
  { key: 'contact_email', label: 'Email de contact', description: 'Email principal de contact', category: 'contact' },
  { key: 'support_email', label: 'Email support', description: 'Email pour les demandes de support', category: 'contact' },
  { key: 'dpo_email', label: 'Email DPO', description: 'Email du délégué à la protection des données', category: 'contact' },
  { key: 'website_url', label: 'URL du site', description: 'URL publique de la plateforme', category: 'contact' },

  // legal
  { key: 'company_address', label: 'Adresse', description: 'Adresse complète du siège social', category: 'legal', multiline: true },
  { key: 'company_capital', label: 'Capital social', description: 'Montant du capital social', category: 'legal' },
  { key: 'company_rcs', label: 'RCS', description: 'Numéro RCS (Registre du Commerce)', category: 'legal' },
  { key: 'company_siret', label: 'SIRET', description: 'Numéro SIRET (14 chiffres)', category: 'legal' },
  { key: 'company_tva', label: 'N° TVA intracommunautaire', description: 'Numéro de TVA intracommunautaire', category: 'legal' },

  // hero
  { key: 'hero_badge', label: 'Badge hero', description: 'Texte du badge au-dessus du titre', category: 'hero' },
  { key: 'hero_title_1', label: 'Titre ligne 1', description: 'Première ligne du titre principal', category: 'hero' },
  { key: 'hero_title_2', label: 'Titre ligne 2', description: 'Deuxième ligne du titre principal', category: 'hero' },
  { key: 'hero_subtitle', label: 'Sous-titre', description: 'Paragraphe de description sous le titre', category: 'hero', multiline: true },
  { key: 'hero_cta_note', label: 'Note CTA', description: "Note d'information sous le bouton d'action", category: 'hero' },

  // features
  { key: 'feature_1_title', label: 'Avantage 1 — Titre', category: 'features' },
  { key: 'feature_1_desc', label: 'Avantage 1 — Description', category: 'features', multiline: true },
  { key: 'feature_2_title', label: 'Avantage 2 — Titre', category: 'features' },
  { key: 'feature_2_desc', label: 'Avantage 2 — Description', category: 'features', multiline: true },
  { key: 'feature_3_title', label: 'Avantage 3 — Titre', category: 'features' },
  { key: 'feature_3_desc', label: 'Avantage 3 — Description', category: 'features', multiline: true },
  { key: 'feature_4_title', label: 'Avantage 4 — Titre', category: 'features' },
  { key: 'feature_4_desc', label: 'Avantage 4 — Description', category: 'features', multiline: true },

  // apps_section
  { key: 'apps_section_title', label: 'Titre de la section', category: 'apps_section' },
  { key: 'apps_section_subtitle', label: 'Sous-titre de la section', category: 'apps_section', multiline: true },

  // rse
  { key: 'rse_badge', label: 'Badge RSE', description: "Texte du badge d'accroche", category: 'rse' },
  { key: 'rse_title', label: 'Titre RSE', category: 'rse' },
  { key: 'rse_desc', label: 'Description RSE', category: 'rse', multiline: true },
  { key: 'rse_check_1', label: 'Point clé 1', category: 'rse' },
  { key: 'rse_check_2', label: 'Point clé 2', category: 'rse' },
  { key: 'rse_check_3', label: 'Point clé 3', category: 'rse' },
  { key: 'rse_check_4', label: 'Point clé 4', category: 'rse' },

  // cta
  { key: 'cta_title', label: 'Titre CTA', category: 'cta' },
  { key: 'cta_subtitle', label: 'Sous-titre CTA', category: 'cta', multiline: true },

  // footer
  { key: 'footer_tagline', label: 'Tagline footer', description: 'Phrase descriptive affichée dans le footer', category: 'footer' },
]

const SETTINGS_DEFAULTS: Record<string, string> = {
  brand_name: "Sens'ethO Apps",
  company_name: 'SCDB PRO SARL',
  contact_email: 'sylvain.cassaro@sensetho.com',
  support_email: 'sylvain.cassaro@sensetho.com',
  dpo_email: 'sylvain.cassaro@sensetho.com',
  website_url: 'https://apps.sensetho.com',
  company_address: '',
  company_capital: '',
  company_rcs: '',
  company_siret: '',
  company_tva: '',
  hero_badge: "La plateforme RSE des professionnels et cabinets de conseil",
  hero_title_1: 'La plateforme RSE',
  hero_title_2: 'des experts et organisations responsables',
  hero_subtitle:
    "ISO 26000, CSRD/ESRS, VSME, Parties Prenantes — nos outils couvrent l'ensemble des référentiels RSE internationaux, sans complexité ni frais d'infrastructure.",
  hero_cta_note: "Accès sur invitation — géré par votre administrateur",
  feature_1_title: 'Applications RSE complètes',
  feature_1_desc: 'ISO 26000, CSRD, VSME, Parties prenantes — toute la conformité RSE en un seul endroit.',
  feature_2_title: 'Données 100 % sécurisées',
  feature_2_desc: 'Hébergement cloud souverain Europe, RGPD, chiffrement bout-en-bout.',
  feature_3_title: 'Accès par abonnement',
  feature_3_desc: "Mensuel, annuel ou perpétuel — activé par votre administrateur, sans carte bancaire en ligne.",
  feature_4_title: 'Multi-organisations',
  feature_4_desc: "Gérez plusieurs entités, divisions ou clients depuis un seul espace administrateur.",
  apps_section_title: 'Les applications disponibles',
  apps_section_subtitle: "Accédez à des outils spécialisés, regroupés par domaine, activés selon votre abonnement.",
  rse_badge: '🌿 RSE & ISO 26000',
  rse_title: 'Le diagnostic RSE complet',
  rse_desc:
    "Notre application phare vous guide à travers les 7 questions centrales de l'ISO 26000 et les 37 domaines d'action. Exportez vos résultats en PDF ou Excel.",
  rse_check_1: '7 questions centrales ISO 26000',
  rse_check_2: "37 domaines d'action détaillés",
  rse_check_3: 'Export PDF et Excel multi-onglets',
  rse_check_4: 'Partage sécurisé vers SharePoint',
  cta_title: 'Prêt à structurer votre démarche RSE ?',
  cta_subtitle: "Découvrez les applications, demandez un accès et pilotez votre conformité RSE avec Sens'ethO Apps.",
  footer_tagline: 'Votre plateforme RSE & métier pour les PME engagées.',
}

export default function SiteSettings() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('identite')
  const [values, setValues] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/settings')
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const data: Setting[] = await res.json()
        const merged: Record<string, string> = { ...SETTINGS_DEFAULTS }
        for (const s of data) {
          merged[s.key] = s.value
        }
        setValues(merged)
        setOriginal(merged)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
        // Fall back to defaults
        setValues({ ...SETTINGS_DEFAULTS })
        setOriginal({ ...SETTINGS_DEFAULTS })
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const dirtyKeys = Object.keys(values).filter((k) => values[k] !== original[k])

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string> = {}
      for (const k of dirtyKeys) {
        body[k] = values[k]
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      setOriginal({ ...values })
      setSuccessMsg(true)
      setTimeout(() => setSuccessMsg(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const activeMeta = SETTINGS_META.filter((m) => m.category === activeCategory)

  return (
    <div
      className="flex flex-col gap-6"
      style={{ color: 'var(--text)' }}
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Textes du site</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Modifiez les contenus textuels affichés sur la plateforme.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Category tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max pb-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key
            const catDirtyCount = SETTINGS_META.filter(
              (m) => m.category === cat.key && values[m.key] !== original[m.key]
            ).length

            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white dark:bg-gray-700'
                    : 'border-b-2 border-transparent hover:border-b-2 hover:border-gray-400 dark:hover:border-gray-500',
                ].join(' ')}
                style={
                  isActive
                    ? {}
                    : { color: 'var(--text-muted)' }
                }
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {catDirtyCount > 0 && (
                  <span className="ml-1 rounded-full bg-indigo-500 px-1.5 py-0.5 text-xs text-white leading-none">
                    {catDirtyCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Fields panel */}
      <div
        className="rounded-xl border p-6"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg
              className="h-8 w-8 animate-spin text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span className="ml-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              Chargement…
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeMeta.map((meta) => {
              const val = values[meta.key] ?? ''
              const orig = original[meta.key] ?? ''
              const isDirty = val !== orig
              const isEmpty = val.trim() === ''
              const showLegalWarning = activeCategory === 'legal' && isEmpty

              return (
                <div key={meta.key} className="flex flex-col gap-1.5">
                  {/* Label row */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`setting-${meta.key}`}
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {meta.label}
                    </label>
                    {isDirty && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/30">
                        ✏️ Modifié
                      </span>
                    )}
                    {showLegalWarning && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400 border border-orange-500/30">
                        ⚠️ Champ vide
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {meta.description && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {meta.description}
                    </p>
                  )}

                  {/* Input or Textarea */}
                  {meta.multiline ? (
                    <textarea
                      id={`setting-${meta.key}`}
                      rows={3}
                      value={val}
                      onChange={(e) => handleChange(meta.key, e.target.value)}
                      className={[
                        'w-full rounded-lg border px-3 py-2 text-sm transition-colors resize-y',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                        isDirty ? 'border-indigo-500/50' : '',
                      ].join(' ')}
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: isDirty ? undefined : 'var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  ) : (
                    <input
                      id={`setting-${meta.key}`}
                      type="text"
                      value={val}
                      onChange={(e) => handleChange(meta.key, e.target.value)}
                      className={[
                        'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                        isDirty ? 'border-indigo-500/50' : '',
                      ].join(' ')}
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: isDirty ? undefined : 'var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer bar: success message + save button */}
      <div className="flex items-center justify-end gap-4 pt-2">
        {successMsg && (
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-sm font-medium text-emerald-400">
            ✓ Enregistré
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={dirtyKeys.length === 0 || saving || loading}
          className={[
            'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
            dirtyKeys.length === 0 || saving || loading
              ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white',
          ].join(' ')}
        >
          {saving && (
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          {!saving && dirtyKeys.length > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs leading-none">
              {dirtyKeys.length}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
