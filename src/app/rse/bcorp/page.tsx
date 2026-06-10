'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import BcorpDiagnosticApp from '@/components/apps/BcorpDiagnosticApp'

export default function BcorpPage() {
  return (
    <RequireSubscription appSlug="bcorp" appName="Diagnostic B Corp">
      <RseAppShell appSlug="bcorp" title="Diagnostic B Corp — B Impact Assessment (B Lab)">
        {(ctx: RseContext) => <BcorpDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
