'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAllApps } from '@/hooks/useApps'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { AppCategory, App, PricingType } from '@/types'

export default function CategoriesManager() {
  const { categories, apps, loading, reload } = useAllApps()
  const [editCat, setEditCat] = useState<Partial<AppCategory> | null>(null)
  const [editApp, setEditApp] = useState<Partial<App> | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'categories' | 'apps'>('categories')

  const supabase = createClient()

  // ── Catégories ──────────────────────────────────────────────

  async function saveCat() {
    if (!editCat?.name || !editCat?.slug) return
    setSaving(true)
    if (editCat.id) {
      await supabase.from('app_categories').update({
        name: editCat.name, slug: editCat.slug, description: editCat.description,
        icon: editCat.icon ?? 'grid', order_index: editCat.order_index ?? 0,
        is_admin_only: editCat.is_admin_only ?? false, is_active: editCat.is_active ?? true,
      }).eq('id', editCat.id)
    } else {
      await supabase.from('app_categories').insert({
        name: editCat.name, slug: editCat.slug, description: editCat.description ?? null,
        icon: editCat.icon ?? 'grid', order_index: editCat.order_index ?? categories.length,
        is_admin_only: editCat.is_admin_only ?? false, is_active: true,
      })
    }
    setEditCat(null); setSaving(false); reload()
  }

  async function deleteCat(id: string) {
    if (!confirm('Supprimer cette catégorie ?')) return
    await supabase.from('app_categories').delete().eq('id', id)
    reload()
  }

  async function moveCat(id: string, dir: 'up' | 'down') {
    const idx = categories.findIndex(c => c.id === id)
    const target = dir === 'up' ? categories[idx - 1] : categories[idx + 1]
    if (!target) return
    await supabase.from('app_categories').update({ order_index: target.order_index }).eq('id', id)
    await supabase.from('app_categories').update({ order_index: categories[idx].order_index }).eq('id', target.id)
    reload()
  }

  // ── Apps ────────────────────────────────────────────────────

  async function saveApp() {
    if (!editApp?.name || !editApp?.slug || !editApp?.route) return
    setSaving(true)
    const pricingFields = {
      pricing_type: editApp.pricing_type ?? 'free',
      price_monthly: editApp.price_monthly ?? null,
      price_annual: editApp.price_annual ?? null,
      annual_discount_pct: editApp.annual_discount_pct ?? 0,
      price_perpetual: editApp.price_perpetual ?? null,
    }
    if (editApp.id) {
      await supabase.from('apps').update({
        name: editApp.name, slug: editApp.slug, description: editApp.description,
        icon: editApp.icon ?? 'app', route: editApp.route,
        category_id: editApp.category_id ?? null, order_index: editApp.order_index ?? 0,
        is_admin_only: editApp.is_admin_only ?? false, is_active: editApp.is_active ?? true,
        ...pricingFields,
      }).eq('id', editApp.id)
    } else {
      await supabase.from('apps').insert({
        name: editApp.name, slug: editApp.slug, description: editApp.description ?? null,
        icon: editApp.icon ?? 'app', route: editApp.route,
        category_id: editApp.category_id ?? null, order_index: editApp.order_index ?? apps.length,
        is_admin_only: editApp.is_admin_only ?? false, is_active: true,
        ...pricingFields,
      })
    }
    setEditApp(null); setSaving(false); reload()
  }

  async function deleteApp(id: string) {
    if (!confirm('Supprimer cette application ?')) return
    await supabase.from('apps').delete().eq('id', id)
    reload()
  }

  async function moveApp(id: string, dir: 'up' | 'down') {
    const catApps = apps.filter(a => a.category_id === apps.find(x => x.id === id)?.category_id)
    const idx = catApps.findIndex(a => a.id === id)
    const target = dir === 'up' ? catApps[idx - 1] : catApps[idx + 1]
    if (!target) return
    await supabase.from('apps').update({ order_index: target.order_index }).eq('id', id)
    await supabase.from('apps').update({ order_index: catApps[idx].order_index }).eq('id', target.id)
    reload()
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['categories', 'apps'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-gray-900 dark:border-slate-300 text-gray-900 dark:text-slate-100'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200')}>
            {t === 'categories' ? 'Catégories' : 'Applications'}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Catégories</h2>
            <button onClick={() => setEditCat({ is_admin_only: false, is_active: true, icon: 'grid', order_index: categories.length })}
              className="flex items-center gap-2 bg-gray-900 dark:bg-slate-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-slate-500">
              <Icon name="plus" size={14} /> Nouvelle catégorie
            </button>
          </div>

          <div className="rounded-xl border divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {categories.map((cat, i) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                <Icon name={cat.icon} size={18} style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{cat.name}</span>
                    {cat.is_admin_only && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                    {!cat.is_active && <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded">Inactif</span>}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.slug} · {(cat.apps ?? []).length} app(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <button disabled={i === 0} onClick={() => moveCat(cat.id, 'up')} className="p-1 hover:opacity-80 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><Icon name="arrowUp" size={14} /></button>
                  <button disabled={i === categories.length - 1} onClick={() => moveCat(cat.id, 'down')} className="p-1 hover:opacity-80 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><Icon name="arrowDown" size={14} /></button>
                  <button onClick={() => setEditCat(cat)} className="p-1 hover:opacity-80" style={{ color: 'var(--text-muted)' }}><Icon name="pencil" size={14} /></button>
                  <button onClick={() => deleteCat(cat.id)} className="p-1 text-red-400 hover:text-red-600"><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'apps' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Applications</h2>
            <button onClick={() => setEditApp({ is_admin_only: false, is_active: true, icon: 'app', order_index: apps.length })}
              className="flex items-center gap-2 bg-gray-900 dark:bg-slate-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-slate-500">
              <Icon name="plus" size={14} /> Nouvelle application
            </button>
          </div>

          <div className="rounded-xl border divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {apps.map((app) => {
              const catApps = apps.filter(a => a.category_id === app.category_id)
              const idxInCat = catApps.findIndex(a => a.id === app.id)
              return (
                <div key={app.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                  <Icon name={app.icon} size={18} style={{ color: 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{app.name}</span>
                      {app.is_admin_only && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                      {!app.is_active && <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded">Inactif</span>}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{app.route} · {categories.find(c => c.id === app.category_id)?.name ?? 'Sans catégorie'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button disabled={idxInCat === 0} onClick={() => moveApp(app.id, 'up')} className="p-1 hover:opacity-80 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><Icon name="arrowUp" size={14} /></button>
                    <button disabled={idxInCat === catApps.length - 1} onClick={() => moveApp(app.id, 'down')} className="p-1 hover:opacity-80 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><Icon name="arrowDown" size={14} /></button>
                    <button onClick={() => setEditApp(app)} className="p-1 hover:opacity-80" style={{ color: 'var(--text-muted)' }}><Icon name="pencil" size={14} /></button>
                    <button onClick={() => deleteApp(app.id)} className="p-1 text-red-400 hover:text-red-600"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal catégorie */}
      {editCat !== null && (
        <Modal title={editCat.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setEditCat(null)}>
          <div className="space-y-3">
            <Field label="Nom *" value={editCat.name ?? ''} onChange={v => setEditCat(e => ({ ...e!, name: v }))} />
            <Field label="Slug *" value={editCat.slug ?? ''} onChange={v => setEditCat(e => ({ ...e!, slug: v }))} />
            <Field label="Description" value={editCat.description ?? ''} onChange={v => setEditCat(e => ({ ...e!, description: v }))} />
            <Field label="Icône" value={editCat.icon ?? 'grid'} onChange={v => setEditCat(e => ({ ...e!, icon: v }))} />
            <Field label="Ordre" type="number" value={String(editCat.order_index ?? 0)} onChange={v => setEditCat(e => ({ ...e!, order_index: parseInt(v) || 0 }))} />
            <Checkbox label="Réservé aux admins" checked={editCat.is_admin_only ?? false} onChange={v => setEditCat(e => ({ ...e!, is_admin_only: v }))} />
            <Checkbox label="Actif" checked={editCat.is_active ?? true} onChange={v => setEditCat(e => ({ ...e!, is_active: v }))} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <BtnSecondary onClick={() => setEditCat(null)}>Annuler</BtnSecondary>
            <BtnPrimary onClick={saveCat} disabled={saving}>Enregistrer</BtnPrimary>
          </div>
        </Modal>
      )}

      {/* Modal app */}
      {editApp !== null && (
        <Modal title={editApp.id ? "Modifier l'application" : 'Nouvelle application'} onClose={() => setEditApp(null)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Nom *" value={editApp.name ?? ''} onChange={v => setEditApp(e => ({ ...e!, name: v }))} />
            <Field label="Slug *" value={editApp.slug ?? ''} onChange={v => setEditApp(e => ({ ...e!, slug: v }))} />
            <Field label="Route *" value={editApp.route ?? ''} onChange={v => setEditApp(e => ({ ...e!, route: v }))} placeholder="/apps/mon-app" />
            <Field label="Description" value={editApp.description ?? ''} onChange={v => setEditApp(e => ({ ...e!, description: v }))} />
            <Field label="Icône" value={editApp.icon ?? 'app'} onChange={v => setEditApp(e => ({ ...e!, icon: v }))} />
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Catégorie</label>
              <select
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-slate-400"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                value={editApp.category_id ?? ''} onChange={e => setEditApp(a => ({ ...a!, category_id: e.target.value || null }))}>
                <option value="">Sans catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Ordre" type="number" value={String(editApp.order_index ?? 0)} onChange={v => setEditApp(e => ({ ...e!, order_index: parseInt(v) || 0 }))} />
            <Checkbox label="Réservé aux admins" checked={editApp.is_admin_only ?? false} onChange={v => setEditApp(e => ({ ...e!, is_admin_only: v }))} />
            <Checkbox label="Actif" checked={editApp.is_active ?? true} onChange={v => setEditApp(e => ({ ...e!, is_active: v }))} />

            {/* ── Section Tarification ── */}
            <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Tarification</p>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: 'free', l: 'Gratuit' },
                    { v: 'subscription', l: 'Abonnement' },
                    { v: 'perpetual', l: 'Perpétuel' },
                    { v: 'quote', l: 'Sur devis' },
                  ] as { v: PricingType; l: string }[]).map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setEditApp(e => ({ ...e!, pricing_type: v }))}
                      className={clsx('py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-center',
                        (editApp.pricing_type ?? 'free') === v
                          ? 'bg-gray-900 dark:bg-slate-600 text-white border-gray-900 dark:border-slate-600'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700')}
                      style={(editApp.pricing_type ?? 'free') !== v ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : undefined}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {editApp.pricing_type === 'subscription' && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Prix mensuel (€)" type="number" value={String(editApp.price_monthly ?? '')}
                      onChange={v => setEditApp(e => ({ ...e!, price_monthly: v ? parseFloat(v) : null }))} />
                    <Field label="Prix annuel (€)" type="number" value={String(editApp.price_annual ?? '')}
                      onChange={v => setEditApp(e => ({ ...e!, price_annual: v ? parseFloat(v) : null }))} />
                  </div>
                  <Field label="Remise annuelle (%)" type="number" value={String(editApp.annual_discount_pct ?? 0)}
                    onChange={v => setEditApp(e => ({ ...e!, annual_discount_pct: parseInt(v) || 0 }))} />
                  {(editApp.price_monthly ?? 0) > 0 && (editApp.annual_discount_pct ?? 0) > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Prix annuel calculé : {((editApp.price_monthly! * 12) * (1 - (editApp.annual_discount_pct ?? 0) / 100)).toFixed(2)} €/an
                      (au lieu de {(editApp.price_monthly! * 12).toFixed(2)} €)
                    </p>
                  )}
                </div>
              )}

              {editApp.pricing_type === 'perpetual' && (
                <div className="mt-3">
                  <Field label="Prix perpétuel (€)" type="number" value={String(editApp.price_perpetual ?? '')}
                    onChange={v => setEditApp(e => ({ ...e!, price_perpetual: v ? parseFloat(v) : null }))} />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <BtnSecondary onClick={() => setEditApp(null)}>Annuler</BtnSecondary>
            <BtnPrimary onClick={saveApp} disabled={saving}>Enregistrer</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Composants UI locaux ─────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-2xl shadow-xl w-full max-w-md p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700" style={{ color: 'var(--text-muted)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-slate-400"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
    </label>
  )
}

function BtnPrimary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 dark:bg-slate-600 text-white hover:bg-gray-800 dark:hover:bg-slate-500 disabled:opacity-50">
      {children}
    </button>
  )
}

function BtnSecondary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 dark:hover:bg-slate-700"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      {children}
    </button>
  )
}
