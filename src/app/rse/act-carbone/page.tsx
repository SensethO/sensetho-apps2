'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import dynamic from 'next/dynamic'

const ActCarboneDiagnosticApp = dynamic(
  () => import('@/components/apps/ActCarboneDiagnosticApp'),
  { ssr: false }
)

export default function ActCarbonePage() {
  return (
    <RseAppShell appSlug="act-carbone" title="Démarche ACT Bas-Carbone">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="act-carbone" appName="Démarche ACT Bas-Carbone">
          <ActCarboneDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
