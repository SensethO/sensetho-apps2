import type { Metadata } from 'next'

// Les pages d'authentification ne doivent jamais être indexées : chaque URL
// protégée redirige vers /auth/login?next=… et Google y voyait des « pages
// en double sans URL canonique » (rapport Search Console).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
