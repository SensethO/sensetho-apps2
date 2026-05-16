'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from '@/components/ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpConfig {
  id: string
  name: string
  tenant_id: string
  client_id: string
  client_secret: string
  site_host: string
  site_path: string
  drive_id: string | null
  root_folder: string
  is_default: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

interface SpAppRoute {
  id: string
  app_key: string
  folder_name: string
  sp_config_id: string | null
  sp_configs: { id: string; name: string; site_host: string; is_default: boolean } | null
}

interface SpMigration {
  id: string
  name: string
  app_keys: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  total_files: number
  migrated_files: number
  failed_files: number
  error_log: Array<{ app: string; id: string; message: string; ts: string }>
  created_at: string
  updated_at: string
  source: { id: string; name: string } | null
  target: { id: string; name: string } | null
}

interface SpItem {
  id: string
  name: string
  isFolder: boolean
  size?: number
  createdAt: string
  webUrl: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KNOWN_APPS = [
  { key: 'iso26000',          label: 'ISO 26000',             defaultFolder: 'ISO-APP' },
  { key: 'csrd',              label: 'CSRD / ESRS',           defaultFolder: 'ISO-APP' },
  { key: 'gri',               label: 'GRI Reporting',         defaultFolder: 'ISO-APP' },
  { key: 'guided-diagnostic', label: 'Diagnostic Guidé RSE',  defaultFolder: 'GUIDED-DIAG' },
  { key: 'mon-dossier',       label: 'Mon Dossier Client',    defaultFolder: 'Mon-Dossier' },
  { key: 'rapport-integre',   label: 'Rapport Intégré',       defaultFolder: 'ISO-APP' },
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'border rounded-lg px-3 py-2 text-sm w-full'
const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
}
const cardStyle = {
  backgroundColor: 'var(--bg-card)',
  borderColor: 'var(--border)',
}
const labelCls = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--text-muted)' }

function PrimaryBtn({
  children, onClick, disabled, type = 'button', className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

function SecondaryBtn({
  children, onClick, disabled, className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80 disabled:opacity-50 transition-opacity ${className}`}
      style={{ borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--bg-card)' }}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    running: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        style={cardStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
            <Icon name="x" size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Config form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  tenant_id: '',
  client_id: '',
  client_secret: '',
  site_host: '',
  site_path: '',
  root_folder: 'Documents partages',
  is_default: false,
  notes: '',
}

type ConfigForm = typeof EMPTY_FORM

function ConfigFormFields({
  form, onChange, isEdit,
}: {
  form: ConfigForm
  onChange: (patch: Partial<ConfigForm>) => void
  isEdit: boolean
}) {
  return (
    <div className="space-y-3">
      {[
        { field: 'name' as const, label: 'Nom affiché', placeholder: 'Tenant Principal' },
        { field: 'tenant_id' as const, label: 'Tenant ID (Directory ID)', placeholder: 'xxxxxxxx-xxxx-...' },
        { field: 'client_id' as const, label: 'Client ID (App ID)', placeholder: 'xxxxxxxx-xxxx-...' },
        { field: 'site_host' as const, label: 'Site Host', placeholder: 'scdbpro.sharepoint.com' },
        { field: 'site_path' as const, label: 'Site Path', placeholder: 'sites/WebApp-Partage' },
        { field: 'root_folder' as const, label: 'Dossier racine', placeholder: 'Documents partages' },
      ].map(({ field, label, placeholder }) => (
        <div key={field}>
          <label className={labelCls} style={labelStyle}>{label}</label>
          <input
            type="text"
            value={form[field] as string}
            onChange={e => onChange({ [field]: e.target.value })}
            placeholder={placeholder}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      ))}

      <div>
        <label className={labelCls} style={labelStyle}>
          Client Secret{isEdit ? ' (laisser vide = conserver)' : ''}
        </label>
        <input
          type="password"
          value={form.client_secret}
          onChange={e => onChange({ client_secret: e.target.value })}
          placeholder={isEdit ? '••••••••' : 'Entrez le secret'}
          className={inputCls}
          style={inputStyle}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className={labelCls} style={labelStyle}>Notes (optionnel)</label>
        <textarea
          value={form.notes}
          onChange={e => onChange({ notes: e.target.value })}
          rows={2}
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={e => onChange({ is_default: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm" style={{ color: 'var(--text)' }}>Configuration par défaut</span>
      </label>
    </div>
  )
}

// ── Tab 1: Configurations ─────────────────────────────────────────────────────

function ConfigsTab({ configs, onRefresh }: { configs: SpConfig[]; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<SpConfig | null>(null)
  const [form, setForm] = useState<ConfigForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; siteName?: string; driveId?: string; error?: string }>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(cfg: SpConfig) {
    setEditTarget(cfg)
    setForm({
      name: cfg.name,
      tenant_id: cfg.tenant_id,
      client_id: cfg.client_id,
      client_secret: '••••••••',
      site_host: cfg.site_host,
      site_path: cfg.site_path,
      root_folder: cfg.root_folder,
      is_default: cfg.is_default,
      notes: cfg.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...form }
      // If editing and secret unchanged, send the placeholder (API will skip it)
      const method = editTarget ? 'PATCH' : 'POST'
      const url = editTarget
        ? `/api/admin/sp/configs/${editTarget.id}`
        : '/api/admin/sp/configs'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      setShowModal(false)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(id: string) {
    setTesting(id)
    try {
      const res = await fetch(`/api/admin/sp/configs/${id}/test`, { method: 'POST' })
      const j = await res.json() as { ok: boolean; siteName?: string; driveId?: string; error?: string }
      setTestResults(prev => ({ ...prev, [id]: j }))
      if (j.ok) onRefresh()
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, error: String(err) } }))
    } finally {
      setTesting(null)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/sp/configs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json() as { error: string }
      alert(j.error)
      return
    }
    setDeleteConfirm(null)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>
          {configs.length} configuration{configs.length !== 1 ? 's' : ''} SharePoint
        </h3>
        <PrimaryBtn onClick={openAdd}>
          <span className="flex items-center gap-1.5">
            <Icon name="plus" size={14} />
            Ajouter
          </span>
        </PrimaryBtn>
      </div>

      {configs.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucune configuration. Cliquez sur Ajouter pour en créer une.
        </div>
      )}

      <div className="space-y-3">
        {configs.map(cfg => {
          const tr = testResults[cfg.id]
          return (
            <div key={cfg.id} className="rounded-xl border p-4 space-y-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{cfg.name}</span>
                    {cfg.is_default && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        défaut
                      </span>
                    )}
                    {cfg.drive_id ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Icon name="check" size={12} />
                        testé
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>non testé</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {cfg.site_host}/{cfg.site_path}
                  </div>
                  {cfg.drive_id && (
                    <div className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      Drive: {cfg.drive_id}
                    </div>
                  )}
                  {cfg.notes && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{cfg.notes}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SecondaryBtn
                    onClick={() => handleTest(cfg.id)}
                    disabled={testing === cfg.id}
                  >
                    {testing === cfg.id ? 'Test...' : 'Tester'}
                  </SecondaryBtn>
                  <button
                    onClick={() => openEdit(cfg)}
                    className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                    title="Modifier"
                  >
                    <Icon name="pencil" size={15} style={{ color: 'var(--text-muted)' }} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cfg.id)}
                    className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                    title="Supprimer"
                  >
                    <Icon name="trash" size={15} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>

              {/* Test result */}
              {tr && (
                <div className={`rounded-lg px-3 py-2 text-xs ${tr.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                  {tr.ok
                    ? `Connexion OK — Site: ${tr.siteName} — Drive: ${tr.driveId}`
                    : `Erreur: ${tr.error}`}
                </div>
              )}

              {/* Delete confirm */}
              {deleteConfirm === cfg.id && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800 px-3 py-2 text-sm">
                  <p className="text-red-700 dark:text-red-400 mb-2">Supprimer cette configuration ?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(cfg.id)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Confirmer
                    </button>
                    <SecondaryBtn onClick={() => setDeleteConfirm(null)} className="text-xs py-1">
                      Annuler
                    </SecondaryBtn>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Modifier la configuration' : 'Nouvelle configuration'}>
        <ConfigFormFields
          form={form}
          onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
          isEdit={!!editTarget}
        />
        <div className="flex gap-2 mt-4 justify-end">
          <SecondaryBtn onClick={() => setShowModal(false)}>Annuler</SecondaryBtn>
          <PrimaryBtn onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </PrimaryBtn>
        </div>
      </Modal>
    </div>
  )
}

// ── Tab 2: Applications ───────────────────────────────────────────────────────

function RoutesTab({ configs, routes, onRefresh }: {
  configs: SpConfig[]
  routes: SpAppRoute[]
  onRefresh: () => void
}) {
  type RowState = { sp_config_id: string | null; folder_name: string; saving: boolean; saved: boolean }
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  // Initialize row states from loaded routes
  useEffect(() => {
    const init: Record<string, RowState> = {}
    for (const app of KNOWN_APPS) {
      const route = routes.find(r => r.app_key === app.key)
      init[app.key] = {
        sp_config_id: route?.sp_config_id ?? null,
        folder_name: route?.folder_name ?? app.defaultFolder,
        saving: false,
        saved: false,
      }
    }
    setRowStates(init)
  }, [routes])

  function patchRow(key: string, patch: Partial<RowState>) {
    setRowStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function saveRow(appKey: string) {
    const row = rowStates[appKey]
    if (!row) return
    patchRow(appKey, { saving: true, saved: false })
    try {
      const res = await fetch('/api/admin/sp/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: appKey,
          sp_config_id: row.sp_config_id,
          folder_name: row.folder_name,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      patchRow(appKey, { saved: true })
      onRefresh()
      setTimeout(() => patchRow(appKey, { saved: false }), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      patchRow(appKey, { saving: false })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Associez chaque application à une configuration SharePoint et un dossier racine.
      </p>
      {KNOWN_APPS.map(app => {
        const row = rowStates[app.key] ?? { sp_config_id: null, folder_name: app.defaultFolder, saving: false, saved: false }
        return (
          <div key={app.key} className="rounded-xl border p-4" style={cardStyle}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-44 shrink-0">
                <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{app.label}</div>
                <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{app.key}</div>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className={labelCls} style={labelStyle}>Configuration</label>
                <select
                  value={row.sp_config_id ?? ''}
                  onChange={e => patchRow(app.key, { sp_config_id: e.target.value || null })}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">(défaut du tenant)</option>
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' ★' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[140px]">
                <label className={labelCls} style={labelStyle}>Dossier SP</label>
                <input
                  type="text"
                  value={row.folder_name}
                  onChange={e => patchRow(app.key, { folder_name: e.target.value })}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex items-end pb-0.5">
                <PrimaryBtn onClick={() => saveRow(app.key)} disabled={row.saving}>
                  {row.saving ? '...' : row.saved ? '✓ Sauvé' : 'Enregistrer'}
                </PrimaryBtn>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab 3: Explorer ───────────────────────────────────────────────────────────

function ExplorerTab({ configs }: { configs: SpConfig[] }) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>(configs[0]?.id ?? '')
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Racine' },
  ])
  const [items, setItems] = useState<SpItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)

  const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id ?? null

  const load = useCallback(async (configId: string, folderId: string | null) => {
    if (!configId) return
    setLoading(true)
    setError(null)
    try {
      const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''
      const res = await fetch(`/api/admin/sp/configs/${configId}/browse${qs}`)
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      const data = await res.json() as SpItem[]
      setItems(data.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedConfigId) {
      setBreadcrumb([{ id: null, name: 'Racine' }])
      load(selectedConfigId, null)
    }
  }, [selectedConfigId, load])

  function navigate(item: SpItem) {
    if (!item.isFolder) return
    const next = [...breadcrumb, { id: item.id, name: item.name }]
    setBreadcrumb(next)
    load(selectedConfigId, item.id)
  }

  function breadcrumbNav(idx: number) {
    const slice = breadcrumb.slice(0, idx + 1)
    setBreadcrumb(slice)
    load(selectedConfigId, slice[slice.length - 1]?.id ?? null)
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/admin/sp/configs/${selectedConfigId}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: currentFolderId, name: newFolderName.trim() }),
      })
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      setNewFolderName('')
      load(selectedConfigId, currentFolderId)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const testedConfigs = configs.filter(c => c.drive_id)

  if (testedConfigs.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
        Aucune configuration testée. Allez dans l&apos;onglet Configurations et testez une connexion.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Config selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium shrink-0" style={{ color: 'var(--text)' }}>Tenant :</label>
        <select
          value={selectedConfigId}
          onChange={e => setSelectedConfigId(e.target.value)}
          className={`${inputCls} max-w-xs`}
          style={inputStyle}
        >
          {testedConfigs.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap">
        {breadcrumb.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <Icon name="chevronRight" size={12} style={{ color: 'var(--text-muted)' }} />}
            <button
              onClick={() => breadcrumbNav(idx)}
              className="text-sm hover:underline disabled:no-underline disabled:cursor-default"
              style={{ color: idx === breadcrumb.length - 1 ? 'var(--text)' : 'var(--text-muted)' }}
              disabled={idx === breadcrumb.length - 1}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Create folder */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          placeholder="Nouveau dossier..."
          className={`${inputCls} max-w-xs`}
          style={inputStyle}
          onKeyDown={e => e.key === 'Enter' && createFolder()}
        />
        <SecondaryBtn onClick={createFolder} disabled={creating || !newFolderName.trim()}>
          <span className="flex items-center gap-1">
            <Icon name="folderPlus" size={14} />
            {creating ? 'Création...' : 'Créer'}
          </span>
        </SecondaryBtn>
      </div>

      {/* File list */}
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {items.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Dossier vide</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
                  <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Nom</th>
                  <th className="text-right px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Taille</th>
                  <th className="text-right px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Créé le</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className={item.isFolder ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                    onClick={() => item.isFolder && navigate(item)}
                  >
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2" style={{ color: 'var(--text)' }}>
                        <Icon name={item.isFolder ? 'folder' : 'file'} size={15} style={{ color: item.isFolder ? '#f59e0b' : 'var(--text-muted)' }} />
                        {item.isFolder
                          ? <span className="font-medium">{item.name}</span>
                          : (
                            <a href={item.webUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={e => e.stopPropagation()}>
                              {item.name}
                            </a>
                          )
                        }
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.isFolder ? '—' : formatSize(item.size)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Migrations ─────────────────────────────────────────────────────────

function MigrationsTab({ configs }: { configs: SpConfig[] }) {
  const [jobs, setJobs] = useState<SpMigration[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    source_config_id: '',
    target_config_id: '',
    app_keys: [] as string[],
  })
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sp/migrate')
      if (!res.ok) return
      const data = await res.json() as SpMigration[]
      setJobs(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Auto-refresh when running jobs exist
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running')
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, 3000)
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobs, loadJobs])

  function toggleAppKey(key: string) {
    setForm(prev => ({
      ...prev,
      app_keys: prev.app_keys.includes(key)
        ? prev.app_keys.filter(k => k !== key)
        : [...prev.app_keys, key],
    }))
  }

  async function createJob() {
    if (!form.name || !form.source_config_id || !form.target_config_id || !form.app_keys.length) {
      alert('Remplissez tous les champs et sélectionnez au moins une application.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/sp/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      setForm({ name: '', source_config_id: '', target_config_id: '', app_keys: [] })
      loadJobs()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  async function runJob(jobId: string) {
    setRunning(jobId)
    try {
      const res = await fetch(`/api/admin/sp/migrate/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      })
      if (!res.ok) {
        const j = await res.json() as { error: string }
        throw new Error(j.error)
      }
      loadJobs()
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  function toggleErrors(jobId: string) {
    setExpandedErrors(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const testedConfigs = configs.filter(c => c.drive_id)

  return (
    <div className="space-y-6">
      {/* Create job form */}
      <div className="rounded-xl border p-4 space-y-4" style={cardStyle}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Nouvelle migration</h3>

        <div>
          <label className={labelCls} style={labelStyle}>Nom du job</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Migration Tenant A → Tenant B"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={labelStyle}>Source (tenant)</label>
            <select
              value={form.source_config_id}
              onChange={e => setForm(prev => ({ ...prev, source_config_id: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Sélectionner...</option>
              {testedConfigs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Cible (tenant)</label>
            <select
              value={form.target_config_id}
              onChange={e => setForm(prev => ({ ...prev, target_config_id: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Sélectionner...</option>
              {testedConfigs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls} style={labelStyle}>Applications à migrer</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {KNOWN_APPS.map(app => {
              const checked = form.app_keys.includes(app.key)
              return (
                <label key={app.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAppKey(app.key)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{app.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <PrimaryBtn onClick={createJob} disabled={creating}>
            {creating ? 'Création...' : 'Créer le job'}
          </PrimaryBtn>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Historique des migrations</h3>
          <SecondaryBtn onClick={loadJobs}>
            <span className="flex items-center gap-1">
              <Icon name="settings" size={13} />
              Actualiser
            </span>
          </SecondaryBtn>
        </div>

        {loading && (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            Aucune migration pour l&apos;instant.
          </div>
        )}

        {jobs.map(job => {
          const progress = job.total_files > 0
            ? Math.round(((job.migrated_files + job.failed_files) / job.total_files) * 100)
            : 0
          const hasErrors = job.error_log.length > 0
          const errExpanded = expandedErrors.has(job.id)

          return (
            <div key={job.id} className="rounded-xl border p-4 space-y-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{job.name}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {job.source?.name ?? '?'} → {job.target?.name ?? '?'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Apps: {job.app_keys.join(', ')}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(job.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>

                {(job.status === 'pending') && (
                  <PrimaryBtn onClick={() => runJob(job.id)} disabled={running === job.id}>
                    {running === job.id ? 'Lancement...' : 'Lancer'}
                  </PrimaryBtn>
                )}
              </div>

              {/* Progress */}
              {job.total_files > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{job.migrated_files} migrés / {job.failed_files} erreurs / {job.total_files} total</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Errors */}
              {hasErrors && (
                <div>
                  <button
                    onClick={() => toggleErrors(job.id)}
                    className="text-xs flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Icon name={errExpanded ? 'chevronDown' : 'chevronRight'} size={12} />
                    {job.error_log.length} erreur{job.error_log.length > 1 ? 's' : ''}
                  </button>
                  {errExpanded && (
                    <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>App</th>
                            <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>ID</th>
                            <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Erreur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.error_log.map((e, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text)' }}>{e.app}</td>
                              <td className="px-3 py-1.5 font-mono max-w-[120px] truncate" style={{ color: 'var(--text-muted)' }}>{e.id}</td>
                              <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'configs' | 'routes' | 'explorer' | 'migrations'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'configs',    label: 'Configurations' },
  { id: 'routes',     label: 'Applications' },
  { id: 'explorer',   label: 'Explorateur' },
  { id: 'migrations', label: 'Migrations' },
]

export default function SharepointAdmin() {
  const [tab, setTab] = useState<Tab>('configs')
  const [configs, setConfigs] = useState<SpConfig[]>([])
  const [routes, setRoutes] = useState<SpAppRoute[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [cfgRes, rtRes] = await Promise.all([
      fetch('/api/admin/sp/configs'),
      fetch('/api/admin/sp/routes'),
    ])
    if (cfgRes.ok) setConfigs(await cfgRes.json() as SpConfig[])
    if (rtRes.ok) setRoutes(await rtRes.json() as SpAppRoute[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return (
      <div className="text-sm py-12 text-center" style={{ color: 'var(--text-muted)' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent hover:opacity-80'
            }`}
            style={tab !== t.id ? { color: 'var(--text-muted)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'configs' && (
        <ConfigsTab configs={configs} onRefresh={loadAll} />
      )}
      {tab === 'routes' && (
        <RoutesTab configs={configs} routes={routes} onRefresh={loadAll} />
      )}
      {tab === 'explorer' && (
        <ExplorerTab configs={configs} />
      )}
      {tab === 'migrations' && (
        <MigrationsTab configs={configs} />
      )}
    </div>
  )
}
