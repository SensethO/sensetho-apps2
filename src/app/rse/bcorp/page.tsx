'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import BcorpDiagnosticApp from '@/components/apps/BcorpDiagnosticApp'

export default function BcorpPage() {
  return (
    <RseAppShell appSlug="bcorp" title="Diagnostic B Corp — B Impact Assessment (B Lab)">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="bcorp" appName="Diagnostic B Corp">
          <BcorpDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
