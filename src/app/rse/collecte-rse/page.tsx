'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import dynamic from 'next/dynamic'

const CollecteRseDiagnosticApp = dynamic(() => import('@/components/apps/CollecteRseDiagnosticApp'), { ssr: false })

export default function CollecteRsePage() {
  return (
    <RequireSubscription appSlug="collecte-rse" appName="Collecte documentaire RSE">
      <RseAppShell appSlug="collecte-rse" title="Collecte documentaire RSE — Préparation au diagnostic initial de maturité RSE (ISO 26000)">
        {(ctx: RseContext) => <CollecteRseDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
