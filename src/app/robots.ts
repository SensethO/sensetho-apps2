import type { MetadataRoute } from 'next'

// ⚠️ Règle SEO à ne pas défaire (leçon du 06/09/2026, alerte Search Console
// « Indexée malgré le blocage par le fichier robots.txt ») :
//
//   robots.txt Disallow + balise noindex sur la MÊME URL = contradiction.
//   Une URL bloquée n'est pas explorée, donc Google ne LIT JAMAIS son noindex :
//   il peut l'indexer quand même (découverte par un lien), et on n'a plus aucun
//   moyen de la faire sortir de l'index.
//
// Donc :
// - pour DÉSINDEXER (espace connecté) → laisser explorer. Chaque route protégée
//   redirige vers /auth/login, qui porte noindex (src/app/auth/layout.tsx) :
//   Google suit, lit le noindex, et nettoie son index.
// - pour NE JAMAIS ÊTRE EXPLORÉ (liens à jeton, API) → Disallow, car ces URLs
//   ne sont liées nulle part : le risque d'indexation est nul, et on veut
//   surtout éviter qu'un lien d'invitation fuité soit exploré.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',      // routes serveur : aucun contenu à indexer
          '/miroir/',   // participation au Miroir par lien d'invitation (jeton)
          '/enquete',   // questionnaire parties prenantes par lien (jeton)
        ],
      },
    ],
    sitemap: 'https://apps.sensetho.com/sitemap.xml',
  }
}
