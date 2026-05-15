'use client'

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import Sidebar from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { useApps } from '@/hooks/useApps'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const { categories } = useApps(isAdmin)

  // Sidebar desktop : collapsed ou non
  const [collapsed, setCollapsed] = useState(false)
  // Mobile : drawer ouvert ou non
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fermer le drawer mobile sur resize vers desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const SIDEBAR_W = collapsed ? 'w-16' : 'w-60'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar DESKTOP ── */}
      <aside
        className={clsx(
          'hidden md:flex flex-col flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-200 relative',
          SIDEBAR_W
        )}
      >
        {/* Bouton toggle collapse */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={12} className="text-gray-500" />
        </button>

        <Sidebar
          collapsed={collapsed}
          categories={categories}
        />
      </aside>

      {/* ── Drawer MOBILE ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            {/* Header du drawer */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-900">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <Icon name="x" size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                collapsed={false}
                categories={categories}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── Zone principale ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* TopBar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          {/* Hamburger (mobile) */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" size={20} className="text-gray-600" />
          </button>

          <div className="flex-1" />

          {/* Utilisateur + déconnexion */}
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900 leading-tight">
                  {profile.full_name ?? profile.email}
                </span>
                {isAdmin && (
                  <span className="text-[11px] text-amber-600 font-medium">Administrateur</span>
                )}
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {(profile?.full_name ?? profile?.email ?? 'U')[0].toUpperCase()}
              </span>
            </div>
            <button
              onClick={signOut}
              title="Se déconnecter"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
