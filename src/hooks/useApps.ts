'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppCategory, App } from '@/types'

export function useApps(isAdmin: boolean) {
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadApps() }, [isAdmin])

  async function loadApps() {
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
  }

  return { categories, loading, reload: loadApps }
}

export function useAllApps() {
  const [categories, setCategories] = useState<AppCategory[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const [{ data: catsRaw }, { data: appsRaw }] = await Promise.all([
      supabase.from('app_categories').select('*').order('order_index'),
      supabase.from('apps').select('*').order('order_index'),
    ])
    setCategories((catsRaw ?? []) as AppCategory[])
    setApps((appsRaw ?? []) as App[])
    setLoading(false)
  }

  return { categories, apps, loading, reload: load }
}
