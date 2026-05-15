'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import type { AppCategory } from '@/types'

interface SidebarProps {
  collapsed: boolean
  categories: AppCategory[]
  ticketCount?: number
  onNavigate?: () => void
}

export default function Sidebar({ collapsed, categories, ticketCount = 0, onNavigate }: SidebarProps) {
  const pathname = usePathname()

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
      {categories.map(cat => (
        <div key={cat.id} className="px-3 mb-4">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 mb-1">
              <Icon name={cat.icon} size={14} className="flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--text-subtle)' }}>
                {cat.name}
              </span>
              {cat.is_admin_only && (
                <span className="ml-auto text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-1">
              <Icon name={cat.icon} size={14} style={{ color: 'var(--text-subtle)' }} />
            </div>
          )}
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
                badge={app.route === '/admin/tickets' && ticketCount > 0 ? ticketCount : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex-1" />

      {/* Mon compte */}
      <div className="px-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <NavItem href="/account" icon="user" label="Mon compte"
          active={pathname === '/account' || pathname.startsWith('/account/')}
          collapsed={collapsed} onClick={onNavigate} />
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
