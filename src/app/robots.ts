import type { MetadataRoute } from 'next'

// Seules les pages publiques ont vocation à être indexées ; tout l'espace
// connecté (redirigé vers /auth/login) est exclu pour éviter que Google
// n'indexe des copies de la page de connexion.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/auth/',
          '/dashboard',
          '/account',
          '/admin/',
          '/api/',
          '/rse/',
          '/business/',
          '/metier/',
          '/miroir/',
          '/enquete',
        ],
      },
    ],
    sitemap: 'https://apps.sensetho.com/sitemap.xml',
  }
}
