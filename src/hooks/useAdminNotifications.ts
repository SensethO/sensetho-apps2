'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminNotifications {
  ticketCount: number
  quoteCount: number
  total: number
}

export function useAdminNotifications(isAdmin: boolean): AdminNotifications {
  const [counts, setCounts] = useState<AdminNotifications>({ ticketCount: 0, quoteCount: 0, total: 0 })

  useEffect(() => {
    if (!isAdmin) return

    async function fetchCounts() {
      const supabase = createClient()
      const [{ count: tickets }, { count: quotes }] = await Promise.all([
        supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('app_quotes').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
      ])
      const t = tickets ?? 0
      const q = quotes ?? 0
      setCounts({ ticketCount: t, quoteCount: q, total: t + q })
    }

    fetchCounts()
    const interval = setInterval(fetchCounts, 30_000)
    return () => clearInterval(interval)
  }, [isAdmin])

  return counts
}
