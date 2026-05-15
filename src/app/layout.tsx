import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sensetho Apps',
  description: 'Portail applicatif Sensetho',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}
