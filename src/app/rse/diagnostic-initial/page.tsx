'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GuidedDiagnostic from '@/components/apps/GuidedDiagnostic'

export default function DiagnosticInitialPage() {
  return (
    <RseAppShell appSlug="diagnostic-initial" title="Diagnostic initial guidé">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="diagnostic-initial" appName="Diagnostic initial guidé RSE">
          <GuidedDiagnostic ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
