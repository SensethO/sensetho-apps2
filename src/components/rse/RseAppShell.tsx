'use client'

import { useState } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import Sidebar from '@/components/layout/Sidebar'
import Footer from '@/components/layout/Footer'
import OrganisationsSidebar from './OrganisationsSidebar'
import RseHeader from './RseHeader'
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
}

interface RseAppShellProps {
  /** Slug unique de l'app (ex: 'bpi-excellence', 'iso26000') */
  appSlug: string
  children: (ctx: RseContext) => React.ReactNode
}

/**
 * Layout pour toutes les applications RSE.
 * Fournit : navigation principale + sidebar Organisations + header avec sélecteur d'années.
 * Le contenu reçoit l'organisation sélectionnée et l'année active via le render prop.
 */
export default function RseAppShell({ appSlug, children }: RseAppShellProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const { categories } = useApps(isAdmin)
  const { ticketCount, quoteCount } = useAdminNotifications(isAdmin)
  const { organisations, loading, save, saveManual, remove } = useOrganisations()

  const [navCollapsed, setNavCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null)
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null)

  const { years, selectedYear, setSelectedYear, addYear } = useRseYears({
    organisationId: selectedOrg?.id ?? null,
    appSlug,
  })

  const NAV_W = navCollapsed ? 'w-16' : 'w-60'

  const ctx: RseContext = {
    org: selectedOrg,
    year: selectedYear,
    setActions: setHeaderActions,
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
        <header className="h-14 border-b flex items-center px-4 gap-3 flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
          <button className="md:hidden p-1.5 rounded-lg hover:opacity-70 transition-colors"
            onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-muted)' }}>
            <Icon name="menu" size={20} />
          </button>
          <div className="flex-1" />
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
              onAddYear={addYear}
              actions={headerActions}
            />
            <main className="flex-1 overflow-y-auto p-6">
              {children(ctx)}
            </main>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}
