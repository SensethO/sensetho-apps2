'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import dynamic from 'next/dynamic'

const Iso53001DiagnosticApp = dynamic(() => import('@/components/apps/Iso53001DiagnosticApp'), { ssr: false })

export default function Iso53001Page() {
  return (
    <RseAppShell appSlug="iso53001" title="Diagnostic ISO 53001 — Management des ODD">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="iso53001" appName="Diagnostic ISO 53001 — ODD">
          <Iso53001DiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
