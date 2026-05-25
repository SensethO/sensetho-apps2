'use client'

import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ui/ThemeToggle'

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="w-36 sm:w-44 flex-shrink-0">
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

          {/* Nav centrale */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/catalogue"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Catalogue
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors text-[#0e3d4d] dark:text-teal-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Se connecter
            </Link>
            <Link
              href="/catalogue"
              className="hidden sm:inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Commencer →
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
