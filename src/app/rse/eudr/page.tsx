'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import EudrDiagnosticApp from '@/components/apps/EudrDiagnosticApp'

export default function EudrPage() {
  return (
    <RequireSubscription appSlug="eudr" appName="EUDR — Sans Déforestation">
      <RseAppShell appSlug="eudr" title="EUDR — Règlement (UE) 2023/1115 Sans Déforestation">
        {(ctx: RseContext) => <EudrDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
