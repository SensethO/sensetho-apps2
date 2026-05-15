'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GuidedDiagnostic from '@/components/apps/GuidedDiagnostic'

export default function DiagnosticInitialPage() {
  return (
    <RequireSubscription appSlug="diagnostic-initial" appName="Diagnostic initial guidé RSE">
      <RseAppShell appSlug="diagnostic-initial" title="🧭 Diagnostic initial guidé">
        {(ctx: RseContext) => <GuidedDiagnostic ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
