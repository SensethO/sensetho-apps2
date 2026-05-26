import Link from 'next/link'
import Image from 'next/image'
import { LandingNav } from '@/components/layout/LandingNav'
import { getSiteSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

const PUBLIC_APPS = [
  // ── RSE ──────────────────────────────────────────────────────
  {
    id: 'iso26000-guided',
    name: 'Diagnostic RSE initial guidé ISO 26000',
    description: 'Parcourez les 13 domaines RSE prioritaires de l\'ISO 26000 en 30 à 50 minutes grâce à un questionnaire guidé étape par étape. Résultats instantanés, recommandations personnalisées par domaine, export PDF et Excel complet avec cartographie ODD.',
    icon: '🧭',
    folder: 'RSE',
  },
  {
    id: 'csrd-diagnostic',
    name: 'Diagnostic CSRD / ESRS',
    description: 'Préparez votre conformité à la directive CSRD en évaluant les Disclosure Requirements des standards ESRS. Suivez votre taux de couverture par standard, identifiez les lacunes prioritaires et générez un rapport de conformité exportable.',
    icon: '📊',
    folder: 'RSE',
  },
  {
    id: 'vsme-diagnostic',
    name: 'Diagnostic VSME EFRAG',
    description: 'Diagnostic de durabilité simplifié pour les PME selon le standard VSME de l\'EFRAG. Évaluez vos pratiques ESG selon un référentiel adapté aux petites structures, avec export de rapport et recommandations priorisées.',
    icon: '🌱',
    folder: 'RSE',
  },
  {
    id: 'parties-prenantes',
    name: 'Parties Prenantes & Matérialité',
    description: 'Identifiez et analysez vos parties prenantes, conduisez des consultations structurées et réalisez votre analyse de matérialité à double entrée. Gérez plusieurs sessions par organisation, exportez les résultats en PDF et Excel.',
    icon: '🤝',
    folder: 'RSE',
  },
  {
    id: 'odd-iso26000',
    name: 'ISO 26000 & ODD',
    description: 'Explorez visuellement les correspondances entre les 37 domaines d\'action ISO 26000 et les 17 Objectifs de Développement Durable des Nations Unies. Identifiez quels ODD sont couverts par votre démarche RSE. Export Excel des matrices.',
    icon: '🌍',
    folder: 'RSE',
  },
  {
    id: 'rapport-integre',
    name: 'Rapport intégré',
    description: 'Construisez votre rapport intégré en croisant les résultats de vos diagnostics ISO 26000, CSRD/ESRS et GRI. Structurez votre communication extra-financière selon le cadre <IR> de l\'IIRC et exportez un rapport cohérent et prêt à diffuser.',
    icon: '📄',
    folder: 'RSE',
  },
  // ── Business ──────────────────────────────────────────────────
  {
    id: 'gestion-organisations',
    name: 'Gestion des organisations',
    description: 'Gérez vos organisations clientes ou partenaires avec toutes les données légales issues des registres officiels français (SIRENE, INPI). Recherche en temps réel, fiche complète (siège, dirigeants, labels), favoris et export.',
    icon: '🏛️',
    folder: 'Business',
  },
]

export default async function LandingPage() {
  const S = await getSiteSettings()
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <LandingNav />

      <main id="main-content">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-950 px-4 pt-16 pb-0">
        <div className="mx-auto max-w-4xl text-center">
          {/* Logo centré */}
          <div className="mx-auto mb-10 w-56 sm:w-72">
            <Image
              src="/logo2.png"
              alt="Sens'ethO Apps"
              width={0}
              height={0}
              sizes="300px"
              className="w-full h-auto rounded-xl"
              priority
            />
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-6"
            style={{ backgroundColor: 'rgba(14,61,77,0.08)', color: '#0e3d4d' }}
          >
            <span>🎯</span>
            <span>{S.hero_badge}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight" style={{ color: '#0e3d4d' }}>
            {S.hero_title_1}<br />
            <span className="text-gray-400 dark:text-gray-400 font-light">{S.hero_title_2}</span>
          </h1>

          <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {S.hero_subtitle}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/catalogue"
              className="w-full sm:w-auto rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg hover:opacity-90 transition-all"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Commencer gratuitement →
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto rounded-xl border px-8 py-4 text-base font-medium transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ borderColor: '#0e3d4d', color: '#0e3d4d' }}
            >
              J&apos;ai déjà un compte
            </Link>
          </div>

          <p className="mt-5 text-sm text-gray-400">
            {S.hero_cta_note}
          </p>
        </div>
      </section>

      {/* ── Vague blanc → #0e3d4d ── */}
      <div className="w-full bg-white dark:bg-gray-950 leading-none mt-16">
        <svg
          viewBox="0 0 1440 120"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ display: 'block', marginBottom: '-2px' }}
        >
          <path
            d="M0,40 C180,90 360,10 540,55 C720,100 900,15 1080,60 C1260,105 1360,65 1440,50 L1440,120 L0,120 Z"
            fill="#0e3d4d"
          />
        </svg>
      </div>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="py-16" style={{ backgroundColor: '#0e3d4d' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Pourquoi Sens&apos;ethO Apps ?
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🔒', title: S.feature_1_title, desc: S.feature_1_desc },
              { icon: '📋', title: S.feature_2_title, desc: S.feature_2_desc },
              { icon: '🏢', title: S.feature_3_title, desc: S.feature_3_desc },
              { icon: '📤', title: S.feature_4_title, desc: S.feature_4_desc },
            ].map((feat, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 border border-white/10"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <div className="text-3xl mb-3">{feat.icon}</div>
                <h3 className="font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vague #0e3d4d → #030a14 ── */}
      <div className="leading-none" style={{ backgroundColor: '#0e3d4d' }}>
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ display: 'block', marginBottom: '-2px' }}
        >
          <path
            d="M0,40 C200,80 400,10 600,50 C800,90 1000,20 1200,55 C1320,75 1390,45 1440,38 L1440,100 L0,100 Z"
            fill="#030a14"
          />
        </svg>
      </div>

      {/* ── Applications ─────────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {S.apps_section_title}
            </h2>
            <p className="mt-4 text-base max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {S.apps_section_subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PUBLIC_APPS.map((app) => (
              <div
                key={app.id}
                className="rounded-2xl p-5 border transition-all hover:border-white/20"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-2xl">{app.icon}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white text-sm">{app.name}</h3>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: app.folder === 'RSE'
                            ? 'rgba(52,211,153,0.15)'
                            : 'rgba(167,139,250,0.15)',
                          color: app.folder === 'RSE'
                            ? '#34d399'
                            : '#a78bfa',
                        }}
                      >
                        {app.folder}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {app.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg hover:opacity-90 transition-all"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Accéder à toutes les applications →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Vague #030a14 → blanc ── */}
      <div className="leading-none" style={{ backgroundColor: '#030a14' }}>
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ display: 'block', marginBottom: '-2px' }}
        >
          <path
            d="M0,55 C180,20 360,85 540,45 C720,10 900,80 1080,42 C1260,8 1360,55 1440,62 L1440,100 L0,100 Z"
            className="fill-white dark:fill-[#030712]"
          />
        </svg>
      </div>

      {/* ── RSE Highlight ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-6"
                style={{ backgroundColor: 'rgba(14,61,77,0.08)', color: '#0e3d4d' }}
              >
                <span>{S.rse_badge}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6" style={{ color: '#0e3d4d' }}>
                {S.rse_title}
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
                {S.rse_desc}
              </p>
              <div className="space-y-3">
                {[S.rse_check_1, S.rse_check_2, S.rse_check_3, S.rse_check_4].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(14,61,77,0.1)' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="#0e3d4d" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🧭', label: 'Diagnostic guidé ISO 26000', desc: '13 domaines prioritaires' },
                { icon: '📊', label: 'Diagnostic CSRD/ESRS', desc: 'Disclosure Requirements ESRS' },
                { icon: '🌍', label: 'Mapping ODD', desc: '17 objectifs de l\'ONU' },
                { icon: '🤝', label: 'Parties Prenantes', desc: 'Matérialité à double entrée' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl p-5 border"
                  style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-semibold text-sm mb-1" style={{ color: '#0e3d4d' }}>{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CSRD Highlight ───────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-6"
                style={{ backgroundColor: 'rgba(14,61,77,0.08)', color: '#0e3d4d' }}
              >
                <span>📋</span>
                <span>Directive CSRD & Standards ESRS</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6" style={{ color: '#0e3d4d' }}>
                Préparez votre reporting de durabilité CSRD/ESRS
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
                Évaluez votre conformité aux Disclosure Requirements des standards ESRS, suivez votre taux de couverture par standard et générez un rapport de conformité prêt à partager.
              </p>
              <div className="space-y-3">
                {[
                  'Couverture des standards ESRS E, S et G',
                  'Évaluation par Disclosure Requirement',
                  'Taux de couverture par standard en temps réel',
                  'Rapport de conformité exportable en PDF',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(14,61,77,0.1)' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="#0e3d4d" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '📊', label: 'Diagnostic CSRD', desc: 'Standards ESRS · E, S, G' },
                { icon: '🌱', label: 'VSME EFRAG', desc: 'Référentiel PME simplifié' },
                { icon: '📋', label: 'Disclosure Requirements', desc: 'Évaluation par exigence' },
                { icon: '📄', label: 'Rapport PDF', desc: 'Export prêt à diffuser' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl p-5 border"
                  style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-semibold text-sm mb-1" style={{ color: '#0e3d4d' }}>{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Hébergement responsable ───────────────────────────────────── */}
      <section className="py-16 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: 'rgba(14,61,77,0.08)' }}
              >
                🌱
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: '#0e3d4d' }}>Hébergement responsable</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  Nos données sont hébergées en Europe chez Vercel et Supabase. Datacenters certifiés ISO 14001 et engagés sur la neutralité carbone.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['🇪🇺 Données en Europe', 'ISO 14001', 'Carbon Neutral', 'RGPD'].map(badge => (
                    <span
                      key={badge}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border"
                      style={{ borderColor: 'rgba(14,61,77,0.2)', color: '#0e3d4d', backgroundColor: 'rgba(14,61,77,0.05)' }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <a
              href="https://www.sensetho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-80 border"
              style={{ borderColor: 'rgba(14,61,77,0.25)', color: '#0e3d4d', backgroundColor: 'rgba(14,61,77,0.05)' }}
            >
              En savoir plus →
            </a>
          </div>
        </div>
      </section>

      {/* ── Vague blanc → #0e3d4d ── */}
      <div className="w-full bg-white dark:bg-gray-950 leading-none">
        <svg
          viewBox="0 0 1440 180"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ display: 'block', marginBottom: '-2px' }}
        >
          <path
            d="M0,70 C180,130 360,20 540,80 C720,140 900,30 1080,90 C1260,145 1360,100 1440,85 L1440,180 L0,180 Z"
            fill="#0e3d4d"
          />
          <path
            d="M0,115 C200,80 400,155 600,118 C800,82 1000,155 1200,122 C1320,104 1390,132 1440,120 L1440,180 L0,180 Z"
            fill="#030a14"
          />
        </svg>
      </div>

      {/* ── CTA + Footer ──────────────────────────────────────────────── */}
      <section className="pt-16 pb-12 overflow-hidden" style={{ backgroundColor: '#030a14' }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-8 text-center mb-16">
          {/* Logo centré */}
          <div className="mx-auto mb-8 w-40 sm:w-52">
            <Image
              src="/logo2.png"
              alt="Sens'ethO Apps"
              width={0}
              height={0}
              sizes="220px"
              className="w-full h-auto rounded-xl opacity-90"
            />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            {S.cta_title}
          </h2>
          <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {S.cta_subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/catalogue"
              className="w-full sm:w-auto rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg hover:opacity-90 transition-all border border-white/20"
              style={{ backgroundColor: '#0e3d4d' }}
            >
              Découvrir les applications
            </Link>
            <a
              href="mailto:sylvain.cassaro@sensetho.com"
              className="w-full sm:w-auto rounded-xl border px-8 py-4 text-base font-medium transition-all hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
            >
              Contacter l&apos;équipe
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12 border-t pt-8"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {S.footer_tagline}
              </p>
              <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Un service de <span style={{ color: 'rgba(255,255,255,0.6)' }}>{S.company_name}</span>
              </p>
            </div>
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Applications
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <li>RSE &amp; ISO 26000</li>
                <li>CSRD / ESRS &amp; VSME</li>
                <li>Parties Prenantes</li>
                <li>Business &amp; Organisations</li>
              </ul>
            </div>
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Informations légales
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/mentions-legales" className="text-white/45 hover:text-white transition-colors">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/cgv" className="text-white/45 hover:text-white transition-colors">
                    Conditions Générales de Vente
                  </Link>
                </li>
                <li>
                  <Link href="/cgu" className="text-white/45 hover:text-white transition-colors">
                    Conditions Générales d&apos;Utilisation
                  </Link>
                </li>
                <li>
                  <Link href="/politique-de-confidentialite" className="text-white/45 hover:text-white transition-colors">
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <a href="https://www.sensetho.com" target="_blank" rel="noopener noreferrer" className="text-white/45 hover:text-white transition-colors">
                    🌱 Hébergement responsable
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div
            className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
          >
            <p>© {new Date().getFullYear()} SCDB PRO SARL — Sens&apos;ethO Apps. Tous droits réservés.</p>
            <a
              href="mailto:sylvain.cassaro@sensetho.com"
              className="transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              sylvain.cassaro@sensetho.com
            </a>
          </div>
        </div>
      </section>

      </main>
    </div>
  )
}
