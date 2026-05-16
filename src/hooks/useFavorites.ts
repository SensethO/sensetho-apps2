'use client'

import { useState, useCallback, useEffect } from 'react'

const BROADCAST = 'favorites-updated'

function storageKey(userId: string) {
  return `fav_apps_${userId}`
}

export function useFavorites(userId: string | null | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  // Lecture initiale
  useEffect(() => {
    if (!userId) { setFavoriteIds([]); return }
    try {
      const raw = localStorage.getItem(storageKey(userId))
      setFavoriteIds(raw ? JSON.parse(raw) : [])
    } catch { setFavoriteIds([]) }
  }, [userId])

  // Synchronisation entre onglets
  useEffect(() => {
    if (!userId) return
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(BROADCAST)
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.userId === userId) setFavoriteIds(e.data.ids)
      }
    } catch { /* navigateur sans support */ }
    return () => { bc?.close() }
  }, [userId])

  const toggleFavorite = useCallback((appId: string) => {
    if (!userId) return
    setFavoriteIds(prev => {
      const next = prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next))
        new BroadcastChannel(BROADCAST).postMessage({ userId, ids: next })
      } catch { /* silencieux */ }
      return next
    })
  }, [userId])

  const isFavorite = useCallback((appId: string) => favoriteIds.includes(appId), [favoriteIds])

  return { favoriteIds, toggleFavorite, isFavorite }
}
