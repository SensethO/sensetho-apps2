import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header style={{ backgroundColor: '#0e3d4d' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-16 items-center justify-between">
          <Link href="/" className="w-32 sm:w-44 flex-shrink-0">
            <Image
              src="/logo2.png"
              alt="Sens'ethO Apps"
              width={0}
              height={0}
              sizes="180px"
              className="w-full h-auto rounded-lg"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-white/70 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-white dark:bg-gray-950">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} SCDB PRO SARL — Sens&apos;ethO Apps. Tous droits réservés.</p>
            <nav className="flex flex-wrap items-center gap-4">
              <Link href="/mentions-legales" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Mentions légales</Link>
              <Link href="/cgv" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">CGV</Link>
              <Link href="/cgu" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">CGU</Link>
              <Link href="/politique-de-confidentialite" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Confidentialité</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
