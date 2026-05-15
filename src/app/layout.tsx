import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

export const metadata: Metadata = {
  title: 'Sensetho Apps',
  description: 'Portail applicatif Sensetho',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
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
