'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import type { AppCategory } from '@/types'

interface SidebarProps {
  collapsed: boolean
  categories: AppCategory[]
  isAdmin: boolean
  onNavigate?: () => void
}

export default function Sidebar({ collapsed, categories, isAdmin, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col h-full py-4 overflow-y-auto">
      {/* Logo / Titre */}
      <div className={clsx('flex items-center gap-3 px-4 mb-6', collapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        {!collapsed && (
          <span className="font-semibold text-gray-900 text-sm truncate">Sensetho Apps</span>
        )}
      </div>

      {/* Lien Dashboard */}
      <div className="px-3 mb-2">
        <NavItem
          href="/dashboard"
          icon="home"
          label="Dashboard"
          active={pathname === '/dashboard'}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      </div>

      {/* Catégories & Apps */}
      {categories.map(cat => (
        <div key={cat.id} className="px-3 mb-4">
          {/* Nom catégorie */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 mb-1">
              <Icon name={cat.icon} size={14} className="text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                {cat.name}
              </span>
              {cat.is_admin_only && (
                <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-1">
              <Icon name={cat.icon} size={14} className="text-gray-400" />
            </div>
          )}

          {/* Apps de la catégorie */}
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
              />
            ))}
          </div>
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Lien Mon compte */}
      <div className="px-3 pt-2 border-t border-gray-100">
        <NavItem
          href="/account"
          icon="user"
          label="Mon compte"
          active={pathname === '/account'}
          collapsed={collapsed}
          onClick={onNavigate}
        />
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
  onClick?: () => void
}

function NavItem({ href, icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={clsx(
        'flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors group',
        collapsed ? 'justify-center' : '',
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <Icon name={icon} size={18} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
