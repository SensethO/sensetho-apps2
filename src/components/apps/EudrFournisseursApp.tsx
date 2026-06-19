'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Buyer {
  id: string
  name: string | null
  eudr_contact: string | null
  email: string | null
  commodity: string | null
  country_import: string | null
  geojson_status: string | null
  questionnaire_status: string | null
  dds_number: string | null
  notes: string | null
}

interface Certification {
  type: string
  status: string
  valid_until: string
}

interface Supplier {
  id: string
  company: string | null
  priority: string | null
  contact_person: string | null
  email: string | null
  country_origin: string | null
  eudr_risk_level: string | null
  geojson_status: string | null
  farmer_questionnaire_status: string | null
  ddr_status: string | null
  certifications: Certification[] | null
  notes: string | null
}

interface Contract {
  id: string
  contract_number: string | null
  product: string | null
  product_under_eudr: string | null
  supplier: string | null
  delivery_country: string | null
  eudr_applied: string | null
  production_date: string | null
  expected_delivery_date: string | null
  plot_geolocation: string | null
  due_diligence: string | null
  risk_level: string | null
  notes: string | null
}

type TabKey = 'dashboard' | 'buyers' | 'suppliers' | 'contracts'
type Entity = 'buyers' | 'suppliers' | 'contracts'

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'partiel', label: 'Partiel' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'unknown', label: 'À vérifier' },
]
const RISK_OPTS = [
  { value: 'low', label: 'Faible' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'Élevé' },
]
const PRIORITY_OPTS = [
  { value: 'haute', label: 'Haute' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'basse', label: 'Basse' },
]
const CERT_TYPES = ['Halal', 'Kosher', 'Fairtrade', 'Rainforest Alliance', 'GFSI', 'ISO', 'Non-GMO', 'Gluten Free', 'Autre']
const CERT_STATUS = ['valide', 'expiré', 'en cours']

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTS.map(o => [o.value, o.label]))
const RISK_LABEL: Record<string, string> = Object.fromEntries(RISK_OPTS.map(o => [o.value, o.label]))
const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITY_OPTS.map(o => [o.value, o.label]))

// ─── Helpers UI ─────────────────────────────────────────────────────────────

const inputCls = () =>
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none'
const labelCls = () => 'text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block'

function StatusPill({ value }: { value: string | null | undefined }) {
  const v = value ?? 'unknown'
  const map: Record<string, string> = {
    oui: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    non: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    partiel: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    en_cours: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    unknown: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[v] ?? map.unknown}`}>
      {STATUS_LABEL[v] ?? 'À vérifier'}
    </span>
  )
}

function RiskPill({ value }: { value: string | null | undefined }) {
  const v = value ?? 'standard'
  const map: Record<string, string> = {
    low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    standard: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[v] ?? map.standard}`}>
      {RISK_LABEL[v] ?? v}
    </span>
  )
}

function PriorityPill({ value }: { value: string | null | undefined }) {
  const v = value ?? 'moyenne'
  const map: Record<string, string> = {
    haute: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    moyenne: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    basse: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[v] ?? map.moyenne}`}>
      {PRIORITY_LABEL[v] ?? v}
    </span>
  )
}

function StatusSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className={labelCls()}>{label}</label>
      <select className={inputCls()} value={value} onChange={e => onChange(e.target.value)}>
        {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-gray-700 dark:text-gray-300 ${className ?? ''}`}>{children}</td>
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function EudrFournisseursApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null

  const [tab, setTab] = useState<TabKey>('dashboard')
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modale d'édition
  const [editing, setEditing] = useState<{ entity: Entity; data: Record<string, unknown> } | null>(null)
  const [saving, setSaving] = useState(false)
  // Suppression
  const [toDelete, setToDelete] = useState<{ entity: Entity; id: string; label: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  // Partage du dossier
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read' | 'edit' }[]>([])
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // ── Chargement ──────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const [b, s, c] = await Promise.all([
        fetch(`/api/eudr-fournisseurs/buyers?org_id=${orgId}`),
        fetch(`/api/eudr-fournisseurs/suppliers?org_id=${orgId}`),
        fetch(`/api/eudr-fournisseurs/contracts?org_id=${orgId}`),
      ])
      const [bj, sj, cj] = await Promise.all([b.json(), s.json(), c.json()])
      if (!b.ok) throw new Error(bj.error ?? 'Erreur de chargement')
      setBuyers(bj.data ?? [])
      setSuppliers(sj.data ?? [])
      setContracts(cj.data ?? [])
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { reload() }, [reload])

  // ── Export Excel (header action) ─────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!orgId) return
    setExporting(true)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/export-excel?org_id=${orgId}`)
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Erreur export') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'EUDR.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(String((e as Error).message ?? e))
    } finally {
      setExporting(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId) { ctx.setActions(null); return }
    ctx.setActions(
      <div className="flex items-center gap-2">
        {!ctx.isShared && (
          <button
            onClick={() => setShowShare(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          >
            👥 Partager
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
        >
          {exporting ? '…' : '⬇ Export Excel'}
        </button>
      </div>
    )
    return () => ctx.setActions(null)
  }, [orgId, exporting, handleExport, ctx])

  // ── Partage du dossier (rse_diagnostic_shares, diagnostic_id = org_id) ─────
  const loadShares = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/eudr-fournisseurs/shares?org_id=${orgId}`)
      const j = await res.json()
      if (res.ok) setShareList(j.data ?? [])
    } catch { /* ignore */ }
  }, [orgId])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!orgId || !shareEmail.trim()) return
    setShareSaving(true)
    setShareError(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, email: shareEmail.trim(), permission: sharePermission }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setShareEmail('')
      await loadShares()
    } catch (e) {
      setShareError(String((e as Error).message ?? e))
    } finally {
      setShareSaving(false)
    }
  }

  async function handleRemoveShare(shareId: string) {
    if (!orgId) return
    try {
      await fetch(`/api/eudr-fournisseurs/shares?shareId=${shareId}&org_id=${orgId}`, { method: 'DELETE' })
      await loadShares()
    } catch { /* ignore */ }
  }

  // ── Sauvegarde (create/update) ────────────────────────────────────────────
  async function handleSave() {
    if (!editing || !orgId) return
    setSaving(true)
    try {
      const { entity, data } = editing
      const id = data.id as string | undefined
      const url = id
        ? `/api/eudr-fournisseurs/${entity}?id=${id}`
        : `/api/eudr-fournisseurs/${entity}`
      const res = await fetch(url, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, org_id: orgId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setEditing(null)
      await reload()
    } catch (e) {
      alert(String((e as Error).message ?? e))
    } finally {
      setSaving(false)
    }
  }

  // ── Suppression ────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!toDelete) return
    try {
      const res = await fetch(`/api/eudr-fournisseurs/${toDelete.entity}?id=${toDelete.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setToDelete(null)
      await reload()
    } catch (e) {
      alert(String((e as Error).message ?? e))
      setToDelete(null)
    }
  }

  // ── Pas d'organisation ──────────────────────────────────────────────────────
  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400 max-w-md">
          <div className="text-5xl mb-3">🌳</div>
          <p className="text-sm">Sélectionnez une organisation dans la barre latérale pour gérer son suivi EUDR.</p>
        </div>
      </div>
    )
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: '📊 Tableau de bord' },
    { key: 'buyers', label: '🏢 Acheteurs' },
    { key: 'suppliers', label: '🌱 Fournisseurs' },
    { key: 'contracts', label: '📄 Contrats' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌳</span>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Suivi de conformité EUDR</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{ctx.org?.denomination}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'text-green-700 dark:text-green-400 font-semibold border-b-2 border-green-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Chargement…</div>
      ) : (
        <>
          {tab === 'dashboard' && <Dashboard buyers={buyers} suppliers={suppliers} contracts={contracts} />}
          {tab === 'buyers' && (
            <BuyersTab
              buyers={buyers}
              onAdd={() => setEditing({ entity: 'buyers', data: { geojson_status: 'unknown', questionnaire_status: 'unknown' } })}
              onEdit={b => setEditing({ entity: 'buyers', data: { ...b } })}
              onDelete={b => setToDelete({ entity: 'buyers', id: b.id, label: b.name ?? 'cet acheteur' })}
            />
          )}
          {tab === 'suppliers' && (
            <SuppliersTab
              suppliers={suppliers}
              onAdd={() => setEditing({ entity: 'suppliers', data: { priority: 'moyenne', eudr_risk_level: 'standard', geojson_status: 'unknown', farmer_questionnaire_status: 'unknown', ddr_status: 'unknown', certifications: [] } })}
              onEdit={s => setEditing({ entity: 'suppliers', data: { ...s, certifications: s.certifications ?? [] } })}
              onDelete={s => setToDelete({ entity: 'suppliers', id: s.id, label: s.company ?? 'ce fournisseur' })}
            />
          )}
          {tab === 'contracts' && (
            <ContractsTab
              contracts={contracts}
              onAdd={() => setEditing({ entity: 'contracts', data: { product_under_eudr: 'unknown', eudr_applied: 'unknown', plot_geolocation: 'unknown', due_diligence: 'unknown', risk_level: 'standard' } })}
              onEdit={c => setEditing({ entity: 'contracts', data: { ...c } })}
              onDelete={c => setToDelete({ entity: 'contracts', id: c.id, label: c.contract_number ?? 'ce contrat' })}
            />
          )}
        </>
      )}

      {/* Modale d'édition */}
      {editing && (
        <EditModal
          editing={editing}
          setEditing={setEditing}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Modale de partage */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le dossier EUDR</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email de l&apos;utilisateur</label>
                  <ShareAutocomplete value={shareEmail} onChange={setShareEmail} onEnter={handleAddShare} inputClassName={inputCls()} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Niveau d&apos;accès</label>
                  <select value={sharePermission} onChange={e => setSharePermission(e.target.value as 'read' | 'edit')} className={inputCls()}>
                    <option value="read">Lecture seule</option>
                    <option value="edit">Édition</option>
                  </select>
                </div>
                {shareError && <p className="text-xs text-red-500">{shareError}</p>}
                <button onClick={handleAddShare} disabled={shareSaving || !shareEmail.trim()}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">
                  {shareSaving ? 'Partage en cours…' : '+ Partager'}
                </button>
              </div>

              {shareList.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Personnes ayant accès</p>
                  {shareList.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm">
                      <span className="truncate text-gray-700 dark:text-gray-200">{s.email}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          {s.permission === 'edit' ? 'Édition' : 'Lecture'}
                        </span>
                        <button onClick={() => handleRemoveShare(s.id)} title="Retirer l'accès"
                          className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">Le collaborateur doit avoir un compte Sens&apos;ethO. Il retrouvera le dossier en sélectionnant la même organisation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      <ConfirmModal
        open={!!toDelete}
        title="Confirmer la suppression"
        message={toDelete ? `Supprimer définitivement « ${toDelete.label} » ?` : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

// ─── Tableau de bord ──────────────────────────────────────────────────────────

function Dashboard({ buyers, suppliers, contracts }: { buyers: Buyer[]; suppliers: Supplier[]; contracts: Contract[] }) {
  const total = suppliers.length || 1
  const riskCounts = {
    low: suppliers.filter(s => s.eudr_risk_level === 'low').length,
    standard: suppliers.filter(s => (s.eudr_risk_level ?? 'standard') === 'standard').length,
    high: suppliers.filter(s => s.eudr_risk_level === 'high').length,
  }
  const pct = (n: number) => Math.round((n / total) * 100)
  const geoOk = suppliers.filter(s => s.geojson_status === 'oui').length
  const questOk = suppliers.filter(s => s.farmer_questionnaire_status === 'oui').length
  const ddrOk = suppliers.filter(s => s.ddr_status === 'oui').length
  const underEudr = contracts.filter(c => c.product_under_eudr === 'oui').length
  const eudrApplied = contracts.filter(c => c.eudr_applied === 'oui').length

  const atRisk = suppliers.filter(s => s.eudr_risk_level === 'high' || (s.geojson_status !== 'oui' && s.eudr_risk_level !== 'low'))

  const BAR = [
    { key: 'low', label: 'Faible', count: riskCounts.low, color: 'bg-green-500' },
    { key: 'standard', label: 'Standard', count: riskCounts.standard, color: 'bg-orange-500' },
    { key: 'high', label: 'Élevé', count: riskCounts.high, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-5">
      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Acheteurs', value: buyers.length, icon: '🏢' },
          { label: 'Fournisseurs', value: suppliers.length, icon: '🌱' },
          { label: 'Contrats', value: contracts.length, icon: '📄' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Répartition par risque */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Fournisseurs par niveau de risque EUDR</h3>
        {suppliers.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Aucun fournisseur enregistré.</p>
        ) : (
          <div className="space-y-2">
            {BAR.map(b => (
              <div key={b.key} className="flex items-center gap-3">
                <span className="w-16 text-xs text-gray-600 dark:text-gray-400">{b.label}</span>
                <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${pct(b.count)}%` }} />
                </div>
                <span className="w-12 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{b.count} ({pct(b.count)}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Couverture conformité fournisseurs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'GeoJSON « Oui »', value: pct(geoOk), n: geoOk },
          { label: 'Questionnaire « Oui »', value: pct(questOk), n: questOk },
          { label: 'DDR « Oui »', value: pct(ddrOk), n: ddrOk },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{suppliers.length ? c.value : 0}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{c.label}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500">{c.n} / {suppliers.length} fournisseurs</div>
          </div>
        ))}
      </div>

      {/* Contrats EUDR */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{underEudr}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Contrats sous EUDR</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{eudrApplied}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Contrats avec EUDR appliqué</div>
        </div>
      </div>

      {/* Fournisseurs à surveiller */}
      {atRisk.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            ⚠ Fournisseurs à surveiller (risque élevé ou sans géolocalisation)
          </h3>
          <ul className="space-y-1">
            {atRisk.map(s => (
              <li key={s.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium">{s.company ?? '—'}</span>
                <RiskPill value={s.eudr_risk_level} />
                {s.geojson_status !== 'oui' && <span className="text-red-600 dark:text-red-400">GeoJSON manquant</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Acheteurs ─────────────────────────────────────────────────────────

function BuyersTab({ buyers, onAdd, onEdit, onDelete }: {
  buyers: Buyer[]
  onAdd: () => void
  onEdit: (b: Buyer) => void
  onDelete: (b: Buyer) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = buyers.filter(b =>
    !search.trim() ||
    [b.name, b.commodity, b.country_import, b.eudr_contact, b.email, b.dds_number]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className={inputCls()} placeholder="Rechercher un acheteur…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={onAdd} className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">+ Ajouter</button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">Aucun acheteur</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Commodité</th>
                <th className="px-3 py-2 font-medium">Pays import</th>
                <th className="px-3 py-2 font-medium">GeoJSON</th>
                <th className="px-3 py-2 font-medium">Questionnaire</th>
                <th className="px-3 py-2 font-medium">N° DDS</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(b => (
                <tr key={b.id} className="bg-white dark:bg-gray-800">
                  <Td className="font-medium text-gray-900 dark:text-white">{b.name ?? '—'}</Td>
                  <Td>{b.commodity ?? '—'}</Td>
                  <Td>{b.country_import ?? '—'}</Td>
                  <Td><StatusPill value={b.geojson_status} /></Td>
                  <Td><StatusPill value={b.questionnaire_status} /></Td>
                  <Td>{b.dds_number ?? '—'}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => onEdit(b)} className="text-green-600 dark:text-green-400 hover:underline mr-3">Modifier</button>
                    <button onClick={() => onDelete(b)} className="text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Fournisseurs ──────────────────────────────────────────────────────

function SuppliersTab({ suppliers, onAdd, onEdit, onDelete }: {
  suppliers: Supplier[]
  onAdd: () => void
  onEdit: (s: Supplier) => void
  onDelete: (s: Supplier) => void
}) {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [geoFilter, setGeoFilter] = useState('')
  const filtered = suppliers.filter(s => {
    if (riskFilter && (s.eudr_risk_level ?? '') !== riskFilter) return false
    if (geoFilter && (s.geojson_status ?? 'unknown') !== geoFilter) return false
    if (search.trim() && ![s.company, s.country_origin, s.contact_person, s.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls()} flex-1 min-w-[160px]`} placeholder="Rechercher un fournisseur…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={`${inputCls()} w-auto`} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="">Tous risques</option>
          {RISK_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={`${inputCls()} w-auto`} value={geoFilter} onChange={e => setGeoFilter(e.target.value)}>
          <option value="">Tous GeoJSON</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={onAdd} className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">+ Ajouter</button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">Aucun fournisseur</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.company ?? '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.country_origin ?? '—'}{s.contact_person ? ` · ${s.contact_person}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <RiskPill value={s.eudr_risk_level} />
                  <PriorityPill value={s.priority} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">GeoJSON</span><StatusPill value={s.geojson_status} />
                <span className="text-[11px] text-gray-400 dark:text-gray-500">Quest.</span><StatusPill value={s.farmer_questionnaire_status} />
                <span className="text-[11px] text-gray-400 dark:text-gray-500">DDR</span><StatusPill value={s.ddr_status} />
              </div>
              {(s.certifications?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.certifications!.map((c, i) => (
                    <span key={i} className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                      {c.type} · {c.status}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => onEdit(s)} className="text-xs text-green-600 dark:text-green-400 hover:underline">Modifier</button>
                <button onClick={() => onDelete(s)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Contrats ──────────────────────────────────────────────────────────

function ContractsTab({ contracts, onAdd, onEdit, onDelete }: {
  contracts: Contract[]
  onAdd: () => void
  onEdit: (c: Contract) => void
  onDelete: (c: Contract) => void
}) {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const filtered = contracts.filter(c => {
    if (riskFilter && (c.risk_level ?? '') !== riskFilter) return false
    if (search.trim() && ![c.contract_number, c.product, c.supplier, c.delivery_country].some(v => v?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls()} flex-1 min-w-[160px]`} placeholder="Rechercher un contrat…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={`${inputCls()} w-auto`} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="">Tous risques</option>
          {RISK_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={onAdd} className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">+ Ajouter</button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">Aucun contrat</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">N° contrat</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Fournisseur</th>
                <th className="px-3 py-2 font-medium">Sous EUDR</th>
                <th className="px-3 py-2 font-medium">EUDR appliqué</th>
                <th className="px-3 py-2 font-medium">Géoloc.</th>
                <th className="px-3 py-2 font-medium">Risque</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(c => (
                <tr key={c.id} className="bg-white dark:bg-gray-800">
                  <Td className="font-medium text-gray-900 dark:text-white">{c.contract_number ?? '—'}</Td>
                  <Td>{c.product ?? '—'}</Td>
                  <Td>{c.supplier ?? '—'}</Td>
                  <Td><StatusPill value={c.product_under_eudr} /></Td>
                  <Td><StatusPill value={c.eudr_applied} /></Td>
                  <Td><StatusPill value={c.plot_geolocation} /></Td>
                  <Td><RiskPill value={c.risk_level} /></Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => onEdit(c)} className="text-green-600 dark:text-green-400 hover:underline mr-3">Modifier</button>
                    <button onClick={() => onDelete(c)} className="text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Modale d'édition ──────────────────────────────────────────────────────────

function EditModal({ editing, setEditing, onSave, saving }: {
  editing: { entity: Entity; data: Record<string, unknown> }
  setEditing: (e: { entity: Entity; data: Record<string, unknown> } | null) => void
  onSave: () => void
  saving: boolean
}) {
  const { entity, data } = editing
  const set = (k: string, v: unknown) => setEditing({ entity, data: { ...data, [k]: v } })
  const str = (k: string) => (data[k] as string) ?? ''
  const isNew = !data.id
  const titles: Record<Entity, string> = { buyers: 'acheteur', suppliers: 'fournisseur', contracts: 'contrat' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {isNew ? 'Ajouter' : 'Modifier'} un {titles[entity]}
          </h2>
          <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {entity === 'buyers' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls()}>Nom</label><input className={inputCls()} value={str('name')} onChange={e => set('name', e.target.value)} /></div>
                <div><label className={labelCls()}>Contact EUDR</label><input className={inputCls()} value={str('eudr_contact')} onChange={e => set('eudr_contact', e.target.value)} /></div>
                <div><label className={labelCls()}>Email</label><input className={inputCls()} value={str('email')} onChange={e => set('email', e.target.value)} /></div>
                <div><label className={labelCls()}>Commodité</label><input className={inputCls()} value={str('commodity')} onChange={e => set('commodity', e.target.value)} /></div>
                <div><label className={labelCls()}>Pays d&apos;import</label><input className={inputCls()} value={str('country_import')} onChange={e => set('country_import', e.target.value)} /></div>
                <div><label className={labelCls()}>N° DDS</label><input className={inputCls()} value={str('dds_number')} onChange={e => set('dds_number', e.target.value)} /></div>
                <StatusSelect label="Statut GeoJSON" value={str('geojson_status') || 'unknown'} onChange={v => set('geojson_status', v)} />
                <StatusSelect label="Statut questionnaire" value={str('questionnaire_status') || 'unknown'} onChange={v => set('questionnaire_status', v)} />
              </div>
            </>
          )}

          {entity === 'suppliers' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls()}>Entreprise</label><input className={inputCls()} value={str('company')} onChange={e => set('company', e.target.value)} /></div>
                <div>
                  <label className={labelCls()}>Priorité</label>
                  <select className={inputCls()} value={str('priority') || 'moyenne'} onChange={e => set('priority', e.target.value)}>
                    {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div><label className={labelCls()}>Personne de contact</label><input className={inputCls()} value={str('contact_person')} onChange={e => set('contact_person', e.target.value)} /></div>
                <div><label className={labelCls()}>Email</label><input className={inputCls()} value={str('email')} onChange={e => set('email', e.target.value)} /></div>
                <div><label className={labelCls()}>Pays d&apos;origine</label><input className={inputCls()} value={str('country_origin')} onChange={e => set('country_origin', e.target.value)} /></div>
                <div>
                  <label className={labelCls()}>Niveau de risque EUDR</label>
                  <select className={inputCls()} value={str('eudr_risk_level') || 'standard'} onChange={e => set('eudr_risk_level', e.target.value)}>
                    {RISK_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <StatusSelect label="Statut GeoJSON" value={str('geojson_status') || 'unknown'} onChange={v => set('geojson_status', v)} />
                <StatusSelect label="Questionnaire agriculteur" value={str('farmer_questionnaire_status') || 'unknown'} onChange={v => set('farmer_questionnaire_status', v)} />
                <StatusSelect label="Statut DDR" value={str('ddr_status') || 'unknown'} onChange={v => set('ddr_status', v)} />
              </div>
              <CertificationsEditor
                certs={(data.certifications as Certification[]) ?? []}
                onChange={c => set('certifications', c)}
              />
            </>
          )}

          {entity === 'contracts' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls()}>N° contrat</label><input className={inputCls()} value={str('contract_number')} onChange={e => set('contract_number', e.target.value)} /></div>
              <div><label className={labelCls()}>Produit</label><input className={inputCls()} value={str('product')} onChange={e => set('product', e.target.value)} /></div>
              <div><label className={labelCls()}>Fournisseur</label><input className={inputCls()} value={str('supplier')} onChange={e => set('supplier', e.target.value)} /></div>
              <div><label className={labelCls()}>Pays de livraison</label><input className={inputCls()} value={str('delivery_country')} onChange={e => set('delivery_country', e.target.value)} /></div>
              <div><label className={labelCls()}>Date de production</label><input className={inputCls()} value={str('production_date')} onChange={e => set('production_date', e.target.value)} placeholder="ex. 2025-03" /></div>
              <div><label className={labelCls()}>Livraison prévue</label><input className={inputCls()} value={str('expected_delivery_date')} onChange={e => set('expected_delivery_date', e.target.value)} placeholder="ex. 2025-06" /></div>
              <StatusSelect label="Produit sous EUDR" value={str('product_under_eudr') || 'unknown'} onChange={v => set('product_under_eudr', v)} />
              <StatusSelect label="EUDR appliqué" value={str('eudr_applied') || 'unknown'} onChange={v => set('eudr_applied', v)} />
              <StatusSelect label="Géolocalisation parcelle" value={str('plot_geolocation') || 'unknown'} onChange={v => set('plot_geolocation', v)} />
              <StatusSelect label="Diligence raisonnée" value={str('due_diligence') || 'unknown'} onChange={v => set('due_diligence', v)} />
              <div>
                <label className={labelCls()}>Niveau de risque</label>
                <select className={inputCls()} value={str('risk_level') || 'standard'} onChange={e => set('risk_level', e.target.value)}>
                  {RISK_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls()}>Notes</label>
            <textarea className={`${inputCls()} min-h-[80px]`} value={str('notes')} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Éditeur de certifications ──────────────────────────────────────────────────

function CertificationsEditor({ certs, onChange }: { certs: Certification[]; onChange: (c: Certification[]) => void }) {
  const update = (i: number, patch: Partial<Certification>) =>
    onChange(certs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const add = () => onChange([...certs, { type: 'Halal', status: 'valide', valid_until: '' }])
  const remove = (i: number) => onChange(certs.filter((_, idx) => idx !== i))

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Certifications</label>
        <button type="button" onClick={add} className="text-xs text-green-600 dark:text-green-400 hover:underline">+ Ajouter une ligne</button>
      </div>
      {certs.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Aucune certification.</p>
      ) : (
        certs.map((c, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className={labelCls()}>Type</label>
              <select className={inputCls()} value={c.type} onChange={e => update(i, { type: e.target.value })}>
                {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className={labelCls()}>Statut</label>
              <select className={inputCls()} value={c.status} onChange={e => update(i, { status: e.target.value })}>
                {CERT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className={labelCls()}>Validité</label>
              <input className={inputCls()} value={c.valid_until} onChange={e => update(i, { valid_until: e.target.value })} placeholder="ex. 2026-12" />
            </div>
            <button type="button" onClick={() => remove(i)} className="px-2 py-2 text-sm text-red-600 dark:text-red-400 hover:underline">Retirer</button>
          </div>
        ))
      )}
    </div>
  )
}
