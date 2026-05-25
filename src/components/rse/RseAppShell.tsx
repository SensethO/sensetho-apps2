'use client'

import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import Sidebar from '@/components/layout/Sidebar'
import Footer from '@/components/layout/Footer'
import OrganisationsSidebar from './OrganisationsSidebar'
import RseHeader from './RseHeader'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useApps } from '@/hooks/useApps'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useOrganisations } from '@/hooks/useOrganisations'
import { useRseYears } from '@/hooks/useRseYears'
import type { Organisation } from '@/types/organisation'

export interface RseContext {
  org: Organisation | null
  year: number
  /** Slot pour injecter le bouton Enregistrer dans le header */
  setActions: (node: React.ReactNode) => void
  /**
   * Enregistre un handler appelé quand l'utilisateur décale l'année de départ.
   * delta = newStartYear - oldStartYear (peut être négatif).
   * L'app doit mettre à jour ses données en base pour refléter le décalage.
   */
  setYearShiftHandler: (fn: ((delta: number) => Promise<void>) | null) => void
}

interface RseAppShellProps {
  /** Slug unique de l'app (ex: 'bpi-excellence', 'iso26000') */
  appSlug: string
  /** Titre affiché dans le bandeau supérieur */
  title?: string
  children: (ctx: RseContext) => React.ReactNode
}

// ── Prompt première année ─────────────────────────────────────────────────────

function FirstYearPrompt({ orgName, onConfirm }: { orgName: string; onConfirm: (year: number) => Promise<void> }) {
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)

  async function handleStart() {
    const y = parseInt(yearInput)
    if (isNaN(y) || y < 2000 || y > 2100) return
    setSaving(true)
    await onConfirm(y)
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="rounded-xl border p-8 max-w-sm w-full text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="text-4xl mb-4">📅</div>
        <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text)' }}>
          Première année de suivi
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Choisissez l&apos;année de départ pour<br />
          <strong style={{ color: 'var(--text)' }}>{orgName}</strong>
        </p>
        <div className="flex gap-2 justify-center">
          <input
            type="number"
            value={yearInput}
            onChange={e => setYearInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            className="w-24 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            min={2000} max={2100}
            autoFocus
          />
          <button
            onClick={handleStart}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #6366f1)' }}
          >
            {saving ? '…' : 'Démarrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shell principal ───────────────────────────────────────────────────────────

/**
 * Layout pour toutes les applications RSE.
 * Fournit : navigation principale + sidebar Organisations + header avec sélecteur d'années.
 * Le contenu reçoit l'organisation sélectionnée et l'année active via le render prop.
 */
/** Clé localStorage — même organisation conservée en naviguant entre apps RSE */
const LAST_RSE_ORG_KEY = 'rse_last_org_id'

export default function RseAppShell({ appSlug, title, children }: RseAppShellProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const { categories } = useApps(isAdmin)
  const { ticketCount, quoteCount } = useAdminNotifications(isAdmin)
  const { organisations, loading, save, saveManual, remove } = useOrganisations()

  const [navCollapsed, setNavCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null)
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null)

  // ── Persistance de l'organisation entre les apps RSE ──────────────────────
  // Règle universelle RSE : si l'utilisateur avait sélectionné une organisation,
  // elle doit rester sélectionnée lorsqu'il change d'application RSE.

  /** Sauvegarde l'id de l'org sélectionnée */
  useEffect(() => {
    try { if (selectedOrg) localStorage.setItem(LAST_RSE_ORG_KEY, selectedOrg.id) } catch {}
  }, [selectedOrg])

  /** Auto-sélectionne l'org mémorisée dès que la liste est disponible */
  useEffect(() => {
    if (selectedOrg || loading || organisations.length === 0) return
    try {
      const savedId = localStorage.getItem(LAST_RSE_ORG_KEY)
      if (savedId) {
        const found = organisations.find(o => o.id === savedId)
        if (found) setSelectedOrg(found)
      }
    } catch {}
  }, [organisations, loading, selectedOrg])

  const { years, selectedYear, setSelectedYear, addYear, addNextYear, changeStartYear, loading: yearsLoading } = useRseYears({
    organisationId: selectedOrg?.id ?? null,
    appSlug,
  })

  /** Handler enregistré par l'app enfant pour décaler ses données quand l'année de départ change */
  const yearShiftHandlerRef = useRef<((delta: number) => Promise<void>) | null>(null)

  /** Décale les années ET les données de l'app (dans le bon ordre) */
  async function handleChangeStartYear(newStartYear: number) {
    if (years.length === 0) return
    const minYear = Math.min(...years)
    const delta = newStartYear - minYear
    if (delta === 0) return

    // ⚠️ Ordre critique : décaler les données EN PREMIER, avant que selectedYear
    // ne change (ce qui déclencherait un rechargement sur l'ancienne clé).
    if (yearShiftHandlerRef.current) {
      await yearShiftHandlerRef.current(delta)
    }

    // Puis décaler les rse_years → met à jour years + selectedYear → recharge le contenu
    await changeStartYear(newStartYear)
  }

  const NAV_W = navCollapsed ? 'w-16' : 'w-60'

  // Résolution de l'app courante pour récupérer son icône (même que la sidebar)
  const currentApp = categories.flatMap(c => c.apps ?? []).find(a => a.slug === appSlug)

  const ctx: RseContext = {
    org: selectedOrg,
    year: selectedYear,
    setActions: setHeaderActions,
    setYearShiftHandler: (fn) => { yearShiftHandlerRef.current = fn },
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Sidebar navigation DESKTOP ── */}
      <aside className={clsx(
        'hidden md:flex flex-col flex-shrink-0 border-r transition-all duration-200 relative',
        NAV_W
      )} style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
        <button
          onClick={() => setNavCollapsed(v => !v)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border flex items-center justify-center shadow-sm hover:opacity-80 transition-colors"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title={navCollapsed ? 'Déplier' : 'Replier'}
        >
          <Icon name={navCollapsed ? 'chevronRight' : 'chevronLeft'} size={12} />
        </button>
        <Sidebar
          collapsed={navCollapsed}
          categories={categories}
          ticketCount={ticketCount}
          quoteCount={quoteCount}
          profile={profile}
          isAdmin={isAdmin}
          onSignOut={signOut}
        />
      </aside>

      {/* ── Drawer MOBILE ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 shadow-xl flex flex-col"
            style={{ backgroundColor: 'var(--bg-sidebar)' }}>
            <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                collapsed={false}
                categories={categories}
                ticketCount={ticketCount}
                quoteCount={quoteCount}
                profile={profile}
                isAdmin={isAdmin}
                onSignOut={signOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── Zone principale ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* TopBar */}
        <header className="relative h-14 border-b flex items-center px-4 gap-3 flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
          <button className="md:hidden p-1.5 rounded-lg hover:opacity-70 transition-colors"
            onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-muted)' }}>
            <Icon name="menu" size={20} />
          </button>

          {/* Titre centré — absolu pour ne pas dépendre des items gauche/droite */}
          {(title ?? currentApp?.name) && (() => {
            const label = title ?? currentApp?.name ?? ''
            const iconName = currentApp?.icon
            return (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className="flex items-center gap-2">
                  {iconName && (
                    <Icon name={iconName} size={17} style={{ color: 'var(--accent)' }} />
                  )}
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {label}
                  </span>
                </div>
              </div>
            )
          })()}

          <div className="flex-1" />
          {/* Toggle thème */}
          <ThemeToggle />
          {isAdmin && ticketCount > 0 && (
            <a href="/admin/tickets"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
              <Icon name="ticket" size={13} />
              {ticketCount} ticket{ticketCount > 1 ? 's' : ''}
            </a>
          )}
          {isAdmin && quoteCount > 0 && (
            <a href="/admin/quotes"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
              <Icon name="fileText" size={13} />
              {quoteCount} devis
            </a>
          )}
        </header>

        {/* Contenu RSE : OrganisationsSidebar + colonne droite */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <OrganisationsSidebar
            organisations={organisations}
            selected={selectedOrg}
            onSelect={setSelectedOrg}
            onSave={save}
            onSaveManual={saveManual}
            onRemove={remove}
            loading={loading}
          />

          {/* Colonne contenu : header org/années + contenu app */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <RseHeader
              organisation={selectedOrg}
              years={years}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              onAddNextYear={addNextYear}
              onChangeStartYear={handleChangeStartYear}
              actions={headerActions}
            />
            <main className="flex-1 overflow-y-auto p-6">
              {/* Si org sélectionnée mais aucune année configurée → forcer le choix d'une année */}
              {selectedOrg && !yearsLoading && years.length === 0 ? (
                <FirstYearPrompt
                  orgName={selectedOrg.denomination}
                  onConfirm={(y) => addYear(y)}
                />
              ) : (
                children(ctx)
              )}
            </main>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}
