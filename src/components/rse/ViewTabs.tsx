'use client'

/**
 * ViewTabs — barre d'onglets de navigation commune à toutes les applications RSE.
 *
 * Règles universelles RSE :
 *   - Toute app RSE avec plusieurs vues DOIT utiliser ce composant
 *   - Toujours affiché en haut du contenu, dans chaque vue
 *   - Le 1er onglet est TOUJOURS "Présentation" (accessible sans organisation)
 *   - Les autres onglets sont verrouillés tant qu'aucune organisation n'est sélectionnée
 *     → passer disabledIds={nonPresentationTabIds} lorsque !org
 *   - L'onglet actif est mis en évidence (fond accent)
 *   - Ordre : Présentation → vue synthétique → vue intermédiaire → vue détaillée
 *   - Pas d'autres boutons de navigation entre vues (sauf aide contextuelle en fin de parcours)
 *
 * Usage :
 *   const TABS = [
 *     { id: 'presentation', label: 'Présentation',    icon: '📋' },
 *     { id: 'dashboard',    label: 'Tableau de bord', icon: '🎯' },
 *     { id: 'summary',      label: 'Synthèse',        icon: '📊' },
 *     { id: 'step',         label: 'Questionnaire',   icon: '📝' },
 *   ] as const
 *
 *   const lockedTabs = !org ? TABS.filter(t => t.id !== 'presentation').map(t => t.id) : []
 *   <ViewTabs tabs={TABS} active={view} onChange={setView} disabledIds={lockedTabs} />
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
  disabledIds,
}: {
  tabs: readonly ViewTab<T>[]
  active: T
  onChange: (v: T) => void
  /**
   * IDs d'onglets verrouillés (ex : tant qu'aucune organisation n'est sélectionnée).
   * Un onglet désactivé est visible mais non cliquable (opacité réduite, curseur interdit).
   * Règle : le 1er onglet (Présentation) ne doit jamais être dans cette liste.
   */
  disabledIds?: readonly string[]
}) {
  return (
    <div
      className="flex gap-1 mb-5 p-1 rounded-xl"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {tabs.map(tab => {
        const isActive   = active === tab.id
        const isDisabled = disabledIds?.includes(tab.id) ?? false
        return (
          <button
            key={tab.id}
            onClick={() => { if (!isDisabled) onChange(tab.id) }}
            title={isDisabled ? 'Sélectionnez une organisation pour accéder à cet onglet' : undefined}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={
              isActive
                ? {
                    backgroundColor: 'var(--accent, #6366f1)',
                    color: '#fff',
                    boxShadow: '0 1px 4px rgba(99,102,241,0.3)',
                  }
                : isDisabled
                ? { color: 'var(--text-muted)', opacity: 0.35, cursor: 'not-allowed' }
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
