'use client'

import { useState, useEffect } from 'react'

type AgriRole = 'planteur' | 'acheteur'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  agri_roles: AgriRole[]
  acces_plantation_ids: string[]
}

interface Plantation {
  id: string
  nom: string
  region: string | null
  pays_nom: string | null
  superficie_totale_ha: number | null
  user_id: string
}

export default function AgriRolesManager() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [plantations, setPlantations] = useState<Plantation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'planteur' | 'acheteur' | 'both' | 'none'>('all')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/agri/admin')
      if (res.ok) {
        const json = await res.json()
        setUsers(json.users ?? [])
        setPlantations(json.plantations ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function toggleRole(userId: string, role: AgriRole, hasRole: boolean) {
    const key = `${userId}-${role}`
    setSaving(key)
    try {
      await fetch('/api/agri/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: hasRole ? 'revoke-role' : 'assign-role',
          userId,
          role,
        }),
      })
      await load()
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => {
          if (!prev) return null
          const updated = hasRole
            ? prev.agri_roles.filter(r => r !== role)
            : [...prev.agri_roles, role]
          return { ...prev, agri_roles: updated as AgriRole[] }
        })
      }
    } finally {
      setSaving(null)
    }
  }

  async function toggleAccess(userId: string, plantationId: string, hasAccess: boolean) {
    const key = `${userId}-${plantationId}`
    setSaving(key)
    try {
      await fetch('/api/agri/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: hasAccess ? 'revoke-access' : 'grant-access',
          userId,
          plantationId,
        }),
      })
      await load()
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => {
          if (!prev) return null
          const updated = hasAccess
            ? prev.acces_plantation_ids.filter(id => id !== plantationId)
            : [...prev.acces_plantation_ids, plantationId]
          return { ...prev, acces_plantation_ids: updated }
        })
      }
    } finally {
      setSaving(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || (u.email ?? '').toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)
    const hasP = u.agri_roles.includes('planteur')
    const hasA = u.agri_roles.includes('acheteur')
    const matchFilter =
      filterRole === 'all' ? true :
      filterRole === 'planteur' ? hasP && !hasA :
      filterRole === 'acheteur' ? hasA && !hasP :
      filterRole === 'both' ? hasP && hasA :
      !hasP && !hasA
    return matchSearch && matchFilter
  })

  const planteurPlantations = plantations.filter(p =>
    selectedUser ? p.user_id === selectedUser.id : false
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
      {/* ─── Left: user list ─── */}
      <div className="flex flex-col w-96 shrink-0">
        {/* filters */}
        <div className="space-y-2 mb-3">
          <input
            type="search"
            placeholder="Rechercher un utilisateur…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'none', 'planteur', 'acheteur', 'both'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterRole(f)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterRole === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'none' ? 'Aucun rôle' : f === 'both' ? 'Planteur + Acheteur' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">{filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}</p>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredUsers.map(u => {
            const hasP = u.agri_roles.includes('planteur')
            const hasA = u.agri_roles.includes('acheteur')
            const isSelected = selectedUser?.id === u.id
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(isSelected ? null : u)}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {u.full_name || u.email}
                    </p>
                    {u.full_name && (
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {hasP && <RoleBadge role="planteur" />}
                    {hasA && <RoleBadge role="acheteur" />}
                  </div>
                </div>
                {/* inline role toggles */}
                <div className="flex gap-2 mt-2">
                  <RoleToggle
                    role="planteur"
                    active={hasP}
                    saving={saving === `${u.id}-planteur`}
                    onClick={(e) => { e.stopPropagation(); toggleRole(u.id, 'planteur', hasP) }}
                  />
                  <RoleToggle
                    role="acheteur"
                    active={hasA}
                    saving={saving === `${u.id}-acheteur`}
                    onClick={(e) => { e.stopPropagation(); toggleRole(u.id, 'acheteur', hasA) }}
                  />
                </div>
              </div>
            )
          })}
          {filteredUsers.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Aucun utilisateur trouvé</p>
          )}
        </div>
      </div>

      {/* ─── Right: plantation access panel ─── */}
      <div className="flex-1 min-w-0">
        {!selectedUser ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <span className="text-4xl">🌿</span>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Sélectionnez un utilisateur pour gérer ses accès aux plantations
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {selectedUser.full_name || selectedUser.email}
                  </h2>
                  <p className="text-sm text-gray-400">{selectedUser.email}</p>
                </div>
                <div className="flex gap-1">
                  {selectedUser.agri_roles.includes('planteur') && <RoleBadge role="planteur" />}
                  {selectedUser.agri_roles.includes('acheteur') && <RoleBadge role="acheteur" />}
                  {selectedUser.agri_roles.length === 0 && (
                    <span className="text-xs text-gray-400 italic">Aucun rôle AgriTracker</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Plantations owned by this user (planteur) */}
              {planteurPlantations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Ses plantations (propriétaire)
                  </h3>
                  <div className="space-y-2">
                    {planteurPlantations.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-emerald-600 text-lg">🌿</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.nom}</p>
                          <p className="text-xs text-gray-400">
                            {[p.region, p.pays_nom].filter(Boolean).join(' · ')}
                            {p.superficie_totale_ha ? ` · ${p.superficie_totale_ha} ha` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All plantations for acheteur access */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Accès acheteur aux plantations
                </h3>
                {plantations.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Aucune plantation enregistrée sur la plateforme</p>
                ) : (
                  <div className="space-y-2">
                    {plantations.map(p => {
                      const hasAccess = selectedUser.acces_plantation_ids.includes(p.id)
                      const isOwner = p.user_id === selectedUser.id
                      const key = `${selectedUser.id}-${p.id}`
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            hasAccess
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nom}</p>
                              {isOwner && (
                                <span className="shrink-0 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">
                                  propriétaire
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {[p.region, p.pays_nom].filter(Boolean).join(' · ')}
                              {p.superficie_totale_ha ? ` · ${p.superficie_totale_ha} ha` : ''}
                            </p>
                          </div>
                          {!isOwner && (
                            <button
                              onClick={() => toggleAccess(selectedUser.id, p.id, hasAccess)}
                              disabled={saving === key}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                hasAccess
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {saving === key ? '…' : hasAccess ? '✓ Accès accordé' : '+ Accorder accès'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: AgriRole }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      role === 'planteur'
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    }`}>
      {role === 'planteur' ? '🌿' : '🛒'} {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

function RoleToggle({
  role, active, saving, onClick
}: {
  role: AgriRole
  active: boolean
  saving: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
        active
          ? role === 'planteur'
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : 'bg-blue-600 border-blue-600 text-white'
          : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
      }`}
    >
      {saving ? (
        <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
      ) : (
        <span>{active ? '✓' : '+'}</span>
      )}
      {role === 'planteur' ? '🌿 Planteur' : '🛒 Acheteur'}
    </button>
  )
}
