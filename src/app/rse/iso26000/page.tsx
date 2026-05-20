'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import ISO26000DiagApp from '@/components/apps/ISO26000DiagApp'

export default function ISO26000Page() {
  return (
    <RequireSubscription appSlug="iso26000" appName="Diagnostic RSE ISO 26000">
      <RseAppShell appSlug="iso26000" title="Diagnostic RSE ISO 26000">
        {(ctx: RseContext) => <ISO26000DiagApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
