'use client'

import { useTheme } from '@/components/providers/ThemeProvider'
import Icon from '@/components/ui/Icon'

/**
 * Bouton de basculement de thème : clair → sombre → système.
 * Réutilisable dans tous les shells (AppShell, RseAppShell…).
 */
export default function ThemeToggle() {
  const { theme, setTheme, effectiveTheme } = useTheme()

  function cycle() {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const label =
    theme === 'light' ? 'Mode clair' :
    theme === 'dark'  ? 'Mode sombre' : 'Thème système'

  return (
    <button
      onClick={cycle}
      title={label}
      className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
      style={{ color: 'var(--text-muted)' }}
      aria-label={label}
    >
      {effectiveTheme === 'dark'
        ? <Icon name="moon" size={16} />
        : <Icon name="sun" size={16} />
      }
    </button>
  )
}
