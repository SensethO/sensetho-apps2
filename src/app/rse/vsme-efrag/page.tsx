'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import VsmeEfragApp from '@/components/apps/VsmeEfragApp'

export default function VsmeEfragPage() {
  return (
    <RseAppShell appSlug="vsme-efrag" title="VSME EFRAG — Standard PME">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="vsme-efrag" appName="VSME EFRAG — Standard PME">
          <VsmeEfragApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
