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
 * Les apps en pricing_type = 'free' sont accessibles à tous les utilisateurs connectés.
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

      // Étape 1 : récupérer l'app pour vérifier son pricing_type et son id
      const { data: app } = await supabase
        .from('apps')
        .select('id, pricing_type')
        .eq('slug', appSlug)
        .eq('is_active', true)
        .maybeSingle()

      // App inconnue ou inactive → pas d'accès
      if (!app) {
        setState({ loading: false, hasAccess: false, subscription: null })
        return
      }

      // App gratuite → accès immédiat pour tout utilisateur connecté
      if (app.pricing_type === 'free') {
        setState({ loading: false, hasAccess: true, subscription: null })
        return
      }

      // Étape 2 : vérifier l'abonnement de l'utilisateur pour cette app précise
      // On filtre explicitement par user_id ET app_id pour éviter tout contournement
      const { data } = await supabase
        .from('app_subscriptions')
        .select('id, plan, status, expires_at')
        .eq('user_id', profile.id)          // filtre explicite par utilisateur
        .eq('app_id', app.id)               // filtre explicite par app (pas par slug via jointure)
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
