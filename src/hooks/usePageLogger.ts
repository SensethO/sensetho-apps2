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
 * Envoie la durée passée sur la page précédente via sendBeacon.
 * sendBeacon fonctionne même si la page est en cours de fermeture.
 */
function sendDuration(logId: string, startTime: number) {
  const durationSeconds = Math.round((Date.now() - startTime) / 1000)
  if (durationSeconds < 1 || !logId) return

  try {
    const blob = new Blob(
      [JSON.stringify({ id: logId, duration_seconds: durationSeconds })],
      { type: 'application/json' }
    )
    navigator.sendBeacon('/api/logs/duration', blob)
  } catch {
    // Fallback : fetch classique si sendBeacon non disponible
    fetch('/api/logs/duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: logId, duration_seconds: durationSeconds }),
      keepalive: true,
    }).catch(() => {})
  }
}

/**
 * Hook qui enregistre automatiquement les visites de pages et le temps passé.
 * - Crée une entrée de log à l'arrivée sur la page
 * - Met à jour la durée à chaque navigation, fermeture d'onglet ou tab mis en arrière-plan
 */
export function usePageLogger() {
  const pathname   = usePathname()
  const logIdRef   = useRef<string | null>(null)
  const startTime  = useRef<number>(0)
  const lastPath   = useRef<string | null>(null)
  const isSending  = useRef(false)

  // ── Créer un log à chaque changement de page ──────────────────────────────
  useEffect(() => {
    if (pathname === lastPath.current || isSending.current) return

    // Envoyer la durée pour la page PRÉCÉDENTE avant de logger la nouvelle
    if (logIdRef.current && startTime.current) {
      sendDuration(logIdRef.current, startTime.current)
    }

    lastPath.current = pathname
    isSending.current = true
    startTime.current = Date.now()
    logIdRef.current  = null

    const log = async () => {
      try {
        const res = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path:      pathname,
            referrer:  document.referrer || null,
            screen:    `${window.screen.width}×${window.screen.height}`,
            sessionId: getSessionId(),
          }),
          keepalive: true,
        })
        const { id } = await res.json() as { id?: string }
        if (id) logIdRef.current = id
      } catch {
        // Silencieux
      } finally {
        isSending.current = false
      }
    }

    const t = setTimeout(log, 500)
    return () => clearTimeout(t)
  }, [pathname])

  // ── Gérer fermeture d'onglet et mise en arrière-plan ─────────────────────
  useEffect(() => {
    function handleVisibilityChange() {
      // L'utilisateur quitte le tab ou ferme l'onglet
      if (document.hidden && logIdRef.current && startTime.current) {
        sendDuration(logIdRef.current, startTime.current)
        // Réinitialiser pour éviter un double envoi
        logIdRef.current = null
      }
    }

    function handleBeforeUnload() {
      if (logIdRef.current && startTime.current) {
        sendDuration(logIdRef.current, startTime.current)
        logIdRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, []) // Une seule fois — les refs persistent
}
