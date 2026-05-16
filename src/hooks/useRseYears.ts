'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseRseYearsOptions {
  organisationId: string | null
  appSlug: string
}

export function useRseYears({ organisationId, appSlug }: UseRseYearsOptions) {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!organisationId) { setYears([]); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('rse_years')
      .select('year')
      .eq('organisation_id', organisationId)
      .eq('app_slug', appSlug)
      .order('year', { ascending: false })
    const list = (data ?? []).map((r: { year: number }) => r.year)
    setYears(list)
    setLoading(false)
    if (list.length > 0 && !list.includes(selectedYear)) {
      setSelectedYear(list[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, appSlug])

  useEffect(() => { load() }, [load])

  /** Ajoute une année spécifique (usage interne ou première année) */
  async function addYear(year: number, orgId?: string) {
    const id = orgId ?? organisationId
    if (!id) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('rse_years')
      .upsert({ organisation_id: id, app_slug: appSlug, year, user_id: user.id },
               { onConflict: 'organisation_id,app_slug,year', ignoreDuplicates: true })
    if (!error) {
      setYears(prev => {
        const next = Array.from(new Set([...prev, year])).sort((a, b) => b - a)
        return next
      })
      setSelectedYear(year)
    }
  }

  /** Ajoute l'année suivante (max + 1). Si aucune année, ajoute l'année courante. */
  async function addNextYear() {
    const nextYear = years.length > 0
      ? Math.max(...years) + 1
      : new Date().getFullYear()
    await addYear(nextYear)
  }

  /**
   * Modifie l'année de départ (min).
   * Toutes les années existantes sont décalées du même delta.
   */
  async function changeStartYear(newStartYear: number) {
    if (!organisationId || years.length === 0) return
    const minYear = Math.min(...years)
    const delta = newStartYear - minYear
    if (delta === 0) return

    const newYears = years.map(y => y + delta)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Supprimer toutes les années existantes puis réinsérer avec le décalage
    await supabase.from('rse_years').delete()
      .eq('organisation_id', organisationId)
      .eq('app_slug', appSlug)

    for (const y of newYears) {
      await supabase.from('rse_years').upsert(
        { organisation_id: organisationId, app_slug: appSlug, year: y, user_id: user.id },
        { onConflict: 'organisation_id,app_slug,year', ignoreDuplicates: true }
      )
    }

    const sorted = newYears.sort((a, b) => b - a)
    setYears(sorted)
    setSelectedYear(sorted[sorted.length - 1]) // sélectionner la nouvelle année de départ
  }

  return { years, selectedYear, setSelectedYear, addYear, addNextYear, changeStartYear, loading, reload: load }
}
