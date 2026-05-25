'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import VsmeEfragApp from '@/components/apps/VsmeEfragApp'

export default function VsmeEfragPage() {
  return (
    <RequireSubscription appSlug="vsme-efrag" appName="VSME EFRAG — Standard PME">
      <RseAppShell appSlug="vsme-efrag" title="VSME EFRAG — Standard PME">
        {(ctx: RseContext) => <VsmeEfragApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
