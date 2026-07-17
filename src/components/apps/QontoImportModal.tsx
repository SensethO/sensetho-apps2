'use client'

// Module unique Qonto des apps budget — source de vérité portée dans
// @sensetho/catalogue-app (src/qonto). Toute évolution ici doit être reportée
// au Catalogue-App.
//
// Modale d’import bancaire Qonto partagée par BudgetAssociationApp et
// BudgetEntrepriseApp : connexion par organisation (identifiants chiffrés),
// multi-comptes bancaires, récupération de toutes les pages de transactions
// (ascenseur interne + en-tête sticky), ventilation automatique par IA
// (POST /api/qonto/suggest-comptes), import par cible commune ou par
// transaction (upsert de la ligne budgétaire puis lignes de détail,
// 409 = transaction déjà importée). Règle comptable : un compte de bilan
// (actif / passif) va toujours au sous-budget « général » (generalKey).

import React, { useState, useEffect, useCallback, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QontoSousBudget {
  key: string
  label: string
  icon?: string
  affectation_type: string
  refId: string | null
  refField: 'action_id' | 'centre_cout_id'
}

export interface QontoModalCompte {
  id: string
  numero: string
  libelle: string
  type: string // 'charge' | 'produit' | 'actif' | 'passif'
  parent_id?: string | null
}

export interface QontoImportModalProps {
  apiBase: string // '/api/budget-association' | '/api/budget-entreprise'
  plan: 'association' | 'entreprise' // prompt IA + libellés
  organisationId: string
  orgName: string
  exercice: { id: string; date_debut?: string | null; date_fin?: string | null }
  sousBudgets: QontoSousBudget[]
  generalKey: string // clé du sous-budget « général » (cible forcée des comptes actif / passif)
  defaultSBKey: string
  comptes: QontoModalCompte[]
  onImported: () => void
  onClose: () => void
}

interface QontoBankAccount {
  id: string
  slug: string
  iban: string
  name: string
  balance: number
  currency: string
  status: string
}
interface QontoTx {
  id: string
  transaction_id: string
  amount: number
  side: 'debit' | 'credit'
  label: string
  note: string | null
  settled_at: string | null
  emitted_at: string | null
  category: string | null
  operation_type: string | null
  status: string
}
interface QontoTxMeta {
  current_page: number
  next_page: number | null
  total_pages: number
  total_count: number
  per_page: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskIban(iban: string): string {
  if (!iban) return '—'
  return `•••• ${iban.slice(-4)}`
}
function fmtQDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtQAmount(amount: number, side: 'debit' | 'credit'): string {
  const n = Math.abs(amount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return side === 'debit' ? `−${n} €` : `+${n} €`
}

// ── Couleurs sémantiques (compatibles clair / sombre via rgba) ────────────────

const RED = '#dc2626'
const RED_BG = 'rgba(220,38,38,0.08)'
const GREEN = '#16a34a'
const GREEN_BG = 'rgba(22,163,74,0.08)'
const AMBER = '#d97706'
const AMBER_BG = 'rgba(217,119,6,0.12)'

// ── Styles réutilisables (variables CSS du thème apps2) ──────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.6rem',
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text)', fontSize: '0.88rem',
}
const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1.1rem', borderRadius: '0.6rem', background: 'var(--accent)',
  color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
}
const btnGhost: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: '0.6rem', background: 'var(--bg)',
  color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
}
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
}
const modalCard: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)',
  width: '100%', maxWidth: 640, maxHeight: '85vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

// Libellés des types de comptes (l'ordre pilote les sélecteurs)
const COMPTE_TYPE_ORDER = ['charge', 'produit', 'actif', 'passif'] as const
const COMPTE_TYPE_LABEL: Record<string, string> = {
  charge: '📤 Charge (classes 6)',
  produit: '📥 Produit (classes 7)',
  actif: '🏦 Actif (bilan)',
  passif: '🏛️ Passif (bilan)',
}

// En-tête sticky du tableau des transactions (le border-bottom d'un <tr> ne
// « colle » pas — on le simule via box-shadow sur chaque <th>).
const thStickyQ: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)',
  boxShadow: 'inset 0 -1px 0 var(--border)',
}

// Badges de confiance des suggestions IA (ventilation automatique)
const CONFIANCE_STYLE: Record<'haute' | 'moyenne' | 'faible', { color: string; bg: string }> = {
  haute: { color: GREEN, bg: GREEN_BG },
  moyenne: { color: AMBER, bg: AMBER_BG },
  faible: { color: RED, bg: RED_BG },
}

export default function QontoImportModal({
  apiBase, plan, organisationId, orgName, exercice,
  sousBudgets, generalKey, defaultSBKey, comptes, onImported, onClose,
}: QontoImportModalProps) {
  // ── Connexion (credentials par organisation) ────────────────────────────────
  const [credsLoading, setCredsLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [loginMasked, setLoginMasked] = useState<string | null>(null)
  const [login, setLogin] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connError, setConnError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  // ── Comptes bancaires ───────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<QontoBankAccount[]>([])
  const [qontoOrgName, setQontoOrgName] = useState('')
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')

  // ── Transactions ────────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState((exercice.date_debut ?? '').slice(0, 10))
  const [toDate, setToDate] = useState((exercice.date_fin ?? '').slice(0, 10))
  const [sideFilter, setSideFilter] = useState<'' | 'debit' | 'credit'>('')
  const [txs, setTxs] = useState<QontoTx[]>([])
  const [meta, setMeta] = useState<QontoTxMeta | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const [selected, setSelected] = useState<Record<string, QontoTx>>({})

  // ── Cible d'import (commune à la sélection) ─────────────────────────────────
  const [compteType, setCompteType] = useState('charge')
  const [compteId, setCompteId] = useState('')
  const [compteSearch, setCompteSearch] = useState('')
  const [sbKey, setSbKey] = useState(defaultSBKey)

  // ── Ventilation automatique par IA (mode « par transaction ») ───────────────
  const [targetMode, setTargetMode] = useState<'common' | 'perTx'>('common')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [txComptes, setTxComptes] = useState<Record<string, string>>({}) // transaction_id → compte.id
  const [txConfiance, setTxConfiance] = useState<Record<string, 'haute' | 'moyenne' | 'faible'>>({})

  // ── Import ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'main' | 'result'>('main')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    deja: number
    errors: { label: string; message: string }[]
  } | null>(null)

  // Sous-budget « général » — cible forcée des comptes de bilan (actif / passif)
  const generalSB = sousBudgets.find(sb => sb.key === generalKey) ?? sousBudgets[0]
  // La règle bilan ne joue que si le plan comporte des comptes actif / passif
  const hasBilanComptes = useMemo(() => comptes.some(c => c.type === 'actif' || c.type === 'passif'), [comptes])
  const isBilanType = compteType === 'actif' || compteType === 'passif'
  // Règle : les comptes de bilan (actif / passif) ne se saisissent que dans le
  // Budget général → sous-budget forcé.
  const effectiveSbKey = isBilanType ? generalKey : sbKey
  const effectiveSB = sousBudgets.find(sb => sb.key === effectiveSbKey) ?? generalSB

  const groupIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of comptes) { if (c.parent_id) s.add(c.parent_id) }
    return s
  }, [comptes])
  // Types de comptes réellement présents (feuilles) — 2 côté association,
  // jusqu'à 4 côté entreprise
  const availableTypes = useMemo(
    () => COMPTE_TYPE_ORDER.filter(t => comptes.some(c => c.type === t && !groupIds.has(c.id))),
    [comptes, groupIds],
  )
  const leafComptes = useMemo(() => {
    const search = compteSearch.trim().toLowerCase()
    return comptes
      .filter(c => c.type === compteType && !groupIds.has(c.id))
      .filter(c => !search || c.numero.toLowerCase().includes(search) || c.libelle.toLowerCase().includes(search))
  }, [comptes, compteType, groupIds, compteSearch])
  // Feuilles de tous les types — pour l'IA et les sélecteurs par transaction
  // (côté entreprise, l'IA peut suggérer un compte de bilan : 2x, 16x…)
  const allLeafComptes = useMemo(() => comptes.filter(c => !groupIds.has(c.id)), [comptes, groupIds])
  const compteById = useMemo(() => new Map(comptes.map(c => [c.id, c])), [comptes])

  const selectedCount = Object.keys(selected).length
  const selectedTxs = useMemo(() => Object.values(selected), [selected])
  const perTxAllAssigned = selectedTxs.every(tx => !!txComptes[tx.transaction_id])

  // ── Chargement des credentials + comptes bancaires ──────────────────────────
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const r = await fetch(`/api/qonto/accounts?organisation_id=${organisationId}`)
      const d = await r.json()
      if (!r.ok) { setAccountsError(d.error ?? 'Erreur lors de la récupération des comptes bancaires.'); return }
      const list: QontoBankAccount[] = d.bank_accounts ?? []
      setAccounts(list)
      setQontoOrgName(d.organization?.name ?? '')
      if (list.length > 0) {
        setAccountId(prevId => prevId && list.some(a => a.id === prevId) ? prevId : list[0].id)
      }
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Erreur réseau.')
    } finally {
      setAccountsLoading(false)
    }
  }, [organisationId])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/qonto/credentials?organisation_id=${organisationId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setConnected(!!d.connected)
        setLoginMasked(d.login_masked ?? null)
        setCredsLoading(false)
      })
      .catch(() => { if (!cancelled) setCredsLoading(false) })
    return () => { cancelled = true }
  }, [organisationId])

  useEffect(() => {
    if (connected) loadAccounts()
  }, [connected, loadAccounts])

  // ── Connexion / déconnexion ─────────────────────────────────────────────────
  async function doConnect() {
    if (!login.trim() || !secretKey.trim()) { setConnError('Identifiant et clé secrète requis.'); return }
    setConnecting(true)
    setConnError(null)
    try {
      const r = await fetch('/api/qonto/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: organisationId, login: login.trim(), secret_key: secretKey.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setConnError(d.error ?? 'Connexion refusée — vérifiez vos identifiants Qonto.'); return }
      // Relecture pour récupérer le login masqué
      const check = await fetch(`/api/qonto/credentials?organisation_id=${organisationId}`).then(x => x.json()).catch(() => ({}))
      setConnected(true)
      setLoginMasked(check.login_masked ?? d.login_masked ?? null)
      setLogin(''); setSecretKey('')
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Erreur réseau.')
    } finally {
      setConnecting(false)
    }
  }

  async function doDisconnect() {
    setConnecting(true)
    setConnError(null)
    try {
      const r = await fetch(`/api/qonto/credentials?organisation_id=${organisationId}`, { method: 'DELETE' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setConnError(d.error ?? 'Erreur lors de la déconnexion.')
        return
      }
      setConnected(false)
      setLoginMasked(null)
      setAccounts([]); setAccountId('')
      setTxs([]); setMeta(null); setSelected({}); setHasFetched(false)
    } finally {
      setConnecting(false)
      setConfirmDisconnect(false)
    }
  }

  // ── Récupération des transactions (toutes les pages Qonto — 100/page max) ────
  const MAX_PAGES = 50
  const fetchTxs = useCallback(async () => {
    if (!accountId) return
    setFetching(true)
    setFetchError(null)
    try {
      const all: QontoTx[] = []
      let page = 1
      let lastMeta: QontoTxMeta | null = null
      for (let i = 0; i < MAX_PAGES; i++) {
        const params = new URLSearchParams({
          organisation_id: organisationId,
          bank_account_id: accountId,
          settled_from: fromDate,
          settled_to: toDate,
          page: String(page),
        })
        if (sideFilter) params.set('side', sideFilter)
        const r = await fetch(`/api/qonto/transactions?${params.toString()}`)
        const d = await r.json()
        if (!r.ok) { setFetchError(d.error ?? 'Erreur lors de la récupération des transactions.'); return }
        all.push(...(d.transactions ?? []))
        lastMeta = d.meta ?? null
        setTxs([...all]) // affichage progressif pendant le chargement
        if (!lastMeta?.next_page) break
        page = lastMeta.next_page
      }
      if (lastMeta?.next_page) {
        setFetchError(`Liste tronquée à ${all.length} transactions (${lastMeta.total_count} au total) — resserrez les dates pour tout couvrir.`)
      }
      setMeta(lastMeta)
      setHasFetched(true)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Erreur réseau.')
    } finally {
      setFetching(false)
    }
  }, [organisationId, accountId, fromDate, toDate, sideFilter])

  function toggleTx(tx: QontoTx) {
    setSelected(prev => {
      const next = { ...prev }
      if (next[tx.transaction_id]) delete next[tx.transaction_id]
      else next[tx.transaction_id] = tx
      return next
    })
  }
  const allPageSelected = txs.length > 0 && txs.every(tx => selected[tx.transaction_id])
  function togglePage() {
    setSelected(prev => {
      const next = { ...prev }
      if (allPageSelected) { for (const tx of txs) delete next[tx.transaction_id] }
      else { for (const tx of txs) next[tx.transaction_id] = tx }
      return next
    })
  }

  /** Body du POST /lignes : affectation du sous-budget effectif (action_id / centre_cout_id). */
  function ligneBody(cId: string, sb: QontoSousBudget): Record<string, unknown> {
    return {
      exercice_id: exercice.id,
      compte_id: cId,
      affectation_type: sb.affectation_type,
      [sb.refField]: sb.refId ?? null,
      montant_previsionnel: 0,
    }
  }

  // ── Import (cible commune) ──────────────────────────────────────────────────
  async function doImport() {
    const txList = Object.values(selected)
    if (txList.length === 0 || !compteId) return
    setImporting(true)

    const errors: { label: string; message: string }[] = []
    let imported = 0
    let deja = 0

    // 1) Garantir la ligne budgétaire cible (POST /lignes = upsert)
    const rl = await fetch(`${apiBase}/lignes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ligneBody(compteId, effectiveSB)),
    })
    const dl = await rl.json().catch(() => ({}))
    if (!rl.ok || !dl.id) {
      setImportResult({ imported: 0, deja: 0, errors: [{ label: 'Ligne budgétaire', message: dl.error ?? 'Impossible de créer la ligne budgétaire cible.' }] })
      setStep('result')
      setImporting(false)
      return
    }
    const ligneId: string = dl.id

    // 2) Une ligne de détail par transaction (409 = déjà importée)
    for (const tx of txList) {
      const dateStr = fmtQDate(tx.settled_at ?? tx.emitted_at)
      try {
        const r = await fetch(`${apiBase}/lignes-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ligne_id: ligneId,
            commentaire: `${dateStr} — ${tx.label}`,
            montant_previsionnel: 0,
            montant_realise: Math.abs(tx.amount),
            qonto_transaction_id: tx.transaction_id,
          }),
        })
        if (r.ok) imported++
        else if (r.status === 409) deja++
        else {
          const d = await r.json().catch(() => ({}))
          errors.push({ label: tx.label, message: d.error ?? `Erreur ${r.status}` })
        }
      } catch (e) {
        errors.push({ label: tx.label, message: e instanceof Error ? e.message : 'Erreur réseau' })
      }
    }

    setImportResult({ imported, deja, errors })
    setStep('result')
    setImporting(false)
    if (imported > 0) onImported()
  }

  // ── Ventilation automatique : l'IA suggère un compte par transaction, puis
  // bascule en mode « par transaction » (corrections manuelles possibles) ──────
  async function doVentilation() {
    if (selectedTxs.length === 0 || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    try {
      const r = await fetch('/api/qonto/suggest-comptes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation_id: organisationId,
          plan,
          transactions: selectedTxs.map(tx => ({
            transaction_id: tx.transaction_id,
            label: tx.label,
            category: tx.category,
            side: tx.side,
            amount: Math.abs(tx.amount),
          })),
          comptes: allLeafComptes.map(c => ({
            numero: c.numero,
            nom: c.libelle,
            // Le plan associatif étiquette ses comptes « charges / produits »
            type: plan === 'association' ? (c.type === 'charge' ? 'charges' : 'produits') : c.type,
          })),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setAiError(d.error ?? (r.status === 503
          ? 'Ventilation automatique indisponible — clé IA non configurée.'
          : `Erreur ${r.status} lors de la ventilation automatique.`))
        return
      }
      const byNumero = new Map(allLeafComptes.map(c => [c.numero, c]))
      const nextComptes: Record<string, string> = {}
      const nextConf: Record<string, 'haute' | 'moyenne' | 'faible'> = {}
      for (const tx of selectedTxs) {
        const sug = d.suggestions?.[tx.transaction_id]
        const c = sug ? byNumero.get(sug.numero) : undefined
        if (c) {
          nextComptes[tx.transaction_id] = c.id
          nextConf[tx.transaction_id] = sug.confiance
        }
      }
      setTxComptes(nextComptes)
      setTxConfiance(nextConf)
      setTargetMode('perTx')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erreur réseau.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Import « par transaction » : upsert d'une ligne budgétaire par couple
  // (compte × affectation effective) — cache Map pour mutualiser — puis une
  // ligne de détail par transaction (409 = déjà importée). Règle comptable :
  // un compte de bilan (actif / passif) va toujours au Budget général, quel
  // que soit le sous-budget commun choisi. ─────────────────────────────────────
  async function doImportPerTx() {
    if (selectedTxs.length === 0 || !perTxAllAssigned) return
    setImporting(true)

    const errors: { label: string; message: string }[] = []
    let imported = 0
    let deja = 0
    const commonSB = sousBudgets.find(sb => sb.key === sbKey) ?? generalSB
    const ligneCache = new Map<string, string>() // `${compte_id}|${affectation}|${ref}` → ligne_id

    for (const tx of selectedTxs) {
      const cId = txComptes[tx.transaction_id]
      const compte = compteById.get(cId)
      const bilan = compte?.type === 'actif' || compte?.type === 'passif'
      const sb = bilan ? generalSB : commonSB
      const cacheKey = `${cId}|${sb.affectation_type}|${sb.refId ?? ''}`
      try {
        let ligneId = ligneCache.get(cacheKey)
        if (!ligneId) {
          const rl = await fetch(`${apiBase}/lignes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ligneBody(cId, sb)),
          })
          const dl = await rl.json().catch(() => ({}))
          if (!rl.ok || !dl.id) {
            errors.push({ label: tx.label, message: dl.error ?? 'Impossible de créer la ligne budgétaire cible.' })
            continue
          }
          ligneId = dl.id as string
          ligneCache.set(cacheKey, ligneId)
        }
        const dateStr = fmtQDate(tx.settled_at ?? tx.emitted_at)
        const r = await fetch(`${apiBase}/lignes-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ligne_id: ligneId,
            commentaire: `${dateStr} — ${tx.label}`,
            montant_previsionnel: 0,
            montant_realise: Math.abs(tx.amount),
            qonto_transaction_id: tx.transaction_id,
          }),
        })
        if (r.ok) imported++
        else if (r.status === 409) deja++
        else {
          const d = await r.json().catch(() => ({}))
          errors.push({ label: tx.label, message: d.error ?? `Erreur ${r.status}` })
        }
      } catch (e) {
        errors.push({ label: tx.label, message: e instanceof Error ? e.message : 'Erreur réseau' })
      }
    }

    setImportResult({ imported, deja, errors })
    setStep('result')
    setImporting(false)
    if (imported > 0) onImported()
  }

  const canImport = selectedCount > 0 && !importing &&
    (targetMode === 'perTx' ? perTxAllAssigned : !!compteId)

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 820 }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>🏦 Import Qonto</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {step === 'result'
                ? 'Compte-rendu de l’import'
                : 'Importer les transactions bancaires dans le réalisé de l’exercice'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {step === 'main' && credsLoading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vérification de la connexion Qonto…</div>
          )}

          {/* ── 1. Connexion ── */}
          {step === 'main' && !credsLoading && !connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '0.75rem', padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: '0.35rem' }}>Connexion à Qonto</div>
                Récupérez votre identifiant et votre clé secrète dans <strong>Réglages → API &amp; intégrations</strong> de votre espace Qonto.
                <div style={{ marginTop: '0.35rem' }}>
                  Ces identifiants sont propres à <strong>{orgName}</strong> et sont stockés chiffrés.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Identifiant (login)</label>
                  <input style={inp} value={login} placeholder={plan === 'entreprise' ? 'ex : mon-entreprise-1234' : 'ex : mon-organisation-1234'}
                    onChange={e => setLogin(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doConnect() }} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Clé secrète</label>
                  <input style={inp} type="password" value={secretKey} placeholder="••••••••••••"
                    onChange={e => setSecretKey(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doConnect() }} />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button onClick={doConnect} disabled={connecting}
                    style={{ ...btnPrimary, opacity: connecting ? 0.6 : 1, cursor: connecting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {connecting ? 'Connexion…' : '🔐 Se connecter'}
                  </button>
                </div>
              </div>
              {connError && (
                <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>⚠️ {connError}</div>
              )}
            </div>
          )}

          {/* ── Bandeau connecté ── */}
          {step === 'main' && !credsLoading && connected && (
            <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}40`, borderRadius: '0.75rem', padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', color: GREEN, fontWeight: 600 }}>
                ✓ Connecté à Qonto{loginMasked ? <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem' }}>({loginMasked})</span> : null}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.4rem' }}>
                  — identifiants de {orgName}{qontoOrgName ? ` · ${qontoOrgName}` : ''}
                </span>
              </div>
              {confirmDisconnect ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Supprimer les identifiants ?</span>
                  <button onClick={doDisconnect} disabled={connecting}
                    style={{ background: RED, color: '#fff', border: 'none', borderRadius: '0.4rem', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                    {connecting ? '…' : 'Oui, déconnecter'}
                  </button>
                  <button onClick={() => setConfirmDisconnect(false)}
                    style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '0.4rem', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                    Annuler
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDisconnect(true)}
                  style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '0.4rem', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Déconnecter
                </button>
              )}
            </div>
          )}
          {step === 'main' && connected && connError && (
            <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>⚠️ {connError}</div>
          )}

          {/* ── 2. Compte bancaire ── */}
          {step === 'main' && connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compte bancaire</label>
              {accountsLoading && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Chargement des comptes…</div>}
              {accountsError && (
                <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>⚠️ {accountsError}</div>
              )}
              {!accountsLoading && !accountsError && accounts.length === 0 && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Aucun compte bancaire trouvé.</div>
              )}
              {accounts.length > 0 && (
                <select style={inp} value={accountId}
                  onChange={e => { setAccountId(e.target.value); setTxs([]); setMeta(null); setHasFetched(false) }}>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {maskIban(a.iban)} · {a.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {a.currency === 'EUR' ? '€' : a.currency}{a.status !== 'active' ? ` · ${a.status}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── 3. Filtres + transactions ── */}
          {step === 'main' && connected && accountId && (
            <>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Du</label>
                  <input type="date" style={{ ...inp, width: 150 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Au</label>
                  <input type="date" style={{ ...inp, width: 150 }} value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Sens</label>
                  <select style={{ ...inp, width: 160 }} value={sideFilter}
                    onChange={e => {
                      const v = e.target.value as '' | 'debit' | 'credit'
                      setSideFilter(v)
                      // Par défaut : débit → charge, crédit → produit (si aucun compte déjà choisi)
                      if (!compteId) {
                        if (v === 'credit') setCompteType('produit')
                        else if (v === 'debit') setCompteType('charge')
                      }
                    }}>
                    <option value="">Débits + crédits</option>
                    <option value="debit">Débits (sorties)</option>
                    <option value="credit">Crédits (entrées)</option>
                  </select>
                </div>
                <button onClick={() => fetchTxs()} disabled={fetching}
                  style={{ ...btnPrimary, opacity: fetching ? 0.6 : 1, cursor: fetching ? 'not-allowed' : 'pointer' }}>
                  {fetching ? 'Chargement…' : '🔄 Récupérer'}
                </button>
              </div>

              {fetchError && (
                <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>⚠️ {fetchError}</div>
              )}

              {hasFetched && !fetchError && txs.length === 0 && !fetching && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Aucune transaction sur cette période.
                </div>
              )}

              {txs.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  {/* Ascenseur interne : la liste défile, l'en-tête reste visible (sticky) */}
                  <div style={{ maxHeight: 'min(45vh, 480px)', overflowY: 'auto', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStickyQ, padding: '0.4rem 0.6rem', width: 32 }}>
                            <input type="checkbox" checked={allPageSelected} onChange={togglePage} style={{ cursor: 'pointer' }} />
                          </th>
                          <th style={{ ...thStickyQ, padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Date</th>
                          <th style={{ ...thStickyQ, padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Libellé</th>
                          <th style={{ ...thStickyQ, padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Catégorie</th>
                          <th style={{ ...thStickyQ, padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.map(tx => {
                          const isSel = !!selected[tx.transaction_id]
                          return (
                            <tr key={tx.transaction_id}
                              onClick={() => toggleTx(tx)}
                              style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSel ? 'rgba(99,102,241,0.07)' : 'transparent' }}>
                              <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                                <input type="checkbox" checked={isSel} onChange={() => toggleTx(tx)} onClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }} />
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtQDate(tx.settled_at ?? tx.emitted_at)}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.label}>
                                {tx.label}
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem' }}>
                                {tx.category && (
                                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '0.4rem', background: 'var(--bg)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {tx.category}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: tx.side === 'debit' ? RED : GREEN }}>
                                {fmtQAmount(tx.amount, tx.side)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {meta && (
                    <div style={{ padding: '0.4rem 0.75rem', background: 'var(--bg)', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {txs.length} transaction(s) chargée(s) sur {meta.total_count}
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. Cible d'import ── */}
              {selectedCount > 0 && (
                <div style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', borderRadius: '0.75rem', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🎯 Cible d’import — {selectedCount} transaction(s) sélectionnée(s)
                    </div>
                    {targetMode === 'common' ? (
                      <button onClick={doVentilation} disabled={aiLoading}
                        style={{ ...btnGhost, padding: '0.35rem 0.75rem', fontSize: '0.78rem', opacity: aiLoading ? 0.6 : 1, cursor: aiLoading ? 'not-allowed' : 'pointer' }}>
                        {aiLoading ? '🪄 Analyse…' : '🪄 Ventilation automatique'}
                      </button>
                    ) : (
                      <button onClick={() => setTargetMode('common')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, padding: 0 }}>
                        ← Revenir à la cible commune
                      </button>
                    )}
                  </div>
                  {aiError && (
                    <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>⚠️ {aiError}</div>
                  )}

                  {targetMode === 'common' && (
                    <>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 170px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Type de compte</label>
                          <select style={inp} value={compteType}
                            onChange={e => { setCompteType(e.target.value); setCompteId(''); setCompteSearch('') }}>
                            {availableTypes.map(t => (
                              <option key={t} value={t}>{COMPTE_TYPE_LABEL[t]}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Sous-budget</label>
                          <select style={{ ...inp, opacity: isBilanType ? 0.6 : 1 }} value={effectiveSbKey} disabled={isBilanType}
                            onChange={e => setSbKey(e.target.value)}>
                            {sousBudgets.map(sb => (
                              <option key={sb.key} value={sb.key}>{sb.icon ? `${sb.icon} ` : ''}{sb.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {isBilanType && (
                        <div style={{ fontSize: '0.75rem', color: AMBER, background: AMBER_BG, borderRadius: '0.5rem', padding: '0.4rem 0.6rem' }}>
                          ⚠️ Les comptes de bilan (actif / passif) ne se saisissent que dans les « Comptes de bilan » du {generalSB.label} — sous-budget forcé.
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Compte cible</label>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <input style={{ ...inp, flex: '1 1 160px' }} value={compteSearch} placeholder="Filtrer par numéro ou libellé…"
                            onChange={e => setCompteSearch(e.target.value)} />
                          <select style={{ ...inp, flex: '2 1 240px', borderColor: compteId ? 'var(--border)' : `${RED}80` }} value={compteId}
                            onChange={e => setCompteId(e.target.value)}>
                            <option value="">— Choisir un compte ({leafComptes.length}) —</option>
                            {leafComptes.map(c => (
                              <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Chaque transaction devient une ligne de détail « date — libellé » dans le <strong>réalisé</strong> du compte choisi
                        ({effectiveSB.icon ? `${effectiveSB.icon} ` : ''}{effectiveSB.label}). Les transactions déjà importées seront ignorées.
                      </div>
                    </>
                  )}

                  {/* ── Mode « par transaction » (ventilation IA, corrections manuelles) ── */}
                  {targetMode === 'perTx' && (
                    <>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 220px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                            {hasBilanComptes ? 'Sous-budget (charges / produits)' : 'Sous-budget'}
                          </label>
                          <select style={inp} value={sbKey} onChange={e => setSbKey(e.target.value)}>
                            {sousBudgets.map(sb => (
                              <option key={sb.key} value={sb.key}>{sb.icon ? `${sb.icon} ` : ''}{sb.label}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={doVentilation} disabled={aiLoading}
                          style={{ ...btnGhost, padding: '0.45rem 0.75rem', fontSize: '0.78rem', opacity: aiLoading ? 0.6 : 1, cursor: aiLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          {aiLoading ? '🪄 Analyse…' : '🪄 Relancer l’analyse'}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {hasBilanComptes ? (
                          <>Un compte par transaction — les écritures sur un compte de <strong>bilan</strong> (actif / passif : immobilisation 2x, emprunt 16x…)
                            vont toujours au {generalSB.icon ? `${generalSB.icon} ` : ''}{generalSB.label}, quel que soit le sous-budget choisi.</>
                        ) : (
                          <>Un compte par transaction — chaque écriture sera importée en <strong>Réalisé</strong> sur son compte
                            (sous-budget commun ci-dessus). Corrigez les suggestions si besoin avant d’importer.</>
                        )}
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: '0.6rem', overflow: 'hidden', background: 'var(--bg-card)' }}>
                        <div style={{ maxHeight: 'min(40vh, 420px)', overflowY: 'auto', overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStickyQ, padding: '0.35rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Transaction</th>
                                <th style={{ ...thStickyQ, padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Montant</th>
                                <th style={{ ...thStickyQ, padding: '0.35rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Compte</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedTxs.map(tx => {
                                const cId = txComptes[tx.transaction_id] ?? ''
                                const compte = cId ? compteById.get(cId) : undefined
                                const conf = txConfiance[tx.transaction_id]
                                const bilan = compte?.type === 'actif' || compte?.type === 'passif'
                                return (
                                  <tr key={tx.transaction_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.35rem 0.6rem', maxWidth: 240 }}>
                                      <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.label}>{tx.label}</div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtQDate(tx.settled_at ?? tx.emitted_at)}{tx.category ? ` · ${tx.category}` : ''}</div>
                                    </td>
                                    <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: tx.side === 'debit' ? RED : GREEN }}>
                                      {fmtQAmount(tx.amount, tx.side)}
                                    </td>
                                    <td style={{ padding: '0.35rem 0.6rem', minWidth: 240 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <select value={cId}
                                          style={{ ...inp, flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.76rem', borderColor: cId ? 'var(--border)' : `${RED}80`, background: cId ? 'var(--bg-card)' : RED_BG }}
                                          onChange={e => {
                                            const v = e.target.value
                                            setTxComptes(prev => ({ ...prev, [tx.transaction_id]: v }))
                                            // Correction manuelle → le badge de confiance IA n'a plus de sens
                                            setTxConfiance(prev => { const n = { ...prev }; delete n[tx.transaction_id]; return n })
                                          }}>
                                          <option value="">— Choisir un compte —</option>
                                          {availableTypes.map(t => {
                                            const list = allLeafComptes.filter(c => c.type === t)
                                            if (list.length === 0) return null
                                            return (
                                              <optgroup key={t} label={COMPTE_TYPE_LABEL[t]}>
                                                {list.map(c => (
                                                  <option key={c.id} value={c.id}>{c.numero} — {c.libelle}</option>
                                                ))}
                                              </optgroup>
                                            )
                                          })}
                                        </select>
                                        {conf && (
                                          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: '0.4rem', whiteSpace: 'nowrap', color: CONFIANCE_STYLE[conf].color, background: CONFIANCE_STYLE[conf].bg }}>
                                            {conf}
                                          </span>
                                        )}
                                      </div>
                                      {bilan && (
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>→ {generalSB.icon ? `${generalSB.icon} ` : ''}{generalSB.label} (compte de bilan)</div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {!perTxAllAssigned && (
                        <div style={{ fontSize: '0.75rem', color: AMBER, background: AMBER_BG, borderRadius: '0.5rem', padding: '0.4rem 0.6rem' }}>
                          ⚠️ Choisissez un compte pour chaque transaction avant d’importer.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Compte-rendu ── */}
          {step === 'result' && importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 150px', background: importResult.imported > 0 ? GREEN_BG : 'var(--bg)', border: `1px solid ${importResult.imported > 0 ? `${GREEN}40` : 'var(--border)'}`, borderRadius: '0.75rem', padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: importResult.imported > 0 ? GREEN : 'var(--text-muted)' }}>{importResult.imported}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>importée(s)</div>
                </div>
                <div style={{ flex: '1 1 150px', background: importResult.deja > 0 ? AMBER_BG : 'var(--bg)', border: `1px solid ${importResult.deja > 0 ? `${AMBER}40` : 'var(--border)'}`, borderRadius: '0.75rem', padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: importResult.deja > 0 ? AMBER : 'var(--text-muted)' }}>{importResult.deja}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>déjà importée(s)</div>
                </div>
                <div style={{ flex: '1 1 150px', background: importResult.errors.length > 0 ? RED_BG : 'var(--bg)', border: `1px solid ${importResult.errors.length > 0 ? `${RED}40` : 'var(--border)'}`, borderRadius: '0.75rem', padding: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: importResult.errors.length > 0 ? RED : 'var(--text-muted)' }}>{importResult.errors.length}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>erreur(s)</div>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div style={{ background: RED_BG, border: `1px solid ${RED}40`, borderRadius: '0.5rem', padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: RED }}>
                  {importResult.errors.map((e, i) => (
                    <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}><strong>{e.label}</strong> — {e.message}</div>
                  ))}
                </div>
              )}
              {importResult.imported > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {plan === 'entreprise'
                    ? 'Le réalisé de l’exercice a été mis à jour — les vues Compte de résultat et Bilan sont recalculées automatiquement.'
                    : 'Le réalisé de l’exercice a été mis à jour.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {step === 'main' && (
            <>
              <button onClick={onClose} style={btnGhost}>Annuler</button>
              <button onClick={targetMode === 'perTx' ? doImportPerTx : doImport} disabled={!canImport}
                style={{ ...btnPrimary, opacity: canImport ? 1 : 0.5, cursor: canImport ? 'pointer' : 'not-allowed' }}>
                {importing ? 'Import en cours…' : `🏦 Importer ${selectedCount} transaction(s)`}
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              <button onClick={() => {
                setStep('main'); setImportResult(null); setSelected({})
                setTargetMode('common'); setTxComptes({}); setTxConfiance({}); setAiError(null)
                if (accountId) fetchTxs()
              }} style={btnGhost}>
                ← Nouvel import
              </button>
              <button onClick={onClose} style={btnPrimary}>Fermer</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
