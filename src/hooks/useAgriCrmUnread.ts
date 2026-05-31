'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Compte les messages CRM non lus pour l'utilisateur courant.
 * Utilisé sur le Dashboard et dans la sidebar pour afficher un badge
 * sur l'app AgriTracker quand de nouveaux messages arrivent.
 * Polling toutes les 30 secondes.
 */
export function useAgriCrmUnread() {
  const [unread, setUnread] = useState(0)

  const fetch_ = useCallback(() => {
    Promise.all([
      fetch('/api/agri/crm/conversations?mode=acheteur').then(r => r.ok ? r.json() : { conversations: [] }),
      fetch('/api/agri/crm/conversations?mode=planteur').then(r => r.ok ? r.json() : { conversations: [] }),
    ]).then(([a, p]) => {
      const total =
        ((a.conversations ?? []) as { unread_count: number }[]).reduce((s, c) => s + (c.unread_count ?? 0), 0) +
        ((p.conversations ?? []) as { unread_count: number }[]).reduce((s, c) => s + (c.unread_count ?? 0), 0)
      setUnread(total)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, 30_000)
    return () => clearInterval(t)
  }, [fetch_])

  return unread
}
