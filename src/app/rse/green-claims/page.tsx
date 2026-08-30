'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GreenClaimsApp from '@/components/apps/GreenClaimsApp'

export default function GreenClaimsPage() {
  return (
    <RseAppShell appSlug="green-claims" title="Diagnostic Green Claims">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="green-claims" appName="Diagnostic Green Claims">
          <GreenClaimsApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
