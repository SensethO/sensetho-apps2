import type { MetadataRoute } from 'next'

const BASE = 'https://apps.sensetho.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/catalogue`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/hebergement-responsable`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/engagements-rse`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/cgv`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/cgu`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/politique-de-confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
