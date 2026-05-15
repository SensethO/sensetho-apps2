'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTicketCount(isAdmin: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return

    async function fetchCount() {
      const supabase = createClient()
      const { count: c } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress'])
      setCount(c ?? 0)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [isAdmin])

  return count
}
