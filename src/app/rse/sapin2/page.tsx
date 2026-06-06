'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Sapin2DiagnosticApp from '@/components/apps/Sapin2DiagnosticApp'

export default function Sapin2Page() {
  return (
    <RequireSubscription appSlug="sapin2" appName="Loi Sapin II — Conformité Anti-Corruption">
      <RseAppShell appSlug="sapin2" title="Loi Sapin II — Conformité Anti-Corruption">
        {(ctx: RseContext) => <Sapin2DiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
