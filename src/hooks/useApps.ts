'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppCategory, App } from '@/types'

const CHANNEL_NAME = 'apps-updated'

/** Notifie tous les onglets + le même onglet qu'il faut recharger le menu */
export function broadcastAppsUpdate() {
  // Même onglet
  window.dispatchEvent(new CustomEvent(CHANNEL_NAME))
  // Autres onglets
  try { new BroadcastChannel(CHANNEL_NAME).postMessage('reload') } catch { /* navigateur sans support */ }
}

export function useApps(isAdmin: boolean) {
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [loading, setLoading] = useState(true)

  const loadApps = useCallback(async () => {
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

    const [{ data: catsRaw }, { data: appsRaw }] = await Promise.all([catQuery, appQuery])

    const cats = (catsRaw ?? []) as AppCategory[]
    const apps = (appsRaw ?? []) as App[]

    const result: AppCategory[] = cats.map(cat => ({
      ...cat,
      apps: apps.filter(a => a.category_id === cat.id),
    }))

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
