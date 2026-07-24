'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'

// ── Types ───────────────────────────────────────────────────────────────────

interface CatalogueApp {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  route: string | null
  category_id: string
  order_index: number
  pricing_type: 'free' | 'subscription' | 'perpetual' | 'quote'
  price_monthly: number | null
  price_annual: number | null
  price_perpetual: number | null
  annual_discount_pct: number
}

interface CatalogueCategory {
  id: string
  name: string
  slug: string
  order_index: number
  apps: CatalogueApp[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const CAT_META: Record<string, { icon: string; color: string; border: string; bg: string }> = {
  rse:    { icon: '🧭', color: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-100 dark:border-teal-800',   bg: 'bg-teal-50/40 dark:bg-teal-950/20' },
  business: { icon: '💼', color: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-100 dark:border-blue-800',   bg: 'bg-blue-50/40 dark:bg-blue-950/20' },
  metier: { icon: '🛠️', color: 'text-violet-700 dark:text-violet-300', border: 'border-violet-100 dark:border-violet-800', bg: 'bg-violet-50/40 dark:bg-violet-950/20' },
}
function catMeta(slug: string) {
  return CAT_META[slug] ?? { icon: '📦', color: 'text-gray-700 dark:text-gray-300', border: 'border-gray-100 dark:border-gray-800', bg: 'bg-gray-50 dark:bg-gray-900' }
}

function devisUrl(app: CatalogueApp) {
  return `/devis?app=${app.slug}&name=${encodeURIComponent(app.name)}`
}

function formatPrice(n: number) {
  return n % 1 === 0 ? `${n} €` : `${n.toFixed(2)} €`
}

// ── Composant carte app ──────────────────────────────────────────────────────

function AppCard({ app, catSlug }: { app: CatalogueApp; catSlug: string }) {
  const meta = catMeta(catSlug)

  const isPaid = app.pricing_type !== 'free'
  const hasMonthly = app.pricing_type === 'subscription' && app.price_monthly != null
  const hasAnnual  = app.pricing_type === 'subscription' && app.price_annual  != null
  const hasPerpetual = app.pricing_type === 'perpetual'  && app.price_perpetual != null
  const isSurDevis = app.pricing_type === 'quote'

  const discount = app.annual_discount_pct > 0 ? app.annual_discount_pct : null

  return (
    <div className={[
      'rounded-2xl border p-5 flex flex-col gap-4 transition-all h-full',
      'bg-white dark:bg-gray-900 hover:shadow-md',
      meta.border,
    ].join(' ')}>
      {/* Header */}
      <div className="flex items-start gap-3 flex-1">
        <span className="text-3xl flex-shrink-0">{app.icon ?? '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {app.name}
            </h3>
            {app.pricing_type === 'free' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                Gratuit
              </span>
            )}
          </div>
          {app.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {app.description}
            </p>
          )}
        </div>
      </div>

      {/* Pricing */}
      <div className="flex flex-col gap-2 mt-auto">
        {/* Mensuel */}
        {hasMonthly && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 text-sm">
            <span className="font-medium text-indigo-700 dark:text-indigo-300">Par mois</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              {formatPrice(app.price_monthly!)} TTC<span className="text-xs font-normal">/mois</span>
            </span>
          </div>
        )}

        {/* Annuel */}
        {hasAnnual && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-sm">
            <span className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              Par an
              {discount && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-semibold">
                  -{discount}%
                </span>
              )}
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {formatPrice(app.price_annual!)} TTC<span className="text-xs font-normal">/an</span>
            </span>
          </div>
        )}

        {/* Perpétuel */}
        {hasPerpetual && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-amber-100 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 text-sm">
            <span className="font-medium text-amber-700 dark:text-amber-300">Accès à vie</span>
            <span className="font-bold text-amber-700 dark:text-amber-300">
              {formatPrice(app.price_perpetual!)} TTC
            </span>
          </div>
        )}

        {/* Sur devis */}
        {isSurDevis && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm">
            <span className="font-medium text-gray-600 dark:text-gray-300">📋 Sur devis</span>
            <Link href={devisUrl(app)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium">
              Demander →
            </Link>
          </div>
        )}
      </div>

      {/* CTA button */}
      {!isSurDevis && (
        isPaid ? (
          <Link
            href={devisUrl(app)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:opacity-90"
            style={{ backgroundColor: '#0e3d4d' }}
          >
            Demander l&apos;accès →
          </Link>
        ) : (
          <Link
            href="/auth/login"
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all"
            style={{ border: '1.5px solid #0e3d4d', color: '#0e3d4d' }}
          >
            Accéder →
          </Link>
        )
      )}
      {isSurDevis && (
        <Link
          href={devisUrl(app)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:opacity-90"
          style={{ backgroundColor: '#0e3d4d' }}
        >
          Demander un devis →
        </Link>
      )}
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────

export function CatalogueClient() {
  const { profile: user } = useAuth()
  const [categories, setCategories] = useState<CatalogueCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/catalogue/apps')
      .then(r => r.json())
      .then(json => setCategories(json.data ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 w-32 sm:w-40">
            <Image
              src="/logo2.png"
              alt="Sens'ethO Apps"
              width={0}
              height={0}
              sizes="160px"
              className="w-full h-auto rounded-lg"
              priority
            />
          </Link>

          {/* Titre centré */}
          <span className="hidden md:block text-sm font-semibold text-gray-700 dark:text-gray-200">
            Catalogue des applications
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ color: '#0e3d4d' }}
              >
                ← Mon espace
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Se connecter
                </Link>
                <Link
                  href="/auth/login"
                  className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#0e3d4d' }}
                >
                  Commencer →
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="py-12 text-center px-4" style={{ backgroundColor: '#0e3d4d' }}>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
          Catalogue des applications
        </h1>
        <p className="text-white/70 text-sm max-w-xl mx-auto">
          Chaque application sert une étape de votre démarche — jamais l&apos;inverse.
          Accès par abonnement, droits gérés par organisation ; demandez l&apos;accès depuis cette page ou contactez votre administrateur.
        </p>

        {/* La démarche en 3 temps */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-white/80">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5">
            <span>👁️</span> 1 · Se voir agir
          </span>
          <span className="text-white/40">→</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5">
            <span>🧭</span> 2 · Retrouver le sens
          </span>
          <span className="text-white/40">→</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5">
            <span>🛠️</span> 3 · Tenir ses engagements — et le prouver
          </span>
        </div>

        {/* Bandeau info accès */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-xl bg-white/10 border border-white/20 px-5 py-3 text-sm text-white/80">
          <span className="text-lg">🔐</span>
          <span>Les accès sont gérés par votre administrateur — <Link href="/auth/login" className="underline underline-offset-2 hover:text-white">Connectez-vous</Link> pour voir vos apps actives.</span>
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement du catalogue…
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">🔧</div>
            <p className="text-lg font-medium">Aucune application disponible pour le moment.</p>
            <p className="text-sm mt-2">Revenez bientôt ou contactez-nous.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map(cat => {
              const meta = catMeta(cat.slug)
              return (
                <div key={cat.id}>
                  {/* Header catégorie */}
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-2xl">{meta.icon}</span>
                    <h2 className={`text-xl font-bold ${meta.color}`}>{cat.name}</h2>
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {cat.apps.length} application{cat.apps.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 border-t border-gray-100 dark:border-gray-800 ml-2" />
                  </div>

                  {/* Grille apps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {cat.apps.map(app => (
                      <AppCard key={app.id} app={app} catSlug={cat.slug} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Section admin */}
        <div className="mt-16 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
          <span className="text-3xl block mb-4">⚙️</span>
          <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">
            Administrateurs — Gérez abonnements et droits d&apos;accès
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-6">
            Activez les abonnements utilisateurs, gérez les droits d&apos;accès par application et
            traitez les demandes de devis depuis le panneau d&apos;administration.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/login"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Accéder à l&apos;administration →
            </Link>
            <a
              href="mailto:sylvain.cassaro@sensetho.com"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Contacter l&apos;équipe
            </a>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8 mt-4" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/40 text-xs">Sens&apos;ethO Apps — SCDB PRO SARL</span>
          <div className="flex gap-6 text-xs text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link>
            <Link href="/auth/login" className="hover:text-white/70 transition-colors">Connexion</Link>
            <a href="https://www.sensetho.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">sensetho.com</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
