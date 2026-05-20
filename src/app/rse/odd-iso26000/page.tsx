'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import ODDExplorerApp from '@/components/apps/ODDExplorerApp'

export default function OddIso26000Page() {
  return (
    <RseAppShell appSlug="odd-iso26000" title="ISO 26000 & ODD">
      {(ctx: RseContext) => <ODDExplorerApp ctx={ctx} />}
    </RseAppShell>
  )
}
