import Link from 'next/link'
import { LandingNav } from '@/components/layout/LandingNav'

interface CatalogueApp {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  route: string | null
  category_id: string
  order_index: number
}

interface CatalogueCategory {
  id: string
  name: string
  slug: string
  order_index: number
  apps: CatalogueApp[]
}

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  rse: {
    icon: '🌿',
    color: 'text-teal-700 dark:text-teal-300',
    bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-800',
  },
  business: {
    icon: '💼',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800',
  },
  metier: {
    icon: '🛠️',
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-800',
  },
}

function getCategoryMeta(slug: string) {
  return CATEGORY_META[slug] ?? {
    icon: '📦',
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800',
  }
}

async function getCatalogue(): Promise<CatalogueCategory[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://apps.sensetho.com'
  try {
    const res = await fetch(`${baseUrl}/api/catalogue/apps`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

export default async function CataloguePage() {
  const categories = await getCatalogue()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <LandingNav />

      {/* Header */}
      <div style={{ backgroundColor: '#0e3d4d' }} className="py-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
          Catalogue des applications
        </h1>
        <p className="text-white/70 text-base max-w-xl mx-auto px-4">
          Découvrez toutes les applications Sens&apos;ethO : RSE, Business et Métier.
          Chaque outil est accessible par abonnement, avec gestion des droits par organisation.
        </p>

        {/* Vague */}
        <div className="w-full overflow-hidden leading-none mt-10" style={{ marginBottom: '-2px' }}>
          <svg viewBox="0 0 1440 50" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-10">
            <path d="M0,25 C360,50 1080,0 1440,25 L1440,50 L0,50 Z" fill="#ffffff" className="dark:fill-gray-950" />
          </svg>
        </div>
      </div>

      {/* Catalogue content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Info bannière */}
        <div className="mb-10 rounded-2xl border border-teal-100 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 px-6 py-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <span className="text-2xl">🔐</span>
          <div className="flex-1">
            <p className="text-sm text-teal-800 dark:text-teal-200 font-medium">
              Accès par abonnement — Géré par votre administrateur
            </p>
            <p className="text-xs text-teal-700/70 dark:text-teal-300/60 mt-0.5">
              Les accès aux applications sont accordés par votre administrateur via le module Abonnements et Droits d&apos;accès.
              Connectez-vous pour voir vos applications actives.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              href="/auth/login"
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-700 hover:bg-teal-600 hover:text-white transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Categories */}
        {categories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <span className="text-4xl block mb-4">📭</span>
            <p>Aucune application disponible pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {categories.map(cat => {
              const meta = getCategoryMeta(cat.slug)
              return (
                <section key={cat.id}>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">{meta.icon}</span>
                    <h2 className={`text-xl font-bold ${meta.color}`}>{cat.name}</h2>
                    <span className="text-xs text-gray-400 ml-2">{cat.apps.length} application{cat.apps.length > 1 ? 's' : ''}</span>
                    <div className="flex-1 border-t border-gray-100 dark:border-gray-800 ml-2" />
                  </div>

                  {/* Apps grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {cat.apps.map(app => (
                      <div
                        key={app.id}
                        className={`rounded-2xl border p-6 flex flex-col gap-3 ${meta.bg} hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-3xl">{app.icon ?? '📦'}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color} bg-white/60 dark:bg-black/20`}>
                            {cat.name}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">{app.name}</h3>
                        {app.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex-1 leading-relaxed">
                            {app.description}
                          </p>
                        )}
                        <div className="mt-auto flex gap-2 pt-2">
                          <Link
                            href="/auth/login"
                            className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                          >
                            Se connecter
                          </Link>
                          {app.route && (
                            <Link
                              href={app.route}
                              className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors`}
                              style={{ backgroundColor: '#0e3d4d' }}
                            >
                              Accéder →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* Section admin info */}
        <div className="mt-16 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-8 text-center">
          <span className="text-3xl block mb-4">⚙️</span>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">
            Gestion des abonnements et droits d&apos;accès
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-6">
            Les administrateurs peuvent gérer les abonnements aux applications et les droits d&apos;accès
            des utilisateurs depuis le panneau d&apos;administration. Chaque application peut être activée
            individuellement par organisation.
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#0e3d4d' }}
          >
            Accéder à l&apos;administration →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-100 dark:border-gray-800 py-8" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/40 text-xs">Sens&apos;ethO Apps — SCDB PRO SARL</span>
          <div className="flex gap-6 text-xs text-white/40">
            <a href="https://www.sensetho.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
              sensetho.com
            </a>
            <Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link>
            <Link href="/auth/login" className="hover:text-white/70 transition-colors">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
