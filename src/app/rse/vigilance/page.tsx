'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import VigilanceDiagnosticApp from '@/components/apps/VigilanceDiagnosticApp'

export default function VigilancePage() {
  return (
    <RseAppShell appSlug="vigilance" title="Devoir de Vigilance — Loi n°2017-399">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="vigilance" appName="Devoir de Vigilance">
          <VigilanceDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
