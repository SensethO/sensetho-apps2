'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * useFavorites — stockage Supabase (user_app_favorites)
 *
 * - Chargement initial depuis Supabase (cross-browser, cross-appareil)
 * - Migration automatique des favoris localStorage existants au 1er chargement
 * - Optimistic UI : la mise à jour locale est immédiate, Supabase suit en arrière-plan
 * - Realtime Supabase : synchronisation entre onglets et navigateurs
 */
export function useFavorites(userId: string | null | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const migratedRef = useRef(false)

  // ── Chargement initial + migration localStorage ────────────────────────────
  useEffect(() => {
    if (!userId) { setFavoriteIds([]); return }

    const supabase = createClient()
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // 1. Charger depuis Supabase
        const { data, error } = await supabase
          .from('user_app_favorites')
          .select('app_id')
          .eq('user_id', userId)

        if (cancelled) return
        if (error) { console.error('[useFavorites] load error', error); return }

        const dbIds = (data ?? []).map((r: { app_id: string }) => r.app_id)

        // 2. Migration one-shot depuis localStorage (1ère connexion sur ce navigateur)
        if (!migratedRef.current) {
          migratedRef.current = true
          try {
            const lsKey = `fav_apps_${userId}`
            const raw = localStorage.getItem(lsKey)
            if (raw) {
              const lsIds: string[] = JSON.parse(raw)
              const toMigrate = lsIds.filter(id => !dbIds.includes(id))
              if (toMigrate.length > 0) {
                const rows = toMigrate.map(app_id => ({ user_id: userId, app_id }))
                await supabase.from('user_app_favorites').upsert(rows, { ignoreDuplicates: true })
                dbIds.push(...toMigrate)
              }
              // Nettoyer localStorage après migration
              localStorage.removeItem(lsKey)
            }
          } catch { /* migration silencieuse */ }
        }

        if (!cancelled) setFavoriteIds(dbIds)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  // ── Realtime — synchronisation cross-onglets / cross-navigateurs ───────────
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`favorites:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_app_favorites',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (payload.eventType === 'INSERT') {
            const appId = payload.new['app_id'] as string
            setFavoriteIds(prev => prev.includes(appId) ? prev : [...prev, appId])
          } else if (payload.eventType === 'DELETE') {
            const appId = payload.old['app_id'] as string
            setFavoriteIds(prev => prev.filter(id => id !== appId))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Toggle favori (optimistic) ─────────────────────────────────────────────
  const toggleFavorite = useCallback(async (appId: string) => {
    if (!userId) return

    const supabase = createClient()
    const isCurrentlyFav = favoriteIds.includes(appId)

    // Optimistic update
    setFavoriteIds(prev =>
      isCurrentlyFav ? prev.filter(id => id !== appId) : [...prev, appId]
    )

    if (isCurrentlyFav) {
      const { error } = await supabase
        .from('user_app_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('app_id', appId)
      if (error) {
        console.error('[useFavorites] delete error', error)
        // Rollback
        setFavoriteIds(prev => [...prev, appId])
      }
    } else {
      const { error } = await supabase
        .from('user_app_favorites')
        .upsert({ user_id: userId, app_id: appId }, { ignoreDuplicates: true })
      if (error) {
        console.error('[useFavorites] insert error', error)
        // Rollback
        setFavoriteIds(prev => prev.filter(id => id !== appId))
      }
    }
  }, [userId, favoriteIds])

  const isFavorite = useCallback((appId: string) => favoriteIds.includes(appId), [favoriteIds])

  return { favoriteIds, toggleFavorite, isFavorite, loading }
}
