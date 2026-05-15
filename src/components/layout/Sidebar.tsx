'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import type { AppCategory, Profile } from '@/types'

interface SidebarProps {
  collapsed: boolean
  categories: AppCategory[]
  ticketCount?: number
  quoteCount?: number
  profile?: Profile | null
  isAdmin?: boolean
  onSignOut?: () => void
  onNavigate?: () => void
}

export default function Sidebar({ collapsed, categories, ticketCount = 0, quoteCount = 0, profile, isAdmin, onSignOut, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const initials = ((profile?.full_name ?? profile?.email ?? 'U')[0]).toUpperCase()

  // Toutes les catégories rétractées par défaut
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(
    () => Object.fromEntries(categories.map(c => [c.id, false]))
  )

  function toggleCat(id: string) {
    setOpenCats(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav className="flex flex-col h-full py-4 overflow-y-auto">
      {/* Logo */}
      <div className={clsx('flex items-center gap-3 px-4 mb-6', collapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>Sensetho Apps</span>
        )}
      </div>

      {/* Dashboard */}
      <div className="px-3 mb-2">
        <NavItem href="/dashboard" icon="home" label="Dashboard"
          active={pathname === '/dashboard'} collapsed={collapsed} onClick={onNavigate} />
      </div>

      {/* Catégories & Apps */}
      {categories.map(cat => {
        const isOpen = collapsed || (openCats[cat.id] !== false)
        const hasActiveBadge = (cat.apps ?? []).some(
          a => (a.route === '/admin/tickets' && ticketCount > 0) || (a.route === '/admin/quotes' && quoteCount > 0)
        )

        return (
          <div key={cat.id} className="px-3 mb-2">
            {/* En-tête de catégorie cliquable */}
            {!collapsed ? (
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center gap-2 px-2 py-1 mb-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors group"
              >
                <Icon name={cat.icon} size={13} className="flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider truncate flex-1 text-left" style={{ color: 'var(--text-subtle)' }}>
                  {cat.name}
                </span>
                {cat.is_admin_only && (
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    Admin
                  </span>
                )}
                {/* Badge notification si catégorie fermée */}
                {!isOpen && hasActiveBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                )}
                <Icon
                  name={isOpen ? 'chevronDown' : 'chevronRight'}
                  size={12}
                  className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-subtle)' }}
                />
              </button>
            ) : (
              <div className="flex justify-center mb-1 py-1">
                <Icon name={cat.icon} size={14} style={{ color: 'var(--text-subtle)' }} />
              </div>
            )}

            {/* Apps de la catégorie */}
            {isOpen && (
              <div className="space-y-0.5">
                {(cat.apps ?? []).map(app => (
                  <NavItem
                    key={app.id}
                    href={app.route}
                    icon={app.icon}
                    label={app.name}
                    active={pathname === app.route || pathname.startsWith(app.route + '/')}
                    collapsed={collapsed}
                    onClick={onNavigate}
                    badge={
                      app.route === '/admin/tickets' && ticketCount > 0 ? ticketCount
                      : app.route === '/admin/quotes' && quoteCount > 0 ? quoteCount
                      : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex-1" />

      {/* Zone utilisateur en bas */}
      <div className="px-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        {collapsed ? (
          /* Vue compacte */
          <div className="flex flex-col items-center gap-2 py-2">
            <Link href="/account" title="Mon compte" onClick={onNavigate}
              className={clsx(
                'w-8 h-8 rounded-full bg-gray-900 dark:bg-slate-600 flex items-center justify-center hover:opacity-80 transition-opacity',
                (pathname === '/account' || pathname.startsWith('/account/')) && 'ring-2 ring-offset-1 ring-gray-400'
              )}>
              <span className="text-white text-xs font-semibold">{initials}</span>
            </Link>
            <button onClick={onSignOut} title="Se déconnecter"
              className="p-1.5 rounded-lg hover:opacity-70 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        ) : (
          /* Vue étendue */
          <div className="py-2 space-y-1">
            <Link href="/account" onClick={onNavigate}
              className={clsx(
                'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors group',
                (pathname === '/account' || pathname.startsWith('/account/'))
                  ? 'bg-gray-900 dark:bg-slate-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700'
              )}
              style={(pathname === '/account' || pathname.startsWith('/account/')) ? undefined : { color: 'var(--text-muted)' }}
            >
              <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-slate-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name ?? profile?.email ?? 'Mon compte'}
                </p>
                {isAdmin && (
                  <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">Administrateur</p>
                )}
              </div>
            </Link>
            <button onClick={onSignOut}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
              style={{ color: 'var(--text-muted)' }}>
              <Icon name="logout" size={18} className="flex-shrink-0" />
              <span>Se déconnecter</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

interface NavItemProps {
  href: string
  icon: string
  label: string
  active: boolean
  collapsed: boolean
  badge?: number
  onClick?: () => void
}

function NavItem({ href, icon, label, active, collapsed, badge, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={clsx(
        'flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors group relative',
        collapsed ? 'justify-center' : '',
        active
          ? 'bg-gray-900 dark:bg-slate-600 text-white'
          : 'hover:bg-gray-100 dark:hover:bg-slate-700'
      )}
      style={!active ? { color: 'var(--text-muted)' } : undefined}
    >
      <Icon name={icon} size={18} className="flex-shrink-0" />
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {badge && badge > 0 && (
        <span className={clsx(
          'flex-shrink-0 text-[10px] font-bold rounded-full flex items-center justify-center',
          'bg-red-500 text-white',
          collapsed ? 'absolute -top-0.5 -right-0.5 w-4 h-4' : 'w-5 h-5'
        )}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}
