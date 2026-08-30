'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Sapin2DiagnosticApp from '@/components/apps/Sapin2DiagnosticApp'

export default function Sapin2Page() {
  return (
    <RseAppShell appSlug="sapin2" title="Loi Sapin II — Conformité Anti-Corruption">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="sapin2" appName="Loi Sapin II — Conformité Anti-Corruption">
          <Sapin2DiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
