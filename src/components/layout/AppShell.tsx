'use client'

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { useAuth } from '@/hooks/useAuth'
import { useApps } from '@/hooks/useApps'
import { useTicketCount } from '@/hooks/useTicketCount'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const { categories } = useApps(isAdmin)
  const ticketCount = useTicketCount(isAdmin)

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

          {/* Badge tickets admin */}
          {isAdmin && ticketCount > 0 && (
            <a href="/admin/tickets"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium hover:bg-red-100 transition-colors">
              <Icon name="bell" size={13} />
              {ticketCount} ticket{ticketCount > 1 ? 's' : ''}
            </a>
          )}

          {/* Utilisateur */}
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium leading-tight" style={{ color: 'var(--text)' }}>
                  {profile.full_name ?? profile.email}
                </span>
                {isAdmin && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Administrateur</span>}
              </div>
            )}
            <a href="/account"
              className="w-8 h-8 rounded-full bg-gray-900 dark:bg-slate-600 flex items-center justify-center hover:opacity-80 transition-opacity"
              title="Mon compte">
              <span className="text-white text-xs font-semibold">
                {(profile?.full_name ?? profile?.email ?? 'U')[0].toUpperCase()}
              </span>
            </a>
            <button onClick={signOut} title="Se déconnecter"
              className="p-1.5 rounded-lg hover:opacity-70 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Icon name="logout" size={18} />
            </button>
          </div>
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
