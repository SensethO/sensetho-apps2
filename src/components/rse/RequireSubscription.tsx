'use client'

import { useSubscription } from '@/hooks/useSubscription'
import Icon from '@/components/ui/Icon'

interface RequireSubscriptionProps {
  appSlug: string
  appName?: string
  children: React.ReactNode
  devisUrl?: string  // URL vers /devis?app=slug&name=Name
}

/**
 * Affiche son contenu uniquement si l'utilisateur a un abonnement actif
 * sur l'app indiquée (ou s'il est admin).
 * Sinon, affiche un écran "Accès requis".
 */
export default function RequireSubscription({ appSlug, appName, children, devisUrl }: RequireSubscriptionProps) {
  const { loading, hasAccess } = useSubscription(appSlug)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-card)' }}>
          <Icon name="lock" size={32} style={{ color: 'var(--text-muted)' }} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Accès requis
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {appName
              ? `L'application "${appName}" nécessite un abonnement actif.`
              : 'Cette application nécessite un abonnement actif.'}
            {' '}Contactez l&apos;administrateur pour obtenir un accès.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          {devisUrl ? (
            <a href={devisUrl}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-center text-white transition-colors"
              style={{ backgroundColor: '#0e3d4d' }}>
              Demander l&apos;accès →
            </a>
          ) : null}
          <a href="/account"
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center transition-colors"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            Voir mes abonnements
          </a>
          <a href="/dashboard"
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center text-white"
            style={{ backgroundColor: '#6366f1' }}>
            Retour au tableau de bord
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
