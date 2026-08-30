'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import ODDExplorerApp from '@/components/apps/ODDExplorerApp'

export default function OddIso26000Page() {
  return (
    <RseAppShell appSlug="odd-iso26000" title="ISO 26000 & ODD">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="odd-iso26000">
          <ODDExplorerApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
