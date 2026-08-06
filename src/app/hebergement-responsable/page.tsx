import Link from 'next/link'

// Portée de sensetho-apps v1 (src/app/hebergement-responsable) le 2026-08-06,
// adaptée v2 : SharePoint multi-tenant (documents dans le tenant du client),
// note IA/banque en transit, liens engagements-rse. Page PUBLIQUE (middleware).
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Hébergement Responsable | Sens\'ethO',
  description: 'Découvrez nos engagements pour un hébergement numérique responsable : localisation des données, certifications environnementales, et engagements carbone de nos partenaires.',
}

const PROVIDERS = [
  {
    name: 'Vercel',
    role: 'Hébergement de la plateforme',
    logo: '⚡',
    location: 'CDG1 — Paris, France (AWS eu-west-3)',
    flag: '🇫🇷',
    color: 'from-slate-800 to-slate-900',
    badges: ['RGPD ✓', 'EU-US DPF ✓', 'ISO 27001 (via AWS)', 'SOC 2 Type II'],
    carbon: 'Architecture serverless — consommation énergétique réduite. AWS a atteint 100% d\'électricité renouvelable dès 2023, sept ans avant son objectif, via des accords d\'achat d\'énergie (PPA).',
    dataResidence: 'Fonctions serverless en région CDG1 (Paris). Les assets statiques sont distribués via le réseau edge mondial.',
    url: 'https://vercel.com/legal/privacy-policy',
    certUrl: 'https://vercel.com/docs/security/compliance',
    note: null,
  },
  {
    name: 'Supabase',
    role: 'Base de données & Authentification',
    logo: '🗄️',
    location: 'EU-WEST-3 — Paris, France (AWS)',
    flag: '🇫🇷',
    color: 'from-emerald-800 to-emerald-900',
    badges: ['RGPD ✓', 'SOC 2 Type II', 'ISO 27001', 'HIPAA compliant'],
    carbon: 'Infrastructure AWS Europe. AWS a atteint 100% d\'électricité renouvelable sur l\'ensemble de ses opérations dès 2023, sept ans avant son objectif de 2025, via des accords d\'achat d\'énergie (PPA).',
    dataResidence: 'Données structurées (comptes, diagnostics RSE, sessions, résultats) stockées en région Paris (France). Les données ne quittent pas l\'Union Européenne.',
    url: 'https://supabase.com/privacy',
    certUrl: 'https://supabase.com/docs/guides/platform/security',
    note: null,
  },
  {
    name: 'Microsoft SharePoint',
    role: 'Stockage des fichiers utilisateurs',
    logo: '📁',
    location: 'Azure — Europe (France Central / North Europe)',
    flag: '🇪🇺',
    color: 'from-blue-800 to-blue-900',
    badges: ['RGPD ✓', 'ISO 27001 ✓', 'ISO 14001 ✓', 'SOC 2 Type II', 'Carbon Negative 2030'],
    carbon: 'Microsoft s\'engage à être carbon-negative d\'ici 2030 et à effacer toutes ses émissions historiques d\'ici 2050. 100% énergie renouvelable d\'ici 2030 via accords PPA directs.',
    dataResidence: 'Tous les fichiers déposés par les utilisateurs (pièces jointes des diagnostics RSE, factures des apps budget, dossiers documentaires) sont stockés exclusivement sur SharePoint via Microsoft Graph API — dans le tenant Microsoft 365 de votre organisation, sous votre contrat et votre gouvernance. Les fichiers transitent directement du navigateur vers SharePoint — Vercel ne stocke aucun fichier. Les données restent dans les datacenters Microsoft en Europe.',
    url: 'https://privacy.microsoft.com/fr-fr/privacystatement',
    certUrl: 'https://datacenters.microsoft.com/sustainability/',
    note: 'Les fichiers ne transitent pas par Vercel : l\'upload se fait via une session Microsoft Graph directement vers SharePoint, ce qui réduit la bande passante et l\'empreinte carbone de la plateforme.',
  },
  {
    name: 'GitHub / Microsoft Azure',
    role: 'Hébergement du code source',
    logo: '🐙',
    location: 'Azure — Datacenters Européens (Dublin, Frankfurt)',
    flag: '🇪🇺',
    color: 'from-gray-800 to-gray-900',
    badges: ['RGPD ✓', 'ISO 14001 ✓', 'ISO 50001 ✓', 'LEED Gold', 'Carbon Negative 2030'],
    carbon: 'Microsoft s\'engage à être carbon-negative d\'ici 2030 et à effacer toutes ses émissions historiques d\'ici 2050. Certifications Zero Waste sur plusieurs sites.',
    dataResidence: 'Code source de la plateforme hébergé sur l\'infrastructure Microsoft Azure via GitHub. Options de résidence des données en UE disponibles.',
    url: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
    certUrl: 'https://datacenters.microsoft.com/sustainability/',
    note: 'Microsoft est l\'acteur avec les certifications environnementales les plus solides de notre chaîne de valeur.',
  },
]

const CERTIF_GLOSSARY = [
  { code: 'ISO 14001', name: 'Système de Management Environnemental', desc: 'Norme internationale certifiant qu\'une organisation gère activement son impact environnemental.' },
  { code: 'ISO 50001', name: 'Système de Management de l\'Énergie', desc: 'Certifie la mise en place d\'une politique d\'amélioration continue de la performance énergétique.' },
  { code: 'LEED', name: 'Leadership in Energy and Environmental Design', desc: 'Certification américaine pour les bâtiments durables, évaluant l\'efficacité énergétique et l\'impact environnemental.' },
  { code: 'SOC 2', name: 'Service Organization Control 2', desc: 'Certification de sécurité des données (confidentialité, disponibilité, intégrité).' },
  { code: 'RGPD', name: 'Règlement Général sur la Protection des Données', desc: 'Règlement européen qui protège les données personnelles des citoyens de l\'UE.' },
  { code: 'PPA', name: 'Power Purchase Agreement', desc: 'Contrat d\'achat d\'énergie renouvelable à long terme, permettant de financer directement des fermes éoliennes ou solaires.' },
  { code: 'Graph API', name: 'Microsoft Graph API', desc: 'Interface unifiée Microsoft permettant d\'accéder aux services Microsoft 365 (SharePoint, OneDrive, etc.). Utilisée pour uploader et télécharger les fichiers utilisateurs directement depuis le navigateur vers SharePoint, sans stockage intermédiaire sur Vercel.' },
  { code: 'SharePoint', name: 'Microsoft SharePoint Online', desc: 'Plateforme de stockage et de gestion documentaire Microsoft 365. Utilisée par Sens\'ethO Apps pour stocker les fichiers déposés dans les applications (pièces jointes des diagnostics RSE, factures des apps budget) — dans le tenant Microsoft 365 de chaque organisation cliente. Infrastructure hébergée sur Microsoft Azure en Europe.' },
]

// Services appelés ponctuellement, sans stockage : les contenus transitent le
// temps de l'appel puis sont restitués (voir la politique de confidentialité).
const TRANSIT_SERVICES = [
  { logo: '🤖', name: 'Anthropic (IA Claude)', desc: 'Analyse de certificats et ventilation comptable de libellés bancaires — en transit uniquement, aucune conservation, pas d’entraînement de modèles sur vos données.' },
  { logo: '🏦', name: 'Qonto', desc: 'Lecture des transactions bancaires si votre organisation connecte son compte — identifiants chiffrés (AES-256-GCM), aucun ordre de paiement émis.' },
]

export default function HebergementResponsablePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[#0e3d4d] dark:text-teal-300">← Sens&rsquo;ethO Apps</Link>
          <Link href="/engagements-rse" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">🪞 Nos engagements RSE</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0e3d4d' }}>
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-6 bg-white/10 text-white/80">
            <span>🌿</span> Engagement RSE — Numérique Responsable
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Notre hébergement, notre responsabilité
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            Nous accompagnons des entreprises dans leur démarche RSE. Il nous appartient d&apos;appliquer
            à nous-mêmes les mêmes exigences de transparence et de responsabilité environnementale.
          </p>
        </div>
      </section>

      {/* Intro engagement */}
      <section className="py-12 px-4 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: '📍', title: 'Données en France & UE', desc: 'Données structurées hébergées à Paris (France). Fichiers utilisateurs sur Microsoft Azure (UE).' },
              { icon: '📁', title: 'Fichiers sur SharePoint', desc: 'Pièces jointes diagnostics et dossiers clients stockés sur Microsoft SharePoint via Graph API — aucun fichier ne transite par Vercel.' },
              { icon: '🌱', title: 'Énergie renouvelable', desc: 'Nos partenaires s\'engagent sur des objectifs 100% énergies renouvelables (AWS, Microsoft Azure).' },
              { icon: '🔒', title: 'RGPD & Souveraineté', desc: 'Conformité RGPD totale. Vos données et fichiers ne quittent pas le territoire européen.' },
            ].map(item => (
              <div key={item.title} className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fournisseurs */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Nos partenaires d&apos;hébergement</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-10">
            Détail de la chaîne technique et des engagements environnementaux de chaque fournisseur.
          </p>

          <div className="space-y-6">
            {PROVIDERS.map(p => (
              <div key={p.name} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Header */}
                <div className={`bg-gradient-to-r ${p.color} p-5 flex items-start gap-4`}>
                  <div className="text-3xl">{p.logo}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white">{p.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/80">{p.role}</span>
                    </div>
                    <p className="text-sm text-white/70 mt-1">{p.flag} {p.location}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Certifications & Conformité</p>
                    <div className="flex flex-wrap gap-2">
                      {p.badges.map(b => (
                        <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 font-medium">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Résidence des données</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{p.dataResidence}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Engagement carbone & énergie</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{p.carbon}</p>
                  </div>
                  {p.note && (
                    <div className="md:col-span-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">💡 {p.note}</p>
                    </div>
                  )}
                  <div className="md:col-span-2 flex gap-3">
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      Politique de confidentialité →
                    </a>
                    <a href={p.certUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      Certifications & sécurité →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure sous-jacente */}
      <section className="py-12 px-4 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-4xl space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Infrastructures sous-jacentes</h2>

          {/* AWS */}
          <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">☁️ Amazon Web Services — Paris (Vercel &amp; Supabase)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Localisation &amp; certifications</p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Région <strong>eu-west-3 (Paris)</strong> — datacenter en Île-de-France</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Certifié <strong>HDS</strong> (Hébergeur de Données de Santé)</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> ISO 27001, SOC 1/2/3, PCI DSS Level 1</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> <strong>4× plus efficace</strong> qu&apos;une infrastructure on-premises</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Objectifs environnementaux</p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> 100% d&apos;électricité renouvelable atteint <strong>dès 2023</strong> via PPAs (7 ans d&apos;avance)</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> <strong>The Climate Pledge</strong> : net-zéro carbone d&apos;ici 2040</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> PUE parmi les meilleures de l&apos;industrie</li>
                </ul>
                <a href="https://sustainability.aboutamazon.com/products-services/aws-cloud" target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  AWS Sustainability →
                </a>
              </div>
            </div>
          </div>

          {/* Azure */}
          <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">🔷 Microsoft Azure — Europe (SharePoint &amp; GitHub)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stockage des fichiers utilisateurs</p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Pièces jointes des <strong>diagnostics RSE</strong> (ISO 26000, ODD, VSME…) sur SharePoint</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Factures et justificatifs des <strong>apps budget</strong> sur SharePoint</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Upload direct navigateur → SharePoint via <strong>Microsoft Graph API</strong></li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> <strong>Aucun fichier stocké sur Vercel</strong> — zéro transit inutile</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> Datacenters <strong>France Central / North Europe</strong></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Engagements environnementaux Microsoft</p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> <strong>Carbon Negative</strong> d&apos;ici 2030</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> 100% énergie renouvelable <strong>d&apos;ici 2030</strong></li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> Effacement de toutes les émissions historiques <strong>d&apos;ici 2050</strong></li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span> ISO 14001, ISO 50001, LEED Gold</li>
                </ul>
                <a href="https://datacenters.microsoft.com/sustainability/" target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  Microsoft Sustainability →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nos engagements propres */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nos engagements directs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: '🔍', title: 'Transparence totale', desc: 'Cette page détaille l\'ensemble de notre chaîne d\'hébergement, les fournisseurs, les localisations et les certifications.' },
              { icon: '📍', title: 'Données en Europe uniquement', desc: 'Nous avons choisi exclusivement des régions françaises ou européennes pour l\'ensemble de nos services.' },
              { icon: '⚡', title: 'Architecture serverless', desc: 'Pas de serveurs actifs en permanence — les fonctions ne s\'exécutent que lorsqu\'elles sont sollicitées, réduisant la consommation énergétique globale.' },
              { icon: '🔄', title: 'Amélioration continue', desc: 'Nous réévaluons annuellement nos fournisseurs sur leurs critères environnementaux, et favorisons ceux qui progressent vers la neutralité carbone.' },
              { icon: '📊', title: 'Empreinte numérique maîtrisée', desc: 'Optimisation du code, compression des assets, mise en cache agressive — nous réduisons les transferts de données inutiles.' },
              { icon: '🌿', title: 'Cohérence RSE', desc: 'En tant que plateforme RSE, nous nous imposons les mêmes standards que nous recommandons à nos clients.' },
            ].map(item => (
              <div key={item.title} className="p-5 rounded-2xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services en transit (IA, banque) */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Services appelés sans stockage</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Certaines fonctions font appel à des services externes <strong>en transit uniquement</strong> :
            les contenus sont traités le temps de l&apos;appel puis restitués, sans conservation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRANSIT_SERVICES.map(s => (
              <div key={s.name} className="p-5 rounded-2xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                <div className="text-2xl mb-2">{s.logo}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{s.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Glossaire */}
      <section className="py-12 px-4 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Glossaire des certifications</h2>
          <div className="space-y-3">
            {CERTIF_GLOSSARY.map(c => (
              <div key={c.code} className="flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <span className="flex-shrink-0 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded h-fit">
                  {c.code}
                </span>
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 px-4" style={{ backgroundColor: '#0e3d4d' }}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-white/80 text-sm mb-6">
            Des questions sur nos pratiques d&apos;hébergement ou notre politique de confidentialité ?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/20">
              ← Retour à l&apos;accueil
            </Link>
            <a href="mailto:info@sensetho.com?subject=Question hébergement responsable"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
              ✉️ Nous contacter
            </a>
            <Link href="/politique-de-confidentialite"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white/70 hover:text-white transition-colors">
              Politique de confidentialité →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
