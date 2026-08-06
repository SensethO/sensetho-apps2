import Link from 'next/link'
import type { Metadata } from 'next'

// Page PUBLIQUE (déclarée dans PUBLIC_ROUTES du middleware) : les engagements
// RSE de Sens'ethO elle-même. Règle de rédaction : uniquement des engagements
// réels du corpus de marque (raison d'être, règle 20·30·50, Sanctuaire) et des
// pratiques vérifiables — l'état d'avancement est dit honnêtement.
export const metadata: Metadata = {
  title: 'Nos engagements RSE — Sens\'ethO',
  description:
    'Ce que Sens\'ethO s\'applique à elle-même : raison d\'être, lucrativité encadrée (règle 20·30·50), fonds Équité des chances, Sanctuaire, bien-être équin, et nos propres diagnostics.',
}

export default function EngagementsRsePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[#0e3d4d] dark:text-teal-300">
            ← Sens&rsquo;ethO Apps
          </Link>
          <Link href="/hebergement-responsable" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            🌱 Hébergement responsable
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center px-4">
        <div className="text-5xl mb-4">🪞</div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-[#0e3d4d] dark:text-teal-300">
          Nos engagements RSE
        </h1>
        <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300">
          Nous vendons des outils pour se voir agir — alors nous commençons par nous-mêmes.
          Voici ce que Sens&rsquo;ethO s&rsquo;impose, noir sur blanc, avec l&rsquo;état
          d&rsquo;avancement réel de chaque engagement.
        </p>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* Raison d'être */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-[#0e3d4d] dark:text-teal-300">
              <span className="text-2xl">🧭</span> Une raison d&rsquo;être qui engage
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Aider les organisations à se voir agir et à retrouver du sens — <em>et dont les fruits
              financent l&rsquo;équité des chances</em>. Cette raison d&rsquo;être n&rsquo;est pas un slogan :
              elle structure les statuts de l&rsquo;entreprise (société de l&rsquo;ESS au sens de la loi
              n°&nbsp;2014-856, à gouvernance en collèges et qualité de société à mission,
              <strong> en cours de constitution</strong>) et se décline en cinq objectifs statutaires :
              le sens et l&rsquo;humain, les gouvernances partagées, le vivant, l&rsquo;équité des chances
              et le bien-être animal — notamment équin.
            </p>
          </div>

          {/* 20-30-50 */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-[#0e3d4d] dark:text-teal-300">
              <span className="text-2xl">⚖️</span> Lucrativité encadrée : la règle 20·30·50
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
              La répartition des bénéfices est fixée par les statuts, pas par l&rsquo;humeur des exercices :
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-2"><span className="font-bold text-[#0e3d4d] dark:text-teal-300 flex-shrink-0 w-12">20 %</span> au fonds de développement (réserve ESS, dotée sans plafond par choix statutaire — au-delà du minimum légal).</li>
              <li className="flex gap-2"><span className="font-bold text-[#0e3d4d] dark:text-teal-300 flex-shrink-0 w-12">30 %</span> au fonds « Équité des chances » : une réserve impartageable investie en infrastructures au service d&rsquo;associations.</li>
              <li className="flex gap-2"><span className="font-bold text-[#0e3d4d] dark:text-teal-300 flex-shrink-0 w-12">50 %</span> en report à nouveau et fonds propres — la solidité de l&rsquo;outil de travail.</li>
            </ul>
          </div>

          {/* Sanctuaire */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-[#0e3d4d] dark:text-teal-300">
              <span className="text-2xl">🐴</span> Le Sanctuaire : à quoi servent les 30 %
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Le fonds Équité des chances finance un lieu de reconnexion à la nature — le
              <strong> Sanctuaire</strong>, à Lisieux (Calvados) : centre équestre de médiation,
              ferme pédagogique, hébergement pour des séjours résidentiels et maison des associations.
              Il est mis à disposition d&rsquo;associations œuvrant pour l&rsquo;égalité des chances —
              en premier lieu <a href="https://monheure.fr" target="_blank" rel="noopener noreferrer" className="underline">Mon Heure, vers le BONHEUR&nbsp;!</a> —
              au bénéfice des enfants et adolescents de l&rsquo;Aide Sociale à l&rsquo;Enfance et de ceux
              vivant sous le seuil de pauvreté, en France. Trajectoire par étapes : séances financées,
              puis convention pluriannuelle, puis acquisition du lieu.
              Les chevaux de médiation ont leur propre charte de bien-être équin —
              « le Bestiaire nous inspire ; nous le lui rendons ».
            </p>
          </div>

          {/* Nos propres outils */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(14,61,77,0.15)', backgroundColor: 'rgba(14,61,77,0.03)' }}>
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2 text-[#0e3d4d] dark:text-teal-300">
              <span className="text-2xl">🪞</span> Nous utilisons nos propres instruments
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Les diagnostics que nous proposons (ISO 26000, ODD, Le Miroir…) sont d&rsquo;abord passés
              sur Sens&rsquo;ethO elle-même : c&rsquo;est la condition pour en parler honnêtement.
              Nos engagements opérationnels vérifiables aujourd&rsquo;hui : des{' '}
              <Link href="/hebergement-responsable" className="underline">choix d&rsquo;hébergement responsables</Link>{' '}
              (données en France, zéro copie de vos fichiers, sobriété par conception) et une{' '}
              <Link href="/politique-de-confidentialite" className="underline">politique de confidentialité</Link>{' '}
              tenue à jour au rythme des fonctionnalités.
            </p>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-4">
            Cette page distingue l&rsquo;acquis du visé : la structure ESS et le Sanctuaire sont des
            engagements statutaires en cours de réalisation ; l&rsquo;hébergement et la protection des
            données sont vérifiables dès aujourd&rsquo;hui. Nous mettrons cette page à jour à chaque étape franchie.
          </p>
        </div>
      </section>
    </main>
  )
}
