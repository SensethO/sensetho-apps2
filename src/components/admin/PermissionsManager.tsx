'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { App, Profile, UserAppPermission } from '@/types'

interface PermRow {
  user: Profile
  permissions: Record<string, boolean> // app_id → can_access
}

export default function PermissionsManager() {
  const [apps, setApps] = useState<App[]>([])
  const [rows, setRows] = useState<PermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Reset password
  const [resetUser, setResetUser] = useState<Profile | null>(null)
  const [tempPwd, setTempPwd] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')

  const supabase = createClient()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [{ data: appsRaw }, { data: profilesRaw }, { data: permsRaw }] = await Promise.all([
      supabase.from('apps').select('*').eq('is_active', true).order('order_index'),
      supabase.from('profiles').select('*').order('email'),
      supabase.from('user_app_permissions').select('*'),
    ])

    const appsData = (appsRaw ?? []) as App[]
    const profiles = (profilesRaw ?? []) as Profile[]
    const perms = (permsRaw ?? []) as UserAppPermission[]

    setApps(appsData)

    const permMap: Record<string, Record<string, boolean>> = {}
    for (const p of perms) {
      if (!permMap[p.user_id]) permMap[p.user_id] = {}
      permMap[p.user_id][p.app_id] = p.can_access
    }

    setRows(profiles.map(u => ({
      user: u,
      permissions: permMap[u.id] ?? {},
    })))

    setLoading(false)
  }

  async function togglePerm(userId: string, appId: string, currentValue: boolean | undefined, isAdminApp: boolean, userIsAdmin: boolean) {
    // Apps admin : droits gérés par le rôle, pas par les permissions
    if (isAdminApp || userIsAdmin) return

    const key = `${userId}-${appId}`
    setSaving(key)

    // undefined = pas de record = accès par défaut (true)
    const newValue = currentValue === undefined ? false : !currentValue

    if (newValue === true && currentValue === false) {
      // Supprimer la restriction → retour au défaut (accès autorisé)
      await supabase.from('user_app_permissions').delete()
        .eq('user_id', userId).eq('app_id', appId)
    } else if (newValue === false) {
      // Bloquer l'accès
      await supabase.from('user_app_permissions').upsert({
        user_id: userId, app_id: appId, can_access: false,
      }, { onConflict: 'user_id,app_id' })
    } else {
      // Autoriser explicitement
      await supabase.from('user_app_permissions').upsert({
        user_id: userId, app_id: appId, can_access: true,
      }, { onConflict: 'user_id,app_id' })
    }

    // Mettre à jour l'état local
    setRows(prev => prev.map(r => {
      if (r.user.id !== userId) return r
      const updated = { ...r.permissions }
      if (newValue === true && currentValue === false) {
        delete updated[appId]
      } else {
        updated[appId] = newValue
      }
      return { ...r, permissions: updated }
    }))

    setSaving(null)
  }

  async function resetPassword() {
    if (!resetUser || !tempPwd) return
    setResetting(true); setResetMsg(''); setResetError('')
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetUser.id, password: tempPwd }),
    })
    setResetting(false)
    if (res.ok) {
      setResetMsg(`Mot de passe temporaire défini pour ${resetUser.email}.`)
      setTempPwd('')
      setTimeout(() => { setResetUser(null); setResetMsg('') }, 2000)
    } else {
      const d = await res.json()
      setResetError(d.error ?? 'Erreur lors de la réinitialisation.')
    }
  }

  const filtered = rows.filter(r =>
    r.user.email.toLowerCase().includes(search.toLowerCase()) ||
    (r.user.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-gray-400 text-sm">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Rechercher un utilisateur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <Icon name="user" size={14} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Rafraîchir">
          <Icon name="settings" size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-56">Utilisateur</th>
                {apps.map(app => (
                  <th key={app.id} className="text-center px-3 py-3 font-medium text-gray-600 min-w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <Icon name={app.icon} size={14} className="text-gray-400" />
                      <span className="text-[11px] leading-tight">{app.name}</span>
                      {app.is_admin_only && <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded">admin</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(row => (
                <tr key={row.user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-600">
                          {(row.user.full_name ?? row.user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-xs truncate">{row.user.full_name ?? '—'}</p>
                        <p className="text-gray-400 text-[11px] truncate">{row.user.email}</p>
                      </div>
                      {row.user.role === 'admin' && (
                        <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Admin</span>
                      )}
                      <button
                        onClick={() => { setResetUser(row.user); setTempPwd(''); setResetMsg(''); setResetError('') }}
                        title="Réinitialiser le mot de passe"
                        className="ml-auto p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <Icon name="key" size={12} />
                      </button>
                    </div>
                  </td>
                  {apps.map(app => {
                    const isAdminApp = app.is_admin_only
                    const userIsAdmin = row.user.role === 'admin'
                    const perm = row.permissions[app.id]
                    // Accès effectif
                    const hasAccess = userIsAdmin ? true : (perm === undefined ? true : perm)
                    const isLocked = isAdminApp || userIsAdmin
                    const key = `${row.user.id}-${app.id}`

                    return (
                      <td key={app.id} className="px-3 py-3 text-center">
                        <button
                          disabled={isLocked || saving === key}
                          onClick={() => togglePerm(row.user.id, app.id, perm, isAdminApp, userIsAdmin)}
                          title={isLocked ? (userIsAdmin ? 'Admin : accès total' : 'Contrôlé par le rôle') : (hasAccess ? 'Cliquer pour bloquer' : 'Cliquer pour autoriser')}
                          className={clsx(
                            'w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors',
                            saving === key ? 'opacity-50' : '',
                            isLocked ? 'cursor-default' : 'cursor-pointer hover:scale-110',
                            hasAccess
                              ? isLocked ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-red-100 text-red-500 hover:bg-red-200'
                          )}
                        >
                          <Icon name={hasAccess ? 'check' : 'x'} size={12} />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={apps.length + 1} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun utilisateur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        🟡 Amber = accès lié au rôle admin · 🟢 Vert = accès autorisé · 🔴 Rouge = accès bloqué · 🔑 = Réinitialiser le MDP
      </p>

      {/* Modal reset MDP */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResetUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="key" size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Mot de passe temporaire</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Définir un mot de passe temporaire pour <strong>{resetUser.email}</strong>.
              L&apos;utilisateur devra le changer à sa prochaine connexion.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={tempPwd}
                onChange={e => setTempPwd(e.target.value)}
                placeholder="Mot de passe temporaire (8 car. min.)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {resetError && <p className="text-sm text-red-600">{resetError}</p>}
              {resetMsg && <p className="text-sm text-green-600">{resetMsg}</p>}
              <div className="flex gap-2">
                <button onClick={() => setResetUser(null)}
                  className="flex-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={resetPassword} disabled={resetting || tempPwd.length < 8}
                  className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {resetting ? 'Envoi…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
