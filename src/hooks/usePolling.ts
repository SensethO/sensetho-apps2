'use client'

import { useEffect, useRef } from 'react'

/**
 * Rafraîchissement périodique **économe**. À utiliser partout plutôt qu'un `setInterval`
 * brut : un incident du 30/07/2026 (quotas Supabase et Vercel dépassés) a été causé par
 * des boucles à 2-4 s qui tournaient même onglet en arrière-plan.
 *
 * Trois protections :
 *  1. **Onglet caché → aucune requête** (et rafraîchissement immédiat au retour).
 *  2. **Intervalle plancher** : impossible de descendre sous MIN_INTERVAL_MS.
 *  3. **Ralentissement adaptatif** : si `fn` signale « rien de neuf » (retourne false),
 *     le délai double jusqu'à `maxMs` ; il repart au minimum dès qu'un changement survient
 *     ou que l'utilisateur revient sur l'onglet.
 *
 * `fn` peut retourner `false` pour « inchangé » (déclenche le ralentissement) ;
 * tout autre retour (dont `undefined`) est considéré comme « actif ».
 */

export const MIN_INTERVAL_MS = 8_000

export interface PollingOptions {
  /** Délai de base entre deux appels (borné à MIN_INTERVAL_MS minimum). */
  intervalMs?: number
  /** Délai maximal atteint par le ralentissement adaptatif. */
  maxMs?: number
  /** Désactive complètement le rafraîchissement (ex. Realtime opérationnel). */
  enabled?: boolean
  /** Rafraîchir immédiatement quand l'onglet redevient visible (défaut : true). */
  refreshOnFocus?: boolean
}

export function usePolling(fn: () => void | boolean | Promise<void | boolean>, opts: PollingOptions = {}) {
  const { intervalMs = 15_000, maxMs = 120_000, enabled = true, refreshOnFocus = true } = opts
  const base = Math.max(MIN_INTERVAL_MS, intervalMs)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let delay = base
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (stopped) return
      timer = setTimeout(run, delay)
    }

    const run = async () => {
      if (stopped) return
      // Onglet en arrière-plan : on ne consomme rien, on re-planifie simplement.
      if (typeof document !== 'undefined' && document.hidden) { schedule(); return }
      try {
        const changed = await fnRef.current()
        // « false » = rien de neuf → on espace progressivement (jusqu'à maxMs).
        delay = changed === false ? Math.min(maxMs, delay * 2) : base
      } catch {
        delay = Math.min(maxMs, delay * 2) // en cas d'erreur (service indisponible), on lève le pied
      }
      schedule()
    }

    const onVisible = () => {
      if (stopped || document.hidden || !refreshOnFocus) return
      delay = base
      if (timer) clearTimeout(timer)
      run()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [base, maxMs, enabled, refreshOnFocus])
}
