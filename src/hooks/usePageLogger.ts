'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ID de session unique par onglet (survit aux navigations mais pas aux rechargements)
let _sessionId: string | null = null
function getSessionId() {
  if (!_sessionId) _sessionId = crypto.randomUUID()
  return _sessionId
}

/**
 * Hook qui enregistre automatiquement les visites de pages.
 * À placer dans AppShell (pages authentifiées) et les layouts publics.
 * L'envoi est "fire-and-forget" — n'impacte jamais l'expérience utilisateur.
 */
export function usePageLogger() {
  const pathname  = usePathname()
  const lastPath  = useRef<string | null>(null)
  const isSending = useRef(false)

  useEffect(() => {
    // Éviter les doubles envois sur la même page
    if (pathname === lastPath.current || isSending.current) return
    lastPath.current = pathname
    isSending.current = true

    const log = async () => {
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path:      pathname,
            referrer:  document.referrer || null,
            screen:    `${window.screen.width}×${window.screen.height}`,
            sessionId: getSessionId(),
          }),
          keepalive: true, // Permet l'envoi même si la page se ferme
        })
      } catch {
        // Silencieux — ne jamais bloquer
      } finally {
        isSending.current = false
      }
    }

    // Petit délai pour laisser le composant se monter complètement
    const t = setTimeout(log, 500)
    return () => clearTimeout(t)
  }, [pathname])
}
