'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppCategory, App } from '@/types'

const CHANNEL_NAME = 'apps-updated'

// ── Cache module-level : survit aux remontages d'AppShell ────────────────────
// Quand l'utilisateur change de page, AppShell se remonte mais les catégories
// sont déjà disponibles instantanément sans nouveau fetch réseau.
let _cachedCategories: AppCategory[] = []
let _lastFetchMs = 0
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

/** Retourne les catégories actuellement en cache (pour initialiser le Sidebar) */
export function getCachedAppCategories() { return _cachedCategories }

/** Notifie tous les onglets + le même onglet qu'il faut recharger le menu */
export function broadcastAppsUpdate() {
  _cachedCategories = []           // invalider le cache
  _lastFetchMs = 0
  // Même onglet
  window.dispatchEvent(new CustomEvent(CHANNEL_NAME))
  // Autres onglets
  try { new BroadcastChannel(CHANNEL_NAME).postMessage('reload') } catch { /* navigateur sans support */ }
}

export function useApps(isAdmin: boolean) {
  // Initialiser avec le cache → sidebar visible immédiatement
  const [categories, setCategories] = useState<AppCategory[]>(_cachedCategories)
  const [loading, setLoading] = useState(_cachedCategories.length === 0)

  const loadApps = useCallback(async () => {
    // Si le cache est frais, l'utiliser directement (pas de flash, pas de réseau)
    const now = Date.now()
    if (_cachedCategories.length > 0 && now - _lastFetchMs < CACHE_TTL_MS) {
      setCategories(_cachedCategories)
      setLoading(false)
      return
    }
    const supabase = createClient()
    setLoading(true)

    let catQuery = supabase
      .from('app_categories')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (!isAdmin) catQuery = catQuery.eq('is_admin_only', false)

    let appQuery = supabase
      .from('apps')
      .select('*')
      .eq('is_active', true)
      .order('order_index')

    if (!isAdmin) appQuery = appQuery.eq('is_admin_only', false)

    const queries: Promise<unknown>[] = [catQuery, appQuery]

    // Pour les non-admins, on récupère aussi les abonnements actifs de l'utilisateur
    if (!isAdmin) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        queries.push(
          supabase
            .from('app_subscriptions')
            .select('app_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
        )
      }
    }

    const results = await Promise.all(queries)
    const [{ data: catsRaw }, { data: appsRaw }] = results as [
      { data: AppCategory[] | null },
      { data: App[] | null },
    ]

    const cats = (catsRaw ?? []) as AppCategory[]
    let apps = (appsRaw ?? []) as App[]

    // Filtrer les apps par abonnement pour les non-admins
    if (!isAdmin && results.length === 3) {
      const subData = (results[2] as { data: { app_id: string }[] | null }).data ?? []
      const subscribedAppIds = new Set(subData.map(s => s.app_id))
      apps = apps.filter(a => a.pricing_type === 'free' || subscribedAppIds.has(a.id))
    }

    // Exclure les catégories vides après filtrage
    const result: AppCategory[] = cats
      .map(cat => ({ ...cat, apps: apps.filter(a => a.category_id === cat.id) }))
      .filter(cat => cat.apps.length > 0)

    // Mettre en cache
    _cachedCategories = result
    _lastFetchMs = Date.now()
    setCategories(result)
    setLoading(false)
  }, [isAdmin])

  useEffect(() => {
    loadApps()

    // Écoute du même onglet (event custom)
    window.addEventListener(CHANNEL_NAME, loadApps)

    // Écoute des autres onglets (BroadcastChannel)
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bc.onmessage = () => loadApps()
    } catch { /* navigateur sans support */ }

    return () => {
      window.removeEventListener(CHANNEL_NAME, loadApps)
      bc?.close()
    }
  }, [loadApps])

  return { categories, loading, reload: loadApps }
}

export function useAllApps() {
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: catsRaw }, { data: appsRaw }] = await Promise.all([
      supabase.from('app_categories').select('*').order('order_index'),
      supabase.from('apps').select('*').order('order_index'),
    ])
    setCategories((catsRaw ?? []) as AppCategory[])
    setApps((appsRaw ?? []) as App[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { categories, apps, loading, reload: load }
}
