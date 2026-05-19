'use client'

/**
 * ViewTabs — barre d'onglets de navigation commune à toutes les applications RSE.
 *
 * Règle universelle RSE :
 *   - Toute app RSE avec plusieurs vues DOIT utiliser ce composant
 *   - Toujours affiché en haut du contenu, dans chaque vue
 *   - L'onglet actif est mis en évidence (fond accent)
 *   - Ordre des onglets : vue synthétique → vue intermédiaire → vue détaillée
 *   - Pas d'autres boutons de navigation entre vues (sauf aide contextuelle en fin de parcours)
 *
 * Usage :
 *   const TABS = [
 *     { id: 'dashboard', label: 'Tableau de bord', icon: '🎯' },
 *     { id: 'summary',   label: 'Synthèse',        icon: '📊' },
 *     { id: 'step',      label: 'Questionnaire',   icon: '📝' },
 *   ] as const
 *
 *   <ViewTabs tabs={TABS} active={view} onChange={setView} />
 */

export interface ViewTab<T extends string = string> {
  id: T
  label: string
  icon: string
}

export default function ViewTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly ViewTab<T>[]
  active: T
  onChange: (v: T) => void
}) {
  return (
    <div
      className="flex gap-1 mb-5 p-1 rounded-xl"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={
              isActive
                ? {
                    backgroundColor: 'var(--accent, #6366f1)',
                    color: '#fff',
                    boxShadow: '0 1px 4px rgba(99,102,241,0.3)',
                  }
                : { color: 'var(--text-muted)' }
            }
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
