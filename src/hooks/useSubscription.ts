'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface SubscriptionState {
  loading: boolean
  hasAccess: boolean // abonné actif OU admin
  subscription: {
    id: string
    plan: string
    status: string
    expires_at: string | null
  } | null
}

/**
 * Vérifie si l'utilisateur courant a accès à une app via un abonnement actif.
 * Les admins ont toujours accès.
 */
export function useSubscription(appSlug: string): SubscriptionState {
  const { profile, isAdmin, loading: authLoading } = useAuth()
  const [state, setState] = useState<SubscriptionState>({ loading: true, hasAccess: false, subscription: null })

  useEffect(() => {
    if (authLoading) return
    if (isAdmin) { setState({ loading: false, hasAccess: true, subscription: null }); return }
    if (!profile) { setState({ loading: false, hasAccess: false, subscription: null }); return }

    check()

    async function check() {
      const supabase = createClient()
      const { data } = await supabase
        .from('app_subscriptions')
        .select('id, plan, status, expires_at, app_id, apps!inner(slug)')
        .eq('apps.slug', appSlug)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .maybeSingle()

      setState({
        loading: false,
        hasAccess: !!data,
        subscription: data ? { id: data.id, plan: data.plan, status: data.status, expires_at: data.expires_at } : null,
      })
    }
  }, [appSlug, profile, isAdmin, authLoading])

  return state
}
