'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppCategory, App } from '@/types'

const CHANNEL_NAME = 'apps-updated'

// ── Cache module-level : survit aux remontages d'AppShell ────────────────────
// Quand l'utilisateur change de page, AppShell se remonte mais les catégories
// sont déjà disponibles instantanément sans nouveau fetch réseau.
// Le cache est invalidé si le statut admin change (évite d'afficher les
// données non-admin pendant la résolution asynchrone de l'auth).
let _cachedCategories: AppCategory[] = []
let _cachedIsAdmin: boolean | null = null  // ← track pour qui le cache est valide
let _lastFetchMs = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Retourne les catégories actuellement en cache (pour initialiser le Sidebar) */
export function getCachedAppCategories() { return _cachedCategories }

/** Notifie tous les onglets + le même onglet qu'il faut recharger le menu */
export function broadcastAppsUpdate() {
  _cachedCategories = []
  _cachedIsAdmin = null
  _lastFetchMs = 0
  window.dispatchEvent(new CustomEvent(CHANNEL_NAME))
  try { new BroadcastChannel(CHANNEL_NAME).postMessage('reload') } catch { /* navigateur sans support */ }
}

/**
 * @param isAdmin    Statut admin de l'utilisateur courant
 * @param authReady  true dès que useAuth a fini de charger le profil
 *                   → on n'écrase pas le cache avec isAdmin=false pendant le chargement
 */
export function useApps(isAdmin: boolean, authReady = true) {
  // Initialiser avec le cache — sidebar visible sans flash
  // Si le cache est pour un admin mais l'utilisateur actuel est non-admin, on
  // affiche quand même le cache et on rechargera une fois authReady=true.
  const [categories, setCategories] = useState<AppCategory[]>(_cachedCategories)
  const [loading, setLoading] = useState(_cachedCategories.length === 0)

  const loadApps = useCallback(async () => {
    // Attendre que l'auth soit résolue avant de charger
    // (évite d'écraser le cache admin avec des données non-admin)
    if (!authReady) return

    const now = Date.now()
    // Cache valide pour le même statut admin → réutiliser
    if (
      _cachedCategories.length > 0 &&
      _cachedIsAdmin === isAdmin &&
      now - _lastFetchMs < CACHE_TTL_MS
    ) {
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

    // Pour les non-admins : filtrer par abonnements actifs
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

    if (!isAdmin && results.length === 3) {
      const subData = (results[2] as { data: { app_id: string }[] | null }).data ?? []
      const subscribedAppIds = new Set(subData.map(s => s.app_id))
      apps = apps.filter(a => a.pricing_type === 'free' || subscribedAppIds.has(a.id))
    }

    const result: AppCategory[] = cats
      .map(cat => ({ ...cat, apps: apps.filter(a => a.category_id === cat.id) }))
      .filter(cat => cat.apps.length > 0)

    // Mettre en cache avec le statut admin correspondant
    _cachedCategories = result
    _cachedIsAdmin = isAdmin
    _lastFetchMs = Date.now()
    setCategories(result)
    setLoading(false)
  }, [isAdmin, authReady])

  useEffect(() => {
    loadApps()
    window.addEventListener(CHANNEL_NAME, loadApps)
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
