'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAllApps, broadcastAppsUpdate } from '@/hooks/useApps'
import type { App, AppCategory, PricingType } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type LocalState = {
  is_for_sale: boolean
  pricing_type: PricingType
  price_monthly: number | null
  price_annual: number | null
  annual_discount_pct: number
  price_perpetual: number | null
}

type AppWithSale = App & { is_for_sale?: boolean }

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocal(app: AppWithSale): LocalState {
  return {
    is_for_sale: app.is_for_sale ?? false,
    pricing_type: app.pricing_type,
    price_monthly: app.price_monthly,
    price_annual: app.price_annual,
    annual_discount_pct: app.annual_discount_pct ?? 0,
    price_perpetual: app.price_perpetual,
  }
}

function isDirty(local: LocalState, app: AppWithSale): boolean {
  return (
    local.is_for_sale !== (app.is_for_sale ?? false) ||
    local.pricing_type !== app.pricing_type ||
    local.price_monthly !== app.price_monthly ||
    local.price_annual !== app.price_annual ||
    local.annual_discount_pct !== (app.annual_discount_pct ?? 0) ||
    local.price_perpetual !== app.price_perpetual
  )
}

function parseNum(v: string): number | null {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseNum(e.target.value))}
        className="rounded-lg border px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
  )
}

// ── Pricing type button labels ─────────────────────────────────────────────────

const PRICING_OPTIONS: { value: PricingType; label: string; emoji: string }[] = [
  { value: 'free', label: 'Gratuit', emoji: '🎁' },
  { value: 'subscription', label: 'Abonnement', emoji: '🔄' },
  { value: 'perpetual', label: 'Perpétuel', emoji: '♾️' },
  { value: 'quote', label: 'Sur devis', emoji: '📋' },
]

// ── App Pricing Card ───────────────────────────────────────────────────────────

function AppCard({
  app,
  onSaved,
}: {
  app: AppWithSale
  onSaved: () => void
}) {
  const supabase = createClient()
  const [local, setLocal] = useState<LocalState>(() => toLocal(app))
  const [saving, setSaving] = useState(false)

  // Re-sync when app data changes from parent reload
  useEffect(() => {
    setLocal(toLocal(app))
  }, [app.id, app.is_for_sale, app.pricing_type, app.price_monthly, app.price_annual, app.annual_discount_pct, app.price_perpetual]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = isDirty(local, app)

  function setField<K extends keyof LocalState>(key: K, value: LocalState[K]) {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('apps')
      .update({
        is_for_sale: local.is_for_sale,
        pricing_type: local.pricing_type,
        price_monthly: local.pricing_type === 'subscription' ? local.price_monthly : null,
        price_annual: local.pricing_type === 'subscription' ? local.price_annual : null,
        annual_discount_pct: local.annual_discount_pct,
        price_perpetual: local.pricing_type === 'perpetual' ? local.price_perpetual : null,
      })
      .eq('id', app.id)
    broadcastAppsUpdate()
    setSaving(false)
    onSaved()
  }

  // Calculated annual price from monthly + discount
  const calcAnnual =
    local.price_monthly != null && local.annual_discount_pct > 0
      ? local.price_monthly * 12 * (1 - local.annual_discount_pct / 100)
      : null
  const baseAnnual = local.price_monthly != null ? local.price_monthly * 12 : null

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4 bg-white dark:bg-gray-900 transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl leading-none flex-shrink-0">{app.icon}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {app.name}
            </div>
            <div className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
              {app.slug}
            </div>
          </div>
        </div>
        {app.category && (
          <span
            className="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            {app.category.icon} {app.category.name}
          </span>
        )}
      </div>

      {/* En vente / Hors vente toggle */}
      <button
        type="button"
        onClick={() => setField('is_for_sale', !local.is_for_sale)}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          local.is_for_sale
            ? 'bg-emerald-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        {local.is_for_sale ? '🟢 En vente' : '⚫ Hors vente'}
      </button>

      {/* Pricing section — only when is_for_sale */}
      {local.is_for_sale && (
        <>
          {/* Pricing type selector — 2×2 grid */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Type de tarification
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRICING_OPTIONS.map(opt => {
                const selected = local.pricing_type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('pricing_type', opt.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      selected
                        ? 'bg-gray-900 dark:bg-slate-600 text-white border-transparent'
                        : 'border hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    style={
                      selected
                        ? {}
                        : { borderColor: 'var(--border)', color: 'var(--text)' }
                    }
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subscription fields */}
          {local.pricing_type === 'subscription' && (
            <div className="flex flex-col gap-3">
              <NumInput
                label="Prix mensuel (€)"
                value={local.price_monthly}
                onChange={v => setField('price_monthly', v)}
              />
              <NumInput
                label="Prix annuel (€)"
                value={local.price_annual}
                onChange={v => setField('price_annual', v)}
              />
              <NumInput
                label="Remise annuelle (%)"
                value={local.annual_discount_pct}
                onChange={v => setField('annual_discount_pct', v ?? 0)}
              />
              {calcAnnual != null && baseAnnual != null && (
                <p className="text-xs rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  → Calculé&nbsp;: <strong>{calcAnnual.toFixed(2)} €/an</strong>{' '}
                  <span className="opacity-70">(au lieu de {baseAnnual.toFixed(2)} €)</span>
                </p>
              )}
            </div>
          )}

          {/* Perpetual field */}
          {local.pricing_type === 'perpetual' && (
            <NumInput
              label="Prix perpétuel (€)"
              value={local.price_perpetual}
              onChange={v => setField('price_perpetual', v)}
            />
          )}

          {/* Quote info */}
          {local.pricing_type === 'quote' && (
            <p
              className="text-xs rounded-lg px-3 py-2 border"
              style={{
                color: 'var(--text-muted)',
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              📋 Le client soumettra un formulaire de devis. Aucun prix à configurer.
            </p>
          )}
        </>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            dirty && !saving
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              Enregistrement…
            </>
          ) : (
            '💾 Enregistrer'
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VenteManager() {
  const { categories, apps, loading, reload } = useAllApps()

  // Build a map of category by id for quick lookup
  const categoryMap = useCallback((): Map<string, AppCategory> => {
    const m = new Map<string, AppCategory>()
    categories.forEach(c => m.set(c.id, c))
    return m
  }, [categories])

  // Group apps by category
  type GroupedCategory = {
    category: AppCategory | null
    categoryLabel: string
    apps: AppWithSale[]
  }

  const grouped: GroupedCategory[] = (() => {
    const catMap = categoryMap()
    const groups = new Map<string, GroupedCategory>()

    const uncategorized: GroupedCategory = {
      category: null,
      categoryLabel: 'Sans catégorie',
      apps: [],
    }

    // Add category groups in order
    categories.forEach(cat => {
      groups.set(cat.id, { category: cat, categoryLabel: cat.name, apps: [] })
    })

    // Place apps in groups
    ;(apps as AppWithSale[]).forEach(app => {
      if (app.category_id && groups.has(app.category_id)) {
        const g = groups.get(app.category_id)!
        // Attach category reference for card display
        g.apps.push({ ...app, category: catMap.get(app.category_id) })
      } else {
        uncategorized.apps.push(app)
      }
    })

    const result: GroupedCategory[] = []
    groups.forEach(g => { if (g.apps.length > 0) result.push(g) })
    if (uncategorized.apps.length > 0) result.push(uncategorized)

    return result
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--text-muted)' }}>
        <span className="animate-spin inline-block w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full" />
        Chargement des applications…
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2" style={{ color: 'var(--text-muted)' }}>
        <span className="text-4xl">📦</span>
        <p className="text-sm">Aucune application trouvée.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {grouped.map(group => (
        <section key={group.category?.id ?? '__none__'}>
          {/* Category header */}
          <div className="flex items-center gap-2 mb-4">
            {group.category && (
              <span className="text-xl leading-none">{group.category.icon}</span>
            )}
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {group.categoryLabel}
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              {group.apps.length} app{group.apps.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {group.apps.map(app => (
              <AppCard key={app.id} app={app} onSaved={reload} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
