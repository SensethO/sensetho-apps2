'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import AfnorRseDiagnosticApp from '@/components/apps/AfnorRseDiagnosticApp'

export default function AfnorRsePage() {
  return (
    <RseAppShell appSlug="afnor-rse" title="Label Engagé RSE — AFNOR Certification">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="afnor-rse" appName="Label Engagé RSE">
          <AfnorRseDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
