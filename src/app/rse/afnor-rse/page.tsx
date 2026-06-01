'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import AfnorRseDiagnosticApp from '@/components/apps/AfnorRseDiagnosticApp'

export default function AfnorRsePage() {
  return (
    <RequireSubscription appSlug="afnor-rse" appName="Label Engagé RSE">
      <RseAppShell appSlug="afnor-rse" title="Label Engagé RSE — AFNOR Certification">
        {(ctx: RseContext) => <AfnorRseDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
