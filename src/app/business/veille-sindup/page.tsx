'use client'

// App « Veille stratégique (Sindup) » — carte catalogue vers le service externe
// app.sindup.com. L'iframe est impossible (X-Frame-Options: sameorigin +
// frame-ancestors 'self' vérifiés le 2026-08-07) : la page présente l'outil et
// ouvre Sindup dans un nouvel onglet. Un approfondissement API (flux de veille
// dans la plateforme, identifiants chiffrés par organisation comme Qonto) est
// possible si un abonnement Sindup avec API est disponible.
import Link from 'next/link'
import RequireSubscription from '@/components/rse/RequireSubscription'

const ATOUTS = [
  { icon: '📡', titre: 'Surveillance multi-sources', desc: 'Presse en ligne, réseaux sociaux, forums, blogs, flux RSS — Sindup collecte en continu les mentions de vos marques, concurrents et sujets stratégiques.' },
  { icon: '🎯', titre: 'Ciblage et alertes', desc: 'Requêtes de veille affinées par mots-clés et filtres, alertes en temps réel, newsletters de veille à diffuser en interne.' },
  { icon: '📊', titre: 'Analyse et tableaux de bord', desc: 'Tendances, tonalité, parts de voix, influenceurs — des indicateurs pour piloter votre réputation et votre marché.' },
  { icon: '🤝', titre: 'Complémentaire à votre démarche', desc: 'La veille alimente vos diagnostics : signaux faibles réglementaires (CSRD, EUDR…), attentes des parties prenantes, réputation RSE.' },
]

export default function VeilleSindupPage() {
  return (
    <RequireSubscription appSlug="veille-sindup" appName="Veille stratégique (Sindup)">
      <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="border-b border-gray-100 dark:border-gray-800">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="font-semibold text-[#0e3d4d] dark:text-teal-300">← Sens&rsquo;ethO Apps</Link>
            <Link href="/catalogue" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Catalogue</Link>
          </div>
        </header>

        {/* Hero */}
        <section className="py-16 text-center px-4">
          <div className="text-5xl mb-4">📡</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-[#0e3d4d] dark:text-teal-300">
            Veille stratégique — Sindup
          </h1>
          <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300 mb-8">
            Sindup est une plateforme française de veille stratégique et d&rsquo;e-réputation.
            Surveillez votre marché, vos concurrents et votre réputation — et nourrissez
            votre démarche d&rsquo;engagement avec des signaux frais.
          </p>
          <a
            href="https://app.sindup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#0e3d4d' }}
          >
            Ouvrir Sindup →
          </a>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            S&rsquo;ouvre dans un nouvel onglet — connexion avec votre compte Sindup.
          </p>
        </section>

        {/* Atouts */}
        <section className="pb-16 px-4">
          <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ATOUTS.map(a => (
              <div key={a.titre} className="rounded-2xl border p-6" style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}>
                <div className="text-2xl mb-2">{a.icon}</div>
                <h2 className="font-semibold text-sm mb-1 text-[#0e3d4d] dark:text-teal-300">{a.titre}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto max-w-3xl text-xs text-gray-400 dark:text-gray-500 text-center pt-8">
            Sindup est un service tiers, avec son propre compte et sa propre tarification (sindup.com).
            L&rsquo;interface s&rsquo;ouvre en dehors de la plateforme : Sindup n&rsquo;autorise pas
            l&rsquo;intégration en iframe. Vous disposez d&rsquo;un abonnement Sindup avec accès API ?
            Une intégration profonde (flux de veille directement dans la plateforme) est possible —
            parlez-en à votre administrateur.
          </p>
        </section>
      </main>
    </RequireSubscription>
  )
}
