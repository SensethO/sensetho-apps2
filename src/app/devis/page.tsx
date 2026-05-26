'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ui/ThemeToggle'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'form' | 'success' | 'error'

// ── Inner component (uses useSearchParams) ───────────────────────────────────

function DevisForm() {
  const params = useSearchParams()
  const appSlug = params.get('app') ?? ''
  const appName = params.get('name') ?? ''

  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    contact_name: '',
    email: '',
    company: '',
    phone: '',
    users_count: '',
    message: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_slug: appSlug || null,
          email: form.email,
          company: form.company || null,
          users_count: form.users_count ? parseInt(form.users_count) : null,
          message: [
            form.contact_name ? `Contact : ${form.contact_name}` : null,
            form.phone ? `Téléphone : ${form.phone}` : null,
            form.message || null,
          ].filter(Boolean).join('\n') || null,
        }),
      })

      if (res.ok) {
        setStep('success')
      } else {
        setStep('error')
      }
    } catch {
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="text-center py-16 px-6 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-3xl mx-auto mb-6">
          ✅
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: '#0e3d4d' }}>
          Demande envoyée !
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Votre demande {appName ? `pour <strong>${appName}</strong>` : ''} a bien été reçue.
          Notre équipe vous répondra dans les meilleurs délais.
        </p>
        <p className="text-sm text-gray-400 mb-8">Un email de confirmation sera envoyé à <strong>{form.email}</strong>.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/catalogue" className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90" style={{ backgroundColor: '#0e3d4d' }}>
            Retour au catalogue
          </Link>
          <Link href="/auth/login" className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="text-center py-16 px-6 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-3xl mx-auto mb-6">
          ❌
        </div>
        <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Une erreur est survenue</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Veuillez réessayer ou contacter directement notre équipe à{' '}
          <a href="mailto:sylvain.cassaro@sensetho.com" className="underline" style={{ color: '#0e3d4d' }}>
            sylvain.cassaro@sensetho.com
          </a>
        </p>
        <button
          onClick={() => setStep('form')}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-colors"
          style={{ backgroundColor: '#0e3d4d' }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">

      {/* Fil d'ariane app */}
      {appName && (
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/catalogue" className="hover:underline" style={{ color: '#0e3d4d' }}>Catalogue</Link>
          <span>›</span>
          <span className="font-medium text-gray-900 dark:text-white">{appName}</span>
        </div>
      )}

      <div
        className="rounded-2xl border p-6 sm:p-8 bg-white dark:bg-gray-900 shadow-sm"
        style={{ borderColor: 'rgba(14,61,77,0.15)' }}
      >
        {/* Header */}
        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium mb-4"
            style={{ backgroundColor: 'rgba(14,61,77,0.08)', color: '#0e3d4d' }}
          >
            🎯 Demande d&apos;accès
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#0e3d4d' }}>
            {appName ? `Accéder à « ${appName} »` : 'Demande d\'accès ou devis'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Remplissez ce formulaire et notre équipe vous contactera sous 24h pour activer votre accès ou établir un devis personnalisé.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* Nom contact */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Nom & Prénom
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
              placeholder="Jean Dupont"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': 'rgba(14,61,77,0.3)' } as React.CSSProperties}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="vous@votresociete.fr"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
            />
          </div>

          {/* Société + Téléphone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                Société / Organisation
              </label>
              <input
                type="text"
                value={form.company}
                onChange={e => set('company', e.target.value)}
                placeholder="Ma Société SAS"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="06 XX XX XX XX"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
              />
            </div>
          </div>

          {/* Nb utilisateurs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Nombre d&apos;utilisateurs prévus
            </label>
            <select
              value={form.users_count}
              onChange={e => set('users_count', e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all"
            >
              <option value="">Sélectionner…</option>
              <option value="1">1 utilisateur</option>
              <option value="2">2–5 utilisateurs</option>
              <option value="5">5–10 utilisateurs</option>
              <option value="10">10–25 utilisateurs</option>
              <option value="25">25–50 utilisateurs</option>
              <option value="50">50+ utilisateurs</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Message (contexte, besoins spécifiques…)
            </label>
            <textarea
              rows={4}
              value={form.message}
              onChange={e => set('message', e.target.value)}
              placeholder="Décrivez votre contexte, vos besoins ou toute question sur l'application…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 resize-none transition-all"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.email}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0e3d4d' }}
          >
            {submitting ? 'Envoi en cours…' : 'Envoyer ma demande →'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Réponse sous 24h — Données traitées conformément au RGPD
          </p>
        </form>
      </div>
    </div>
  )
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

export default function DevisPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Nav */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/catalogue" className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Catalogue
            </Link>
            <Link href="/auth/login" className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: '#0e3d4d' }}>
              Connexion →
            </Link>
          </div>
        </div>
      </nav>

      {/* Form */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2" />
          Chargement…
        </div>
      }>
        <DevisForm />
      </Suspense>
    </div>
  )
}
