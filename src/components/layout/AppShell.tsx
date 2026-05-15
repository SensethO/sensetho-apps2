'use client'

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { useAuth } from '@/hooks/useAuth'
import { useApps } from '@/hooks/useApps'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const { categories } = useApps(isAdmin)
  const { ticketCount, quoteCount } = useAdminNotifications(isAdmin)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const SIDEBAR_W = collapsed ? 'w-16' : 'w-60'

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Sidebar DESKTOP ── */}
      <aside className={clsx(
        'hidden md:flex flex-col flex-shrink-0 border-r transition-all duration-200 relative',
        SIDEBAR_W
      )} style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border flex items-center justify-center shadow-sm hover:opacity-80 transition-colors"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={12} />
        </button>
        <Sidebar
          collapsed={collapsed}
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

          {/* Toggle thème */}
          <ThemeToggle />

          {/* Badges admin */}
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

        {/* Contenu + Footer */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
