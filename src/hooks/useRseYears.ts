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

  const currentYear = new Date().getFullYear()

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
    // Si aucune année : créer l'année courante automatiquement
    if (list.length === 0) {
      await addYear(currentYear, organisationId)
    } else if (!list.includes(selectedYear)) {
      // Sélectionner la plus récente si l'année courante n'existe pas
      setSelectedYear(list[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, appSlug])

  useEffect(() => { load() }, [load])

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

  return { years, selectedYear, setSelectedYear, addYear, loading, reload: load }
}
