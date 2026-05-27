'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

// ── Types ────────────────────────────────────────────────────────────────────

type TenantStatus = 'unknown' | 'ok' | 'frozen' | 'error'

type M365Tenant = {
  id: string
  owner_id: string
  name: string
  domain: string
  tenant_id: string
  client_id: string
  client_secret: string | null
  notes: string
  is_shared: boolean
  last_score: number | null
  last_max_score: number | null
  last_status: TenantStatus
  last_run_date: string | null
  created_at: string
}

type ScoreResult = {
  score: number
  maxScore: number
  frozenSince: string | null
  daysOld: number
  controlsByDate: { date: string; count: number; daysAgo: number }[]
}

type Tab = 'tenants' | 'dashboard' | 'diagnostic' | 'unlock' | 'optimize'

// ── Helpers UI ───────────────────────────────────────────────────────────────

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-10 text-right" style={{ color: 'var(--text)' }}>
        {pct}%
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: TenantStatus }) {
  const map = {
    ok:      { label: 'Opérationnel', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    frozen:  { label: 'Pipeline gelé', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    error:   { label: 'Erreur', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    unknown: { label: 'Non vérifié', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  }
  const { label, cls } = map[status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

function Input({ label, value, onChange, type = 'text', placeholder, mono, required }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; mono?: boolean; required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${mono ? 'font-mono' : ''}`}
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />
    </div>
  )
}

// ── Formulaire tenant ─────────────────────────────────────────────────────────

function TenantForm({
  initial, onSave, onCancel, hasOrg,
}: {
  initial?: Partial<M365Tenant>
  onSave: (data: Partial<M365Tenant>) => Promise<void>
  onCancel: () => void
  hasOrg: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [domain, setDomain] = useState(initial?.domain ?? '')
  const [tenantId, setTenantId] = useState(initial?.tenant_id ?? '')
  const [clientId, setClientId] = useState(initial?.client_id ?? '')
  const [clientSecret, setClientSecret] = useState(initial?.client_secret ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [isShared, setIsShared] = useState(initial?.is_shared ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !domain || !tenantId || !clientId) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ name, domain, tenant_id: tenantId, client_id: clientId, client_secret: clientSecret || null, notes, is_shared: isShared })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Nom du tenant" value={name} onChange={setName} placeholder="SCDB PRO SARL" required />
        <Input label="Domaine" value={domain} onChange={setDomain} placeholder="contoso.onmicrosoft.com" required />
        <Input label="Tenant ID" value={tenantId} onChange={setTenantId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono required />
        <Input label="Client ID (App ID)" value={clientId} onChange={setClientId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono required />
        <div className="md:col-span-2">
          <Input label="Client Secret" value={clientSecret} onChange={setClientSecret} type="password" placeholder="••••••••••••" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Requis pour lire le score et débloquer le pipeline.
            Créez un App Registration Azure AD avec les permissions <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">SecurityEvents.Read.All</code> et <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Exchange.ManageAsApp</code>.
          </p>
        </div>
        <div className="md:col-span-2">
          <Input label="Notes" value={notes} onChange={setNotes} placeholder="Ex: tenant principal, licence Business Premium…" />
        </div>
      </div>

      {hasOrg && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setIsShared(!isShared)}
            className={`w-10 h-5 rounded-full transition-colors ${isShared ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transition-transform ${isShared ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            Partager avec mon organisation
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
          {saving ? 'Enregistrement…' : (initial?.id ? 'Mettre à jour' : 'Ajouter le tenant')}
        </button>
      </div>
    </form>
  )
}

// ── Carte tenant ──────────────────────────────────────────────────────────────

function TenantCard({
  tenant, isOwner, onEdit, onDelete, onSelect, isActive,
}: {
  tenant: M365Tenant; isOwner: boolean
  onEdit: () => void; onDelete: () => void
  onSelect: () => void; isActive: boolean
}) {
  const pct = tenant.last_score && tenant.last_max_score
    ? Math.round((tenant.last_score / tenant.last_max_score) * 100) : null

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-indigo-500' : ''}`}
      style={{ borderColor: isActive ? 'transparent' : 'var(--border)', backgroundColor: 'var(--bg-card)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{tenant.name}</span>
            {tenant.is_shared && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                Partagé
              </span>
            )}
            {!isOwner && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800" style={{ color: 'var(--text-muted)' }}>
                Lecture seule
              </span>
            )}
          </div>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{tenant.domain}</p>
        </div>
        <StatusBadge status={tenant.last_status} />
      </div>

      {pct !== null && tenant.last_score !== null && tenant.last_max_score !== null ? (
        <div className="mb-3">
          <ScoreBar score={tenant.last_score} max={tenant.last_max_score} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {tenant.last_score}/{tenant.last_max_score} pts
            {tenant.last_run_date && ` · ${new Date(tenant.last_run_date).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
      ) : (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Score non encore lu</p>
      )}

      {isOwner && (
        <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}
          onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <Icon name="edit" size={12} /> Modifier
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
            <Icon name="trash" size={12} /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Vue Diagnostic ────────────────────────────────────────────────────────────

function DiagnosticView({ tenant, onUpdateTenant }: { tenant: M365Tenant; onUpdateTenant: () => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [error, setError] = useState('')

  async function runDiagnostic() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/secure-score/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantDbId: tenant.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      onUpdateTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (!tenant.client_secret) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <Icon name="lock" size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Client Secret requis</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Ajoutez un Client Secret à ce tenant pour pouvoir lire le score.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{tenant.name}</h3>
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{tenant.domain}</p>
        </div>
        <button
          onClick={runDiagnostic} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-2">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Lecture…</>
            : <><Icon name="refresh" size={14} />Lire le score</>}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">Erreur</p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1 font-mono">{error}</p>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Score principal */}
          <div className={`rounded-xl p-5 border ${result.frozenSince ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                  {result.score}<span className="text-lg font-normal text-gray-400">/{result.maxScore}</span>
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {Math.round((result.score / result.maxScore) * 100)}% du score maximum
                </p>
              </div>
              <StatusBadge status={result.frozenSince ? 'frozen' : 'ok'} />
            </div>
            <ScoreBar score={result.score} max={result.maxScore} />
          </div>

          {/* Alerte gel */}
          {result.frozenSince && (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                🔴 Pipeline gelé depuis le {new Date(result.frozenSince).toLocaleDateString('fr-FR')} ({result.daysOld} jours)
              </p>
              <p className="text-xs text-red-600 dark:text-red-500">
                Le backend Microsoft MDO/EXO est bloqué. Utilisez l&apos;onglet <strong>Déblocage</strong> pour corriger.
              </p>
            </div>
          )}

          {/* Distribution des contrôles */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Distribution des contrôles par date</p>
            <div className="flex flex-col gap-1.5">
              {result.controlsByDate.map(d => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-24 shrink-0" style={{ color: 'var(--text-muted)' }}>{d.date}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${d.daysAgo > 30 ? 'bg-red-400' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, (d.count / result.controlsByDate[0]?.count) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs w-20 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {d.count} contrôles{d.daysAgo > 30 ? ' ⚠️' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue Déblocage ─────────────────────────────────────────────────────────────

function generateRbacScript(tenant: M365Tenant): string {
  return `#Requires -Version 5.1
# ============================================================
# Script de configuration RBAC Exchange — Sensetho Apps
# Tenant : ${tenant.name} (${tenant.domain})
# A executer UNE SEULE FOIS avec un compte Global Admin
# ============================================================

# Installation du module si manquant
if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
  Write-Host "Installation ExchangeOnlineManagement..." -ForegroundColor Cyan
  Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber
}

# Connexion interactive (compte Global Admin requis)
Write-Host "Connexion Exchange Online..." -ForegroundColor Cyan
Connect-ExchangeOnline -ShowBanner:$false

# Assignation du role RBAC a l'app Secure-Score
Write-Host "Assignation du role Organization Management a l'app..." -ForegroundColor Cyan
try {
  New-ManagementRoleAssignment -App "${tenant.client_id}" -Role "Organization Management"
  Write-Host "Role assigne avec succes !" -ForegroundColor Green
  Write-Host "Attendez 2-5 minutes puis relancez le Deblocage automatique dans Sensetho Apps." -ForegroundColor Yellow
} catch {
  Write-Host "Erreur : $_" -ForegroundColor Red
  Write-Host "Verifiez que vous etes bien connecte avec un compte Global Admin." -ForegroundColor Yellow
}

Disconnect-ExchangeOnline -Confirm:$false
`
}

function generatePsScript(tenant: M365Tenant): string {
  return `#Requires -Version 5.1
# ============================================================
# Script de déblocage Secure Score — généré par Sensetho Apps
# Tenant : ${tenant.name} (${tenant.domain})
# Date   : ${new Date().toLocaleDateString('fr-FR')}
# ============================================================

param(
  [string]$ClientId     = "${tenant.client_id}",
  [string]$TenantId     = "${tenant.tenant_id}",
  [string]$Domain       = "${tenant.domain}",
  [string]$ClientSecret = ""   # <-- coller votre Client Secret ici
)

if (-not $ClientSecret) {
  $ClientSecret = Read-Host "Client Secret pour ${tenant.name}"
}

# 1. Installation des modules si manquants
foreach ($mod in @('ExchangeOnlineManagement','Microsoft.Graph')) {
  if (-not (Get-Module -ListAvailable -Name $mod)) {
    Write-Host "Installation de $mod..." -ForegroundColor Cyan
    Install-Module $mod -Scope CurrentUser -Force -AllowClobber
  }
}

# 2. Connexion Exchange Online via client credentials
Write-Host "Connexion Exchange Online..." -ForegroundColor Cyan
$body = @{
  grant_type    = "client_credentials"
  client_id     = $ClientId
  client_secret = $ClientSecret
  scope         = "https://outlook.office365.com/.default"
}
$tokenRes = Invoke-RestMethod "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" -Method POST -Body $body
$exoToken = $tokenRes.access_token

# 3. Lire la policy (avec le token REST) — OU connexion module
try {
  Connect-ExchangeOnline -AppId $ClientId -ClientSecret (ConvertTo-SecureString $ClientSecret -AsPlainText -Force) -Organization $Domain -ShowBanner:$false 2>&1 | Out-Null
  Write-Host "Connecte via module EXO" -ForegroundColor Green
  $policy    = Get-AntiPhishPolicy | Where-Object { $_.IsDefault -eq $true -or $_.Name -match "Default" } | Select-Object -First 1
  $policyId  = $policy.Identity
  $threshold = $policy.PhishThresholdLevel
  $temp      = if ($threshold -eq 2) { 3 } else { 2 }

  Write-Host "Policy : $policyId | PhishThreshold : $threshold" -ForegroundColor White
  Write-Host "Modification : $threshold -> $temp..." -ForegroundColor Cyan
  Set-AntiPhishPolicy -Identity $policyId -PhishThresholdLevel $temp -Confirm:$false
  Write-Host "Attente 30s..." -ForegroundColor Yellow
  Start-Sleep -Seconds 30
  Write-Host "Restauration : $temp -> $threshold..." -ForegroundColor Cyan
  Set-AntiPhishPolicy -Identity $policyId -PhishThresholdLevel $threshold -Confirm:$false
  Write-Host "Pipeline relance ! Score visible dans 1-2h sur security.microsoft.com/securescore" -ForegroundColor Green
  Disconnect-ExchangeOnline -Confirm:$false 2>&1 | Out-Null
} catch {
  Write-Host "Erreur : $_" -ForegroundColor Red
  Write-Host "Verifiez que le Service Principal est bien dans le role 'Exchange Administrator'" -ForegroundColor Yellow
}
`
}

function UnlockView({ tenant, onUpdateTenant }: { tenant: M365Tenant; onUpdateTenant: () => void }) {
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [afterScore, setAfterScore] = useState<{ score: number; max: number } | null>(null)
  const [error, setError] = useState('')
  const [showPrereqs, setShowPrereqs] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rbacRunning, setRbacRunning] = useState(false)
  const [rbacLog, setRbacLog] = useState<string[]>([])
  const [rbacDone, setRbacDone] = useState(false)
  const [rbacError, setRbacError] = useState('')
  const [rbacNeedsOrgCustomization, setRbacNeedsOrgCustomization] = useState(false)
  // Device-code auth flow
  const [deviceAuthStep, setDeviceAuthStep] = useState<'idle' | 'showing_code' | 'polling' | 'success' | 'error'>('idle')
  const [deviceUserCode, setDeviceUserCode] = useState('')
  const [deviceVerifUri, setDeviceVerifUri] = useState('')

  const [deviceAuthLog, setDeviceAuthLog] = useState<string[]>([])
  const [devicePollTimer, setDevicePollTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const is401 = error.includes('401')

  // Nettoyer le timer de polling au démontage
  useEffect(() => {
    return () => { if (devicePollTimer) clearInterval(devicePollTimer) }
  }, [devicePollTimer])

  function copyRbacCommand() {
    const cmd = `Connect-ExchangeOnline\nNew-ManagementRoleAssignment -App "${tenant.client_id}" -Role "Organization Management"`
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function downloadRbacScript() {
    const script = generateRbacScript(tenant)
    const blob = new Blob([script], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `rbac-setup-${tenant.domain.replace(/\./g, '-')}.ps1`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadScript() {
    const script = generatePsScript(tenant)
    const blob = new Blob([script], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `unlock-${tenant.domain.replace(/\./g, '-')}.ps1`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function startDeviceAuth() {
    setDeviceAuthStep('idle')
    setDeviceAuthLog([])
    if (devicePollTimer) { clearInterval(devicePollTimer); setDevicePollTimer(null) }
    try {
      const res = await fetch(`/api/secure-score/device-auth?tenantDbId=${tenant.id}`)
      const data = await res.json()
      if (!res.ok) { setDeviceAuthStep('error'); setDeviceAuthLog([data.error ?? 'Erreur device code']); return }
      setDeviceUserCode(data.user_code)
      setDeviceVerifUri(data.verification_uri)

      setDeviceAuthStep('showing_code')
      // Démarrer le polling automatique
      const interval = data.interval ?? 5
      const timer = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/secure-score/device-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantDbId: tenant.id, device_code: data.device_code }),
          })
          const pollData = await pollRes.json()
          if (pollData.status === 'pending' || pollData.status === 'slow_down') return
          clearInterval(timer); setDevicePollTimer(null)
          if (pollData.status === 'success') {
            setDeviceAuthLog(pollData.log ?? [])
            setDeviceAuthStep('success')
          } else {
            setDeviceAuthLog([pollData.error ?? 'Authentification échouée'])
            setDeviceAuthStep('error')
          }
        } catch { /* silent */ }
      }, interval * 1000)
      setDevicePollTimer(timer)
    } catch (err) {
      setDeviceAuthStep('error')
      setDeviceAuthLog([err instanceof Error ? err.message : 'Erreur'])
    }
  }

  async function setupRbac() {
    setRbacRunning(true); setRbacLog([]); setRbacError(''); setRbacDone(false); setRbacNeedsOrgCustomization(false)
    try {
      const res = await fetch('/api/secure-score/setup-rbac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantDbId: tenant.id }),
      })
      const data = await res.json()
      setRbacLog(data.log ?? [])
      if (data.error === 'NEEDS_ORG_CUSTOMIZATION') {
        setRbacNeedsOrgCustomization(true)
        return
      }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Échec de la configuration RBAC')
      setRbacDone(true)
    } catch (err) {
      setRbacError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setRbacRunning(false)
    }
  }

  async function runUnlock() {
    if (!confirm(`Débloquer le pipeline de "${tenant.name}" ?\n\nCette opération modifie temporairement la politique Anti-Phish (30 secondes) puis la restaure. La configuration finale est identique à l'état initial.`)) return
    setRunning(true); setLog([]); setError(''); setDone(false); setAfterScore(null)
    try {
      const res = await fetch('/api/secure-score/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantDbId: tenant.id }),
      })
      const data = await res.json()
      setLog(data.log ?? [])
      if (data.afterScore != null) setAfterScore({ score: data.afterScore, max: data.afterMax })
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Déblocage échoué')
      setDone(true)
      onUpdateTenant()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setRunning(false)
    }
  }

  if (!tenant.client_secret) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <Icon name="lock" size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Client Secret requis</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Ajoutez un Client Secret à ce tenant pour utiliser le déblocage.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête méthode */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Icon name="lightning" size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
              Méthode AntiPhish PhishThreshold
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Modifie temporairement PhishThreshold (3→2→3) pour réveiller le pipeline MDO/EXO bloqué. Configuration restaurée à l&apos;identique.
            </p>
            <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
              ✅ Validé : +104.8 pts en 1h sur SCDB PRO SARL (52.9% → 90.6%)
            </p>
            <button onClick={() => setShowPrereqs(!showPrereqs)}
              className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1">
              <Icon name="info" size={11} />
              {showPrereqs ? 'Masquer' : 'Voir les prérequis Azure AD'}
            </button>
          </div>
        </div>

        {showPrereqs && (
          <div className="mt-4 pt-4 border-t flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              Prérequis pour le déblocage automatique (API Exchange Online)
            </p>
            <div className="flex flex-col gap-2">
              {[
                { step: '1', label: 'Azure AD → App Registrations → [votre app] → API permissions', detail: 'Ajouter : APIs my organization uses → "Office 365 Exchange Online" → Application permissions → Exchange.ManageAsApp → Grant admin consent' },
                { step: '2', label: 'PowerShell : New-ManagementRoleAssignment', detail: 'Connect-ExchangeOnline puis New-ManagementRoleAssignment -App "<ClientId>" -Role "Organization Management" — visible dans le guide 401 après une tentative échouée.' },
                { step: '3', label: 'Attendre 5-10 minutes', detail: 'La propagation des permissions peut prendre quelques minutes avant de relancer le déblocage.' },
              ].map(s => (
                <div key={s.step} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{s.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      {!running && !done && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={runUnlock}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
            <Icon name="lightning" size={16} />
            Déblocage automatique (API)
          </button>
          <button onClick={downloadScript}
            className="flex-1 py-3 rounded-xl font-semibold border transition-colors flex items-center justify-center gap-2"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--bg-card)' }}>
            <Icon name="download" size={16} />
            Script PowerShell (.ps1)
          </button>
        </div>
      )}

      {/* Log temps réel */}
      {(running || log.length > 0) && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-2 text-xs font-semibold border-b flex items-center gap-2"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {running && <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
            Journal d&apos;exécution
          </div>
          <div className="p-4 font-mono text-xs space-y-1 bg-gray-950 dark:bg-black max-h-64 overflow-y-auto">
            {log.map((line, i) => (
              <p key={i} className={
                line.includes('✅') ? 'text-emerald-400' :
                line.includes('❌') || line.includes('⚠️') ? 'text-red-400' :
                'text-gray-300'
              }>{line}</p>
            ))}
            {running && <p className="text-indigo-400 animate-pulse">…</p>}
          </div>
        </div>
      )}

      {/* Résultat succès */}
      {done && afterScore && (
        <div className="rounded-xl p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2">✅ Déblocage réussi !</p>
          <p className="text-sm" style={{ color: 'var(--text)' }}>Score actuel : <strong>{afterScore.score}/{afterScore.max}</strong></p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Score final visible dans 1-2h sur{' '}
            <a href="https://security.microsoft.com/securescore" target="_blank" rel="noreferrer"
              className="underline text-indigo-500">security.microsoft.com/securescore</a>
          </p>
        </div>
      )}

      {/* Erreur — avec guide permissions si 401 */}
      {error && !done && (
        <div className="rounded-xl border overflow-hidden border-red-200 dark:border-red-800">
          <div className="p-4 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
              {is401 ? '🔐 Permissions Exchange Online insuffisantes (401)' : '❌ Erreur'}
            </p>
            <p className="text-xs font-mono text-red-600 dark:text-red-500">{error}</p>
          </div>
          {is401 && (
            <div className="p-4 border-t border-red-200 dark:border-red-800 bg-amber-50 dark:bg-amber-900/10 flex flex-col gap-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Configuration requise — 2 étapes (une seule fois)
              </p>

              {/* Étape 1 */}
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    <strong>portal.azure.com</strong> → App Registrations → API permissions
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                    Ajouter <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Exchange.ManageAsApp</code> → Grant admin consent
                  </p>
                </div>
              </div>

              {/* Étape 2 — PowerShell RBAC */}
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">
                    Rôle Exchange Online RBAC — PowerShell <span className="font-normal">(~30 sec, compte Global Admin)</span>
                  </p>
                  <div className="relative rounded-lg bg-gray-950 p-3">
                    <p className="font-mono text-xs text-gray-400 mb-0.5"># Si module absent :</p>
                    <p className="font-mono text-xs text-gray-300 mb-2">Install-Module ExchangeOnlineManagement -Scope CurrentUser</p>
                    <p className="font-mono text-xs text-gray-400 mb-0.5"># Connexion puis assignation du rôle :</p>
                    <p className="font-mono text-xs text-emerald-300">Connect-ExchangeOnline</p>
                    <p className="font-mono text-xs text-emerald-300 break-all">
                      New-ManagementRoleAssignment -App &quot;{tenant.client_id}&quot; -Role &quot;Organization Management&quot;
                    </p>
                    <button
                      onClick={copyRbacCommand}
                      className="absolute top-2 right-2 text-xs px-2 py-1 rounded transition-colors font-medium"
                      style={{ backgroundColor: copied ? '#10b981' : '#374151', color: copied ? '#fff' : '#d1d5db' }}
                    >
                      {copied ? '✅ Copié' : 'Copier'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <button onClick={downloadRbacScript}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      <Icon name="download" size={12} />
                      Script de configuration (.ps1)
                    </button>
                    <button onClick={downloadScript}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-500 hover:underline">
                      <Icon name="download" size={12} />
                      Script de déblocage complet
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-configuration via Graph API */}
              <div className="border-t border-amber-200 dark:border-amber-800 pt-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">🤖 Alternative :</span>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Configurer automatiquement le rôle Exchange RBAC via l&apos;API Graph (sans PowerShell)
                  </p>
                </div>

                {!rbacDone && (
                  <button
                    onClick={setupRbac}
                    disabled={rbacRunning}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-colors">
                    {rbacRunning
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Configuration en cours…</>
                      : <><Icon name="lightning" size={14} />Auto-configurer les permissions RBAC</>}
                  </button>
                )}

                {(rbacLog.length > 0) && (
                  <div className="rounded-lg bg-gray-950 p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5">
                    {rbacLog.map((line, i) => (
                      <p key={i} className={
                        line.includes('✅') ? 'text-emerald-400' :
                        line.includes('❌') ? 'text-red-400' :
                        'text-gray-300'
                      }>{line}</p>
                    ))}
                  </div>
                )}

                {rbacError && (
                  <p className="text-xs text-red-500 font-mono">{rbacError}</p>
                )}

                {rbacNeedsOrgCustomization && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-3 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-amber-400">⚠️ Organisation Exchange non personnalisée</p>

                    {/* Option A : Authentification déléguée automatique */}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-amber-300 font-medium">Option 1 — Authentification déléguée (recommandé) :</p>
                      {deviceAuthStep === 'idle' && (
                        <button
                          onClick={startDeviceAuth}
                          className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white rounded px-3 py-2 text-left font-medium transition-colors">
                          🔑 Activer via authentification navigateur (sans PowerShell)
                        </button>
                      )}
                      {deviceAuthStep === 'showing_code' && (
                        <div className="flex flex-col gap-2 rounded bg-gray-950 p-3">
                          <p className="text-xs text-gray-300">Ouvrez ce lien dans votre navigateur et entrez le code :</p>
                          <a href={deviceVerifUri} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-400 underline break-all">{deviceVerifUri}</a>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-lg font-bold text-white tracking-widest">{deviceUserCode}</span>
                            <button onClick={() => navigator.clipboard.writeText(deviceUserCode)}
                              className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded border border-gray-600">
                              Copier
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                            En attente de votre authentification…
                          </p>
                        </div>
                      )}
                      {deviceAuthStep === 'polling' && (
                        <p className="text-xs text-indigo-300 flex items-center gap-1">
                          <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                          Authentification confirmée — exécution en cours…
                        </p>
                      )}
                      {deviceAuthStep === 'success' && (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-emerald-400 font-semibold">✅ Enable-OrganizationCustomization exécuté !</p>
                          {deviceAuthLog.map((l, i) => (
                            <p key={i} className={`font-mono text-xs ${l.includes('✅') ? 'text-emerald-400' : l.includes('❌') ? 'text-red-400' : 'text-gray-300'}`}>{l}</p>
                          ))}
                          <button onClick={setupRbac} disabled={rbacRunning}
                            className="mt-1 text-xs text-indigo-400 hover:underline text-left">
                            → Relancer l&apos;auto-configuration RBAC maintenant
                          </button>
                        </div>
                      )}
                      {deviceAuthStep === 'error' && (
                        <div className="flex flex-col gap-1">
                          {deviceAuthLog.map((l, i) => <p key={i} className="font-mono text-xs text-red-400">{l}</p>)}
                          <button onClick={startDeviceAuth} className="text-xs text-indigo-400 hover:underline text-left">→ Réessayer</button>
                        </div>
                      )}
                    </div>

                    {/* Option B : PowerShell manuel */}
                    <div className="flex flex-col gap-1 border-t border-amber-800/40 pt-2">
                      <p className="text-xs text-amber-300 font-medium">Option 2 — PowerShell manuel :</p>
                      <div className="rounded bg-gray-950 p-2 font-mono text-xs text-emerald-300">
                        <p>Connect-ExchangeOnline</p>
                        <p>Enable-OrganizationCustomization</p>
                      </div>
                      <button
                        onClick={setupRbac}
                        disabled={rbacRunning}
                        className="text-xs text-indigo-400 hover:underline text-left">
                        → Relancer l&apos;auto-configuration après exécution
                      </button>
                    </div>
                  </div>
                )}

                {rbacDone && (
                  <div className="rounded-lg bg-emerald-900/30 border border-emerald-700 p-3">
                    <p className="text-xs font-semibold text-emerald-400">✅ Rôle RBAC configuré avec succès !</p>
                    <p className="text-xs text-emerald-300 mt-1">
                      Attendez <strong>2-5 minutes</strong> pour la propagation, puis relancez le Déblocage automatique.
                    </p>
                  </div>
                )}

                {!rbacDone && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    ⏱️ Après la configuration (auto ou PowerShell), attendez <strong>2-5 minutes</strong> puis relancez le Déblocage automatique.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Carte RBAC Setup (utilisée dans OptimizeView) ────────────────────────────

function RbacSetupCard({ clientId, rbacRole }: { clientId: string; rbacRole: string }) {
  const [copied, setCopied] = useState(false)

  const psCommand = `Connect-ExchangeOnline\nNew-ManagementRoleAssignment -App "${clientId}" -Role "${rbacRole}"`

  function copy() {
    navigator.clipboard.writeText(psCommand).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="p-4 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="text-lg">⚠️</span>
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Rôle Exchange RBAC manquant — setup requis (une seule fois)
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
            Le rôle classique <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">{rbacRole}</code> doit être assigné manuellement à votre app registration via PowerShell (compte Global Admin).
          </p>
        </div>
      </div>

      <div className="relative rounded-lg bg-gray-950 p-3">
        <p className="font-mono text-xs text-gray-400 mb-0.5"># Si module absent :</p>
        <p className="font-mono text-xs text-gray-300 mb-2">Install-Module ExchangeOnlineManagement -Scope CurrentUser</p>
        <p className="font-mono text-xs text-gray-400 mb-0.5"># Connexion puis assignation :</p>
        <p className="font-mono text-xs text-emerald-300">Connect-ExchangeOnline</p>
        <p className="font-mono text-xs text-emerald-300 break-all">
          New-ManagementRoleAssignment -App &quot;{clientId}&quot; -Role &quot;{rbacRole}&quot;
        </p>
        <button
          onClick={copy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded transition-colors font-medium"
          style={{ backgroundColor: copied ? '#10b981' : '#374151', color: copied ? '#fff' : '#d1d5db' }}
        >
          {copied ? '✅ Copié' : 'Copier'}
        </button>
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-500">
        ⏱️ Après l&apos;assignation, attendez <strong>2-5 minutes</strong> puis relancez l&apos;automatisation.
      </p>
    </div>
  )
}

// ── Vue Optimisation ──────────────────────────────────────────────────────────

type OptAction = 'audit' | 'atp' | 'dlp' | 'mfa' | 'block-risky'
type OptResult = { success: boolean; log: string[]; error?: string; needsRbac?: boolean; rbacRole?: string }

function OptimizeView({ tenant }: { tenant: M365Tenant | null }) {
  const [running, setRunning] = useState<OptAction | null>(null)
  const [results, setResults] = useState<Partial<Record<OptAction, OptResult>>>({})
  const [expanded, setExpanded] = useState<Partial<Record<OptAction, boolean>>>({})

  const steps: {
    pts: number; label: string; diff: string; desc: string; url: string; tag: string
    action?: OptAction; needs?: string
  }[] = [
    {
      pts: 6, label: 'Auto-Sensitivity Labels', diff: 'Moyen', tag: 'Compliance',
      desc: 'Créer des stratégies d\'étiquetage automatique pour les données sensibles (CB, IBAN, PII).',
      url: 'https://compliance.microsoft.com',
    },
    {
      pts: 5, label: 'DLP Policies', diff: 'Moyen', tag: 'Compliance',
      desc: '3 politiques DLP automatiques : données personnelles, cartes de crédit, données financières (IBAN).',
      url: 'https://compliance.microsoft.com',
      action: 'dlp',
    },
    {
      pts: 3, label: 'Block Risky Logins', diff: 'Moyen', tag: 'Azure AD',
      desc: 'Accès conditionnel : bloquer les connexions à risque élevé ou moyen.',
      url: 'https://portal.azure.com',
      action: 'block-risky',
      needs: 'Policy.ReadWrite.ConditionalAccess',
    },
    {
      pts: 3, label: 'Advanced Threat Protection', diff: 'Facile', tag: 'Defender',
      desc: 'Activer Pièces jointes fiables, Liens fiables, ZAP anti-malware via Safe Attachments/Links.',
      url: 'https://security.microsoft.com',
      action: 'atp',
    },
    {
      pts: 3, label: 'Passwordless Sign-in', diff: 'Moyen', tag: 'Azure AD',
      desc: 'Activer Windows Hello, FIDO2 ou Microsoft Authenticator sans mot de passe.',
      url: 'https://portal.azure.com',
    },
    {
      pts: 2, label: 'Enforce MFA (Conditional Access)', diff: 'Facile', tag: 'Azure AD',
      desc: 'Exiger l\'authentification MFA pour tous les utilisateurs via une règle d\'accès conditionnel.',
      url: 'https://portal.azure.com',
      action: 'mfa',
      needs: 'Policy.ReadWrite.ConditionalAccess',
    },
    {
      pts: 2, label: 'Advanced Auditing (365 j)', diff: 'Facile', tag: 'Exchange',
      desc: 'Étendre la rétention des journaux d\'audit à 365 jours via Set-AdminAuditLogConfig.',
      url: 'https://admin.microsoft.com',
      action: 'audit',
    },
    {
      pts: 4, label: 'Insider Risk Management', diff: 'E5 requis', tag: 'Compliance',
      desc: 'Nécessite Microsoft 365 E5 ou add-on Insider Risk Management.',
      url: 'https://compliance.microsoft.com',
    },
  ]

  const diffColor: Record<string, string> = {
    'Facile':    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Moyen':     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'E5 requis': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }

  const canAuto = !!tenant?.client_secret
  const total = steps.reduce((s, x) => s + x.pts, 0)
  const automatable = steps.filter(s => s.action).length

  async function runAction(action: OptAction) {
    if (!tenant || running) return
    setRunning(action)
    setResults(prev => { const n = { ...prev }; delete n[action]; return n })
    try {
      const res = await fetch('/api/secure-score/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantDbId: tenant.id, action }),
      })
      const data = await res.json()
      setResults(prev => ({ ...prev, [action]: data }))
      setExpanded(prev => ({ ...prev, [action]: true }))
    } catch (e) {
      setResults(prev => ({ ...prev, [action]: { success: false, log: [], error: String(e) } }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="rounded-xl p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
          Guide d&apos;optimisation — vers 278/278 (100%)
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Ces {steps.length} configurations représentent jusqu&apos;à +{total} points.{' '}
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
            {automatable} automatisables directement.
          </span>
        </p>
        {!tenant && (
          <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">
            ⚠️ Sélectionnez un tenant dans l&apos;onglet &quot;Mes tenants&quot; pour activer l&apos;automatisation.
          </p>
        )}
        {tenant && !tenant.client_secret && (
          <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">
            ⚠️ Ajoutez un Client Secret au tenant pour activer l&apos;automatisation.
          </p>
        )}
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const res = s.action ? results[s.action] : undefined
          const isRunning = s.action ? running === s.action : false
          const isExpanded = s.action ? expanded[s.action] : false

          return (
            <div key={i} className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {res?.success && <span className="text-emerald-500">✅</span>}
                    {res && !res.success && <span className="text-red-500">❌</span>}
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{s.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor[s.diff] ?? ''}`}>
                      {s.diff}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800"
                      style={{ color: 'var(--text-muted)' }}>
                      {s.tag}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{s.pts} pts
                  </span>
                </div>

                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>

                {/* Footer actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <a href={s.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    Ouvrir le portail <Icon name="externalLink" size={11} />
                  </a>

                  {s.action && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        onClick={() => runAction(s.action!)}
                        disabled={!canAuto || isRunning || !!running}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                          !canAuto || (running && !isRunning)
                            ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500'
                            : res?.success
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                        }`}
                      >
                        {isRunning ? (
                          <>
                            <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            En cours…
                          </>
                        ) : res?.success ? (
                          '✅ Configuré'
                        ) : (
                          <>⚡ Automatiser</>
                        )}
                      </button>

                      {s.needs && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Nécessite : <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{s.needs}</code>
                        </span>
                      )}

                      {res && (
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [s.action!]: !prev[s.action!] }))}
                          className="text-xs text-gray-500 hover:underline ml-auto">
                          {isExpanded ? 'Masquer le log' : 'Voir le log'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Log inline */}
              {s.action && res && isExpanded && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="p-3 font-mono text-xs space-y-0.5 bg-gray-950 dark:bg-black max-h-48 overflow-y-auto">
                    {res.log.map((line, j) => (
                      <p key={j} className={
                        line.includes('✅') ? 'text-emerald-400' :
                        line.includes('❌') || line.includes('⚠️') ? 'text-red-400' :
                        'text-gray-300'
                      }>{line}</p>
                    ))}
                    {!res.success && res.error && (
                      <p className="text-red-400 mt-1 pt-1 border-t border-gray-800">{res.error}</p>
                    )}
                  </div>

                  {/* Carte RBAC si setup requis */}
                  {res.needsRbac && res.rbacRole && tenant && (
                    <RbacSetupCard clientId={tenant.client_id} rbacRole={res.rbacRole} />
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

// ── App principale ────────────────────────────────────────────────────────────

export default function SecureScoreApp() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('tenants')
  const [ownTenants, setOwnTenants] = useState<M365Tenant[]>([])
  const [sharedTenants, setSharedTenants] = useState<M365Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasOrg, setHasOrg] = useState(false)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTenant, setEditTenant] = useState<M365Tenant | null>(null)

  const allTenants = [...ownTenants, ...sharedTenants]
  const activeTenant = allTenants.find(t => t.id === activeTenantId) ?? null

  const loadTenants = useCallback(async () => {
    const res = await fetch('/api/secure-score/tenants')
    if (res.ok) {
      const data = await res.json()
      setOwnTenants(data.own ?? [])
      setSharedTenants(data.shared ?? [])
      if (!activeTenantId && data.own?.[0]) setActiveTenantId(data.own[0].id)
    }
  }, [activeTenantId])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
        setHasOrg(Boolean(profile?.org_id))
      }
      await loadTenants()
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(data: Partial<M365Tenant>) {
    const res = await fetch('/api/secure-score/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error)
    }
    const created = await res.json()
    await loadTenants()
    setActiveTenantId(created.id)
    setShowForm(false)
  }

  async function handleUpdate(data: Partial<M365Tenant>) {
    if (!editTenant) return
    const res = await fetch(`/api/secure-score/tenants/${editTenant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error)
    }
    await loadTenants()
    setEditTenant(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce tenant ?')) return
    await fetch(`/api/secure-score/tenants/${id}`, { method: 'DELETE' })
    await loadTenants()
    if (activeTenantId === id) setActiveTenantId(allTenants.find(t => t.id !== id)?.id ?? null)
  }

  const tabs: { id: Tab; label: string; icon: string; needsTenant?: boolean }[] = [
    { id: 'tenants',    label: 'Mes tenants',  icon: 'folder' },
    { id: 'dashboard',  label: 'Tableau de bord', icon: 'chart' },
    { id: 'diagnostic', label: 'Diagnostic',   icon: 'search', needsTenant: true },
    { id: 'unlock',     label: 'Déblocage',    icon: 'lightning', needsTenant: true },
    { id: 'optimize',   label: 'Optimiser',    icon: 'star' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={tab !== t.id ? { color: 'var(--text-muted)' } : {}}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Sélecteur de tenant actif (visible sauf sur tenants) */}
      {allTenants.length > 0 && tab !== 'tenants' && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>Tenant actif :</span>
          <select
            value={activeTenantId ?? ''}
            onChange={e => setActiveTenantId(e.target.value)}
            className="flex-1 text-sm bg-transparent focus:outline-none"
            style={{ color: 'var(--text)' }}
          >
            {allTenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.domain}</option>
            ))}
          </select>
          {activeTenant && <StatusBadge status={activeTenant.last_status} />}
        </div>
      )}

      {/* ── Contenu par onglet ── */}

      {/* Tenants */}
      {tab === 'tenants' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {ownTenants.length} tenant{ownTenants.length > 1 ? 's' : ''} personnel{ownTenants.length > 1 ? 's' : ''}
              {sharedTenants.length > 0 && ` · ${sharedTenants.length} partagé${sharedTenants.length > 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => { setShowForm(true); setEditTenant(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
              <Icon name="plus" size={14} /> Ajouter un tenant
            </button>
          </div>

          {(showForm || editTenant) && (
            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
                {editTenant ? 'Modifier le tenant' : 'Nouveau tenant Microsoft 365'}
              </h3>
              <TenantForm
                initial={editTenant ?? undefined}
                onSave={editTenant ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditTenant(null) }}
                hasOrg={hasOrg}
              />
            </div>
          )}

          {allTenants.length === 0 && !showForm ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--border)' }}>
              <Icon name="cloud" size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Aucun tenant configuré</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ajoutez votre premier tenant Microsoft 365 pour commencer.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ownTenants.map(t => (
                <TenantCard key={t.id} tenant={t} isOwner={t.owner_id === userId}
                  isActive={t.id === activeTenantId}
                  onSelect={() => setActiveTenantId(t.id)}
                  onEdit={() => { setEditTenant(t); setShowForm(false) }}
                  onDelete={() => handleDelete(t.id)} />
              ))}
              {sharedTenants.map(t => (
                <TenantCard key={t.id} tenant={t} isOwner={false}
                  isActive={t.id === activeTenantId}
                  onSelect={() => setActiveTenantId(t.id)}
                  onEdit={() => {}} onDelete={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <div className="flex flex-col gap-3">
          {allTenants.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>
              Aucun tenant — ajoutez-en un dans l&apos;onglet Mes tenants.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allTenants.map(t => {
                  const pct = t.last_score && t.last_max_score
                    ? Math.round((t.last_score / t.last_max_score) * 100) : null
                  return (
                    <div key={t.id} className="rounded-xl border p-4 flex flex-col gap-3"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t.name}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.domain}</p>
                        </div>
                        <StatusBadge status={t.last_status} />
                      </div>
                      {pct !== null && t.last_score !== null && t.last_max_score !== null ? (
                        <>
                          <div>
                            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                              {t.last_score}<span className="text-base font-normal text-gray-400">/{t.last_max_score}</span>
                            </p>
                            <ScoreBar score={t.last_score} max={t.last_max_score} />
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Mis à jour {t.last_run_date ? new Date(t.last_run_date).toLocaleDateString('fr-FR') : '—'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Score non lu — utilisez l&apos;onglet Diagnostic
                        </p>
                      )}
                      <button
                        onClick={() => { setActiveTenantId(t.id); setTab('diagnostic') }}
                        className="text-xs text-indigo-500 hover:underline text-left">
                        Lancer le diagnostic →
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Diagnostic */}
      {tab === 'diagnostic' && (
        activeTenant
          ? <DiagnosticView tenant={activeTenant} onUpdateTenant={loadTenants} />
          : <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sélectionnez un tenant.</p>
      )}

      {/* Déblocage */}
      {tab === 'unlock' && (
        activeTenant
          ? <UnlockView tenant={activeTenant} onUpdateTenant={loadTenants} />
          : <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>Sélectionnez un tenant.</p>
      )}

      {/* Optimisation — toujours monté pour préserver le state des résultats */}
      <div className={tab !== 'optimize' ? 'hidden' : ''}>
        <OptimizeView tenant={activeTenant} />
      </div>
    </div>
  )
}
