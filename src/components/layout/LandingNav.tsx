'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Image
              src="/picto.png"
              alt="Sens'ethO"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-sm hidden sm:block" style={{ color: '#0e3d4d' }}>
              Sens&apos;ethO Apps
            </span>
          </Link>

          {/* Nav liens desktop */}
          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/catalogue"
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Catalogue
            </Link>
            <a
              href="https://www.sensetho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sensetho.com
            </a>
          </div>

          {/* CTAs desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/catalogue"
              className="text-sm font-bold px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Commencer →
            </Link>
          </div>

          {/* Burger mobile */}
          <button
            className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="sm:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-3">
          <Link href="/catalogue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Catalogue</Link>
          <Link href="/auth/login" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Connexion</Link>
          <Link
            href="/catalogue"
            className="block text-sm font-bold px-4 py-2 rounded-lg text-white text-center"
            style={{ backgroundColor: '#0e3d4d' }}
          >
            Commencer →
          </Link>
        </div>
      )}
    </nav>
  )
}
