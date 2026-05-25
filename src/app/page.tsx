import Image from 'next/image'
import Link from 'next/link'
import { LandingNav } from '@/components/layout/LandingNav'

const FEATURED_APPS = [
  {
    slug: 'diagnostic-iso26000',
    name: 'Diagnostic ISO 26000',
    description: 'Évaluez votre maturité RSE selon les 7 domaines de la norme ISO 26000 avec un diagnostic guidé en 4 phases.',
    icon: '🌿',
    category: 'RSE',
    href: '/rse/diagnostic-iso26000',
  },
  {
    slug: 'diagnostic-csrd',
    name: 'Diagnostic CSRD/ESRS',
    description: 'Préparez votre reporting de durabilité CSRD avec une analyse complète des normes ESRS applicables.',
    icon: '📋',
    category: 'RSE',
    href: '/rse/diagnostic-csrd',
  },
  {
    slug: 'diagnostic-vsme',
    name: 'Diagnostic VSME EFRAG',
    description: 'Diagnostic simplifié pour PME selon le standard VSME de l\'EFRAG, adapté aux petites structures.',
    icon: '🏢',
    category: 'RSE',
    href: '/rse/diagnostic-vsme',
  },
  {
    slug: 'parties-prenantes',
    name: 'Parties Prenantes & Matérialité',
    description: 'Identifiez vos parties prenantes, conduisez des consultations et analysez votre matérialité à double entrée.',
    icon: '🤝',
    category: 'RSE',
    href: '/rse/parties-prenantes',
  },
  {
    slug: 'bilan-carbone',
    name: 'Bilan Carbone',
    description: 'Mesurez et suivez vos émissions de gaz à effet de serre selon la méthode Bilan Carbone® de l\'ADEME.',
    icon: '♻️',
    category: 'RSE',
    href: '/rse/bilan-carbone',
  },
  {
    slug: 'plan-action-rse',
    name: 'Plan d\'Action RSE',
    description: 'Construisez et pilotez votre plan d\'action RSE avec des objectifs mesurables et un suivi des indicateurs.',
    icon: '🎯',
    category: 'RSE',
    href: '/rse/plan-action',
  },
  {
    slug: 'gestion-organisations',
    name: 'Gestion des organisations',
    description: 'Gérez vos organisations clientes ou partenaires avec toutes les données légales issues des registres officiels.',
    icon: '🏛️',
    category: 'Business',
    href: '/business/gestion-organisations',
  },
]

const FEATURES = [
  {
    icon: '🔒',
    title: 'Données souveraines',
    description: 'Hébergées en Europe, sur des serveurs à énergie renouvelable. Vos données RSE ne quittent pas l\'UE.',
  },
  {
    icon: '📊',
    title: 'Standards de référence',
    description: 'ISO 26000, CSRD/ESRS, VSME EFRAG, GRI… Les normes internationales intégrées nativement.',
  },
  {
    icon: '🤝',
    title: 'Multi-organisations',
    description: 'Gérez plusieurs structures depuis un seul compte. Idéal pour les cabinets de conseil et groupes.',
  },
  {
    icon: '📤',
    title: 'Export & Partage',
    description: 'Exportez vos diagnostics en PDF et Excel. Partagez vers SharePoint en un clic.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      <LandingNav />

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: '#0e3d4d' }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/logo2.png"
              alt="Sens'ethO Apps"
              width={220}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Pilotez votre démarche RSE
            <br />
            <span className="text-teal-300">avec des outils de référence</span>
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
            La plateforme des professionnels RSE : diagnostics ISO 26000, CSRD, VSME, parties prenantes, bilan carbone et bien plus.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/catalogue"
              className="inline-block px-8 py-3 rounded-xl bg-teal-400 text-gray-900 font-bold text-base hover:bg-teal-300 transition-colors shadow-lg"
            >
              Découvrir le catalogue →
            </Link>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 rounded-xl border-2 border-white/40 text-white font-semibold text-base hover:bg-white/10 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Vague SVG */}
        <div className="w-full overflow-hidden leading-none" style={{ marginBottom: '-2px' }}>
          <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 md:h-20">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#ffffff" className="dark:fill-gray-950" />
          </svg>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: '#0e3d4d' }}>
            Une plateforme pensée pour les experts RSE
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="rounded-2xl p-6 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col gap-3"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="font-bold text-base" style={{ color: '#0e3d4d' }}>{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vague entre sections */}
      <div className="w-full overflow-hidden leading-none bg-white dark:bg-gray-950" style={{ marginBottom: '-2px' }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12">
          <path d="M0,30 C480,60 960,0 1440,30 L1440,60 L0,60 Z" fill="#030a14" />
        </svg>
      </div>

      {/* ── Applications ── */}
      <section className="py-16" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4">
            Nos applications
          </h2>
          <p className="text-center text-white/60 mb-12 max-w-xl mx-auto text-sm">
            Des outils spécialisés couvrant tous les référentiels RSE internationaux, accessibles par abonnement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURED_APPS.map(app => (
              <div
                key={app.slug}
                className="rounded-2xl p-6 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{app.icon}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-900/50 text-teal-300">
                    {app.category}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base">{app.name}</h3>
                <p className="text-sm text-white/60 flex-1">{app.description}</p>
                <Link
                  href="/auth/login"
                  className="mt-2 inline-block text-center px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
                >
                  Accéder →
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/catalogue"
              className="inline-block px-8 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              Voir tout le catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* Vague */}
      <div className="w-full overflow-hidden leading-none" style={{ backgroundColor: '#030a14', marginBottom: '-2px' }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12">
          <path d="M0,30 C480,0 960,60 1440,30 L1440,60 L0,60 Z" fill="#0e3d4d" />
        </svg>
      </div>

      {/* ── RSE Highlight ── */}
      <section className="py-16" style={{ backgroundColor: '#0e3d4d' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
            La RSE, c&apos;est votre métier. On vous donne les outils.
          </h2>
          <p className="text-white/80 text-base max-w-3xl mx-auto mb-10">
            Sens&apos;ethO Apps centralise vos diagnostics, analyses et plans d&apos;action RSE dans une plateforme unique,
            sécurisée et conforme aux dernières normes européennes. Plus de feuilles Excel dispersées,
            plus de rapports incomplets : tout est structuré, exportable et prêt à partager.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { num: '7', label: 'Domaines ISO 26000', sub: 'Couverture complète de la norme' },
              { num: '12', label: 'Standards couverts', sub: 'ISO, CSRD, VSME, GRI, EFRAG…' },
              { num: '100%', label: 'Données en Europe', sub: 'Hébergement souverain UE' },
            ].map(s => (
              <div key={s.num} className="rounded-2xl bg-white/10 p-6">
                <div className="text-4xl font-extrabold text-teal-300 mb-1">{s.num}</div>
                <div className="font-bold text-white text-sm">{s.label}</div>
                <div className="text-white/60 text-xs mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vague */}
      <div className="w-full overflow-hidden leading-none" style={{ backgroundColor: '#0e3d4d', marginBottom: '-2px' }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="#f0fdf4" className="dark:fill-gray-900" />
        </svg>
      </div>

      {/* ── Hébergement responsable ── */}
      <section className="py-14 bg-green-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-4xl mb-4 block">🌱</span>
          <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Hébergement responsable</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-2xl mx-auto">
            Notre infrastructure est hébergée sur des serveurs alimentés par des énergies renouvelables,
            localisés dans l&apos;Union Européenne. Vos données RSE sont traitées de façon cohérente avec vos engagements.
          </p>
        </div>
      </section>

      {/* Vague */}
      <div className="w-full overflow-hidden leading-none bg-green-50 dark:bg-gray-900" style={{ marginBottom: '-2px' }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12">
          <path d="M0,30 C480,60 960,0 1440,30 L1440,60 L0,60 Z" fill="#030a14" />
        </svg>
      </div>

      {/* ── CTA Final + Footer ── */}
      <section className="py-16" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Prêt à structurer votre démarche RSE ?
          </h2>
          <p className="text-white/60 text-sm mb-8">
            Accédez au catalogue, choisissez vos applications et démarrez dès aujourd&apos;hui.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/catalogue"
              className="px-8 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm transition-colors"
            >
              Voir le catalogue →
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-white/10 pt-8 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/picto.png" alt="Sens'ethO" width={24} height={24} className="rounded" />
              <span className="text-white/60 text-xs">Sens&apos;ethO Apps — SCDB PRO SARL</span>
            </div>
            <div className="flex gap-6 text-xs text-white/40">
              <a href="https://www.sensetho.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                sensetho.com
              </a>
              <Link href="/catalogue" className="hover:text-white/70 transition-colors">Catalogue</Link>
              <Link href="/auth/login" className="hover:text-white/70 transition-colors">Connexion</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
