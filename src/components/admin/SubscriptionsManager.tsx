'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { Profile, App, AppSubscription, SubscriptionPlan, SubscriptionStatus } from '@/types'

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
  perpetual: 'Perpétuel',
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  expired: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

interface SubRow extends AppSubscription {
  profile?: Pick<Profile, 'email' | 'full_name'>
  app?: Pick<App, 'name' | 'slug' | 'icon'>
}

export default function SubscriptionsManager() {
  const [subs, setSubs] = useState<SubRow[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<{
    user_id: string; app_id: string; plan: SubscriptionPlan
    price_paid: string; expires_at: string; notes: string
  }>>({ plan: 'monthly' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: subsRaw }, { data: appsRaw }, { data: usersRaw }] = await Promise.all([
      supabase.from('app_subscriptions')
        .select('*, profile:profiles(email, full_name), app:apps(name, slug, icon)')
        .order('created_at', { ascending: false }),
      supabase.from('apps').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').order('email'),
    ])
    setSubs((subsRaw ?? []) as SubRow[])
    setApps((appsRaw ?? []) as App[])
    setUsers((usersRaw ?? []) as Profile[])
    setLoading(false)
  }

  async function addSubscription() {
    if (!form.user_id || !form.app_id || !form.plan) return
    setSaving(true)

    const expiresAt = form.plan === 'perpetual' ? null
      : form.expires_at ? new Date(form.expires_at).toISOString()
      : form.plan === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('app_subscriptions').insert({
      user_id: form.user_id,
      app_id: form.app_id,
      plan: form.plan,
      status: 'active',
      price_paid: form.price_paid ? parseFloat(form.price_paid) : null,
      expires_at: expiresAt,
      notes: form.notes ?? null,
    })

    setSaving(false)
    setShowModal(false)
    setForm({ plan: 'monthly' })
    load()
  }

  async function cancelSub(id: string) {
    if (!confirm('Annuler cet abonnement ?')) return
    await supabase.from('app_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  async function reactivateSub(id: string) {
    await supabase.from('app_subscriptions')
      .update({ status: 'active', cancelled_at: null })
      .eq('id', id)
    load()
  }

  const filtered = subs.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false
    const q = search.toLowerCase()
    return !q
      || (s.profile?.email ?? '').toLowerCase().includes(q)
      || (s.profile?.full_name ?? '').toLowerCase().includes(q)
      || (s.app?.name ?? '').toLowerCase().includes(q)
  })

  const paidApps = apps.filter(a => a.pricing_type !== 'free')

  if (loading) return <div className="text-gray-400 text-sm">Chargement…</div>

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input type="text" placeholder="Rechercher…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:bg-slate-700 dark:text-slate-100" />
          <Icon name="user" size={14} className="absolute left-3 top-2.5 text-gray-400" />
        </div>

        <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-sm">
          {(['all', 'active', 'cancelled', 'expired'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={clsx('px-3 py-2 transition-colors',
                filterStatus === s ? 'bg-gray-900 dark:bg-slate-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400')}>
              {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : s === 'cancelled' ? 'Annulés' : 'Expirés'}
            </button>
          ))}
        </div>

        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gray-900 dark:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 ml-auto">
          <Icon name="plus" size={14} /> Nouvel abonnement
        </button>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Actifs', count: subs.filter(s => s.status === 'active').length, color: 'text-green-600' },
          { label: 'Annulés', count: subs.filter(s => s.status === 'cancelled').length, color: 'text-gray-500' },
          { label: 'Expirés', count: subs.filter(s => s.status === 'expired').length, color: 'text-red-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-center">
            <p className={clsx('text-2xl font-bold', color)}>{count}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Utilisateur</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Application</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Expiration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Prix</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100 text-xs">{sub.profile?.full_name ?? '—'}</p>
                      <p className="text-gray-400 dark:text-slate-500 text-[11px]">{sub.profile?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name={sub.app?.icon ?? 'app'} size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-slate-100 text-xs">{sub.app?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon name={sub.plan === 'perpetual' ? 'infinity' : sub.plan === 'annual' ? 'calendarDays' : 'clock'} size={13} className="text-gray-400" />
                      <span className="text-xs text-gray-700 dark:text-slate-300">{PLAN_LABELS[sub.plan]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[sub.status])}>
                      {sub.status === 'active' ? 'Actif' : sub.status === 'cancelled' ? 'Annulé' : 'Expiré'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {sub.plan === 'perpetual' ? '∞' : sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300">
                    {sub.price_paid != null ? `${sub.price_paid.toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {sub.status === 'active' ? (
                      <button onClick={() => cancelSub(sub.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                        Annuler
                      </button>
                    ) : (
                      <button onClick={() => reactivateSub(sub.id)}
                        className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20">
                        Réactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun abonnement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nouvel abonnement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Nouvel abonnement</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                <Icon name="x" size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Utilisateur *</label>
                <select value={form.user_id ?? ''} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner un utilisateur</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.email} ({u.email})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Application *</label>
                <select value={form.app_id ?? ''} onChange={e => setForm(f => ({ ...f, app_id: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner une application</option>
                  {paidApps.map(a => <option key={a.id} value={a.id}>{a.name} ({a.pricing_type})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Plan *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['monthly', 'annual', 'perpetual'] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                      className={clsx('py-2 rounded-lg text-xs font-medium border transition-colors',
                        form.plan === p ? 'bg-gray-900 dark:bg-slate-600 text-white border-gray-900' : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700')}>
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Prix payé (€)</label>
                  <input type="number" step="0.01" value={form.price_paid ?? ''} onChange={e => setForm(f => ({ ...f, price_paid: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                {form.plan !== 'perpetual' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Expire le</label>
                    <input type="date" value={form.expires_at ?? ''} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Notes</label>
                <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Informations complémentaires…"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                Annuler
              </button>
              <button onClick={addSubscription} disabled={saving || !form.user_id || !form.app_id}
                className="flex-1 px-3 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Enregistrement…' : "Créer l'abonnement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
