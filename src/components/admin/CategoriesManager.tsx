'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAllApps } from '@/hooks/useApps'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { AppCategory, App } from '@/types'

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
    if (editApp.id) {
      await supabase.from('apps').update({
        name: editApp.name, slug: editApp.slug, description: editApp.description,
        icon: editApp.icon ?? 'app', route: editApp.route,
        category_id: editApp.category_id ?? null, order_index: editApp.order_index ?? 0,
        is_admin_only: editApp.is_admin_only ?? false, is_active: editApp.is_active ?? true,
      }).eq('id', editApp.id)
    } else {
      await supabase.from('apps').insert({
        name: editApp.name, slug: editApp.slug, description: editApp.description ?? null,
        icon: editApp.icon ?? 'app', route: editApp.route,
        category_id: editApp.category_id ?? null, order_index: editApp.order_index ?? apps.length,
        is_admin_only: editApp.is_admin_only ?? false, is_active: true,
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

  if (loading) return <div className="text-gray-400 text-sm">Chargement…</div>

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['categories', 'apps'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'categories' ? 'Catégories' : 'Applications'}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Catégories</h2>
            <button onClick={() => setEditCat({ is_admin_only: false, is_active: true, icon: 'grid', order_index: categories.length })}
              className="flex items-center gap-2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800">
              <Icon name="plus" size={14} /> Nouvelle catégorie
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {categories.map((cat, i) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                <Icon name={cat.icon} size={18} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{cat.name}</span>
                    {cat.is_admin_only && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                    {!cat.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactif</span>}
                  </div>
                  <p className="text-xs text-gray-400">{cat.slug} · {(cat.apps ?? []).length} app(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <button disabled={i === 0} onClick={() => moveCat(cat.id, 'up')} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><Icon name="arrowUp" size={14} /></button>
                  <button disabled={i === categories.length - 1} onClick={() => moveCat(cat.id, 'down')} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><Icon name="arrowDown" size={14} /></button>
                  <button onClick={() => setEditCat(cat)} className="p-1 text-gray-400 hover:text-gray-700"><Icon name="pencil" size={14} /></button>
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
            <h2 className="font-semibold text-gray-900">Applications</h2>
            <button onClick={() => setEditApp({ is_admin_only: false, is_active: true, icon: 'app', order_index: apps.length })}
              className="flex items-center gap-2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800">
              <Icon name="plus" size={14} /> Nouvelle application
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {apps.map((app, i) => {
              const catApps = apps.filter(a => a.category_id === app.category_id)
              const idxInCat = catApps.findIndex(a => a.id === app.id)
              return (
                <div key={app.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon name={app.icon} size={18} className="text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{app.name}</span>
                      {app.is_admin_only && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                      {!app.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactif</span>}
                    </div>
                    <p className="text-xs text-gray-400">{app.route} · {(app as any).category?.name ?? 'Sans catégorie'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button disabled={idxInCat === 0} onClick={() => moveApp(app.id, 'up')} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><Icon name="arrowUp" size={14} /></button>
                    <button disabled={idxInCat === catApps.length - 1} onClick={() => moveApp(app.id, 'down')} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><Icon name="arrowDown" size={14} /></button>
                    <button onClick={() => setEditApp(app)} className="p-1 text-gray-400 hover:text-gray-700"><Icon name="pencil" size={14} /></button>
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
            <button onClick={() => setEditCat(null)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
            <button onClick={saveCat} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">Enregistrer</button>
          </div>
        </Modal>
      )}

      {/* Modal app */}
      {editApp !== null && (
        <Modal title={editApp.id ? 'Modifier l\'application' : 'Nouvelle application'} onClose={() => setEditApp(null)}>
          <div className="space-y-3">
            <Field label="Nom *" value={editApp.name ?? ''} onChange={v => setEditApp(e => ({ ...e!, name: v }))} />
            <Field label="Slug *" value={editApp.slug ?? ''} onChange={v => setEditApp(e => ({ ...e!, slug: v }))} />
            <Field label="Route *" value={editApp.route ?? ''} onChange={v => setEditApp(e => ({ ...e!, route: v }))} placeholder="/apps/mon-app" />
            <Field label="Description" value={editApp.description ?? ''} onChange={v => setEditApp(e => ({ ...e!, description: v }))} />
            <Field label="Icône" value={editApp.icon ?? 'app'} onChange={v => setEditApp(e => ({ ...e!, icon: v }))} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                value={editApp.category_id ?? ''} onChange={e => setEditApp(a => ({ ...a!, category_id: e.target.value || null }))}>
                <option value="">Sans catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Ordre" type="number" value={String(editApp.order_index ?? 0)} onChange={v => setEditApp(e => ({ ...e!, order_index: parseInt(v) || 0 }))} />
            <Checkbox label="Réservé aux admins" checked={editApp.is_admin_only ?? false} onChange={v => setEditApp(e => ({ ...e!, is_admin_only: v }))} />
            <Checkbox label="Actif" checked={editApp.is_active ?? true} onChange={v => setEditApp(e => ({ ...e!, is_active: v }))} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditApp(null)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
            <button onClick={saveApp} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">Enregistrer</button>
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><Icon name="x" size={16} className="text-gray-500" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
