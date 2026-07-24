import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: "Sens'ethO Apps — Se voir agir, retrouver du sens",
  description: "La plateforme d'applications Sens'ethO : observez ce que votre organisation fait vraiment, formulez sa raison d'être, tenez vos engagements — diagnostics, dialogue, mesure et preuve (ISO 26000, CSRD/ESRS, VSME), et applications métier.",
  icons: {
    icon: '/favicon-32x32.png',
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon-32x32.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Anti-flash : applique le thème avant le rendu */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=localStorage.getItem('theme')||'system';
            if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
              document.documentElement.classList.add('dark');
            }
          })()
        `}} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
