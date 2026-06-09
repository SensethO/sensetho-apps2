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
    <RequireSubscription appSlug="act-carbone" appName="Démarche ACT Bas-Carbone">
      <RseAppShell appSlug="act-carbone" title="Démarche ACT Bas-Carbone">
        {(ctx: RseContext) => <ActCarboneDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
