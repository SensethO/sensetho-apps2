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
    // Sélectionner la plus récente si l'année en cours n'est pas dans la liste
    if (list.length > 0 && !list.includes(selectedYear)) {
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

  async function removeYear(year: number) {
    if (!organisationId) return
    const supabase = createClient()
    await supabase
      .from('rse_years')
      .delete()
      .eq('organisation_id', organisationId)
      .eq('app_slug', appSlug)
      .eq('year', year)
    setYears(prev => {
      const next = prev.filter(y => y !== year)
      if (selectedYear === year && next.length > 0) setSelectedYear(next[0])
      return next
    })
  }

  return { years, selectedYear, setSelectedYear, addYear, removeYear, loading, reload: load }
}
