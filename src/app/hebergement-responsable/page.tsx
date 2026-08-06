import Link from 'next/link'
import type { Metadata } from 'next'

// Page PUBLIQUE (déclarée dans PUBLIC_ROUTES du middleware) : engagements
// d'hébergement de la plateforme. Règle de rédaction : uniquement des faits
// vérifiés dans l'architecture ou auprès des fournisseurs — pas de promesses.
export const metadata: Metadata = {
  title: 'Hébergement responsable — Sens\'ethO Apps',
  description:
    'Où sont vos données, comment elles circulent, ce que nous ne faisons pas : les engagements d\'hébergement de la plateforme Sens\'ethO Apps.',
}

const SECTIONS = [
  {
    icon: '📍',
    titre: 'Vos données sont hébergées en France',
    points: [
      'Les pages et fonctions de la plateforme s\'exécutent chez Vercel dans la région Paris (cdg1).',
      'La base de données PostgreSQL est opérée par Supabase à Paris (région AWS eu-west-3).',
      'Vos documents (factures, justificatifs, annexes, certificats) ne sont jamais stockés chez nous : ils restent dans le SharePoint Microsoft 365 de votre organisation, sous votre contrat et votre gouvernance.',
    ],
  },
  {
    icon: '🔄',
    titre: 'Zéro copie intermédiaire de vos fichiers',
    points: [
      'Quand vous déposez un fichier, votre navigateur l\'envoie directement à Microsoft SharePoint — il ne transite jamais par nos serveurs.',
      'Quand vous le téléchargez, une URL signée temporaire vous connecte directement à SharePoint.',
      'Nos bases ne conservent que des références (nom, type, emplacement), jamais le contenu des fichiers.',
    ],
  },
  {
    icon: '🌱',
    titre: 'Sobriété par conception',
    points: [
      'Les rapports PDF sont générés dans votre navigateur, pas sur une ferme de serveurs.',
      'Les exports Excel sont produits à la demande, rien n\'est pré-calculé ni dupliqué.',
      'Aucun pisteur publicitaire, aucune régie, aucun script tiers de mesure d\'audience.',
    ],
  },
  {
    icon: '🔐',
    titre: 'Sécurité et cloisonnement',
    points: [
      'Chaque organisation ne voit que ses données : le cloisonnement est appliqué au niveau de la base elle-même (Row Level Security), pas seulement dans l\'interface.',
      'Les identifiants d\'intégrations (banque Qonto, système TRACES de la Commission européenne) sont chiffrés en AES-256-GCM — jamais affichés, jamais journalisés.',
      'Tout le trafic est chiffré (HTTPS/TLS).',
    ],
  },
  {
    icon: '🤖',
    titre: 'IA : en transit, jamais en stock',
    points: [
      'Certaines fonctions (analyse de certificats, ventilation comptable de transactions) font appel à l\'API Anthropic (Claude).',
      'Les documents et libellés analysés transitent le temps de l\'appel puis sont restitués — nous n\'en conservons aucune copie et ils ne servent pas à entraîner des modèles.',
    ],
  },
]

export default function HebergementResponsablePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* En-tête */}
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[#0e3d4d] dark:text-teal-300">
            ← Sens&rsquo;ethO Apps
          </Link>
          <Link href="/catalogue" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            Catalogue des applications
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center px-4">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-[#0e3d4d] dark:text-teal-300">
          Hébergement responsable
        </h1>
        <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300">
          Où sont vos données, comment elles circulent, et ce que nous ne faisons pas.
          Cette page ne contient que des engagements vérifiables dans l&rsquo;architecture
          de la plateforme — pas de promesses.
        </p>
      </section>

      {/* Sections */}
      <section className="pb-16 px-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {SECTIONS.map((s) => (
            <div
              key={s.titre}
              className="rounded-2xl border p-6"
              style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}
            >
              <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-[#0e3d4d] dark:text-teal-300">
                <span className="text-2xl">{s.icon}</span> {s.titre}
              </h2>
              <ul className="space-y-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="mt-0.5 flex-shrink-0 text-[#0e3d4d] dark:text-teal-400">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-4">
            Nos fournisseurs : Vercel (hébergement applicatif, région Paris) · Supabase (base de données PostgreSQL, Paris) ·
            Microsoft 365 (documents, dans votre tenant) · Anthropic (IA, sans conservation).
            Des questions sur nos choix d&rsquo;hébergement ? Écrivez-nous via la page{' '}
            <Link href="/catalogue" className="underline hover:text-gray-600">catalogue</Link> ou consultez la{' '}
            <Link href="/politique-de-confidentialite" className="underline hover:text-gray-600">politique de confidentialité</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}
