'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useApps } from '@/hooks/useApps'
import { useFavorites } from '@/hooks/useFavorites'

export default function FavoritesBoard() {
  const { profile, isAdmin } = useAuth()
  const { categories } = useApps(isAdmin)
  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites(profile?.id ?? null)

  // Catégories filtrées aux apps favorites, dans l'ordre du menu
  const favCategories = categories
    .map(cat => ({
      ...cat,
      apps: (cat.apps ?? []).filter(a => favoriteIds.includes(a.id)),
    }))
    .filter(cat => cat.apps.length > 0)

  // ── État vide ────────────────────────────────────────────────────────────────
  if (favoriteIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-card)' }}>
          <Icon name="star" size={28} style={{ color: 'var(--text-subtle)' }} />
        </div>
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
            Aucun favori pour l&apos;instant
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Survolez une application dans le menu de gauche<br />
            et cliquez sur l&apos;étoile <Icon name="star" size={13} className="inline-block mx-0.5 align-text-bottom" style={{ color: 'var(--text-muted)' }} /> pour l&apos;épingler ici.
          </p>
        </div>
      </div>
    )
  }

  // ── Grille des favoris ───────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-4xl">
      {favCategories.map(cat => (
        <section key={cat.id}>
          {/* En-tête de catégorie */}
          <div className="flex items-center gap-2 mb-3">
            <Icon name={cat.icon} size={14} style={{ color: 'var(--text-subtle)' }} />
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              {cat.name}
            </h2>
          </div>

          {/* Cartes d'applications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cat.apps.map(app => (
              <div key={app.id} className="group relative">
                <Link
                  href={app.route}
                  className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 block"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  {/* Icône */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'var(--accent, #6366f1)' }}>
                    <Icon name={app.icon} size={20} />
                  </div>

                  {/* Nom + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {app.name}
                    </p>
                    {app.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {app.description}
                      </p>
                    )}
                  </div>

                  <Icon name="chevronRight" size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: 'var(--text-muted)' }} />
                </Link>

                {/* Bouton retirer favori — coin supérieur droit au hover */}
                <button
                  onClick={() => toggleFavorite(app.id)}
                  title="Retirer des favoris"
                  className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                  style={{ color: '#eab308' }}
                >
                  <Icon name={isFavorite(app.id) ? 'starFilled' : 'star'} size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
