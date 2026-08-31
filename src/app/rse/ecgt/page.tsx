'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import dynamic from 'next/dynamic'

const EcgtApp = dynamic(() => import('@/components/apps/EcgtApp'), { ssr: false })

export default function EcgtPage() {
  return (
    <RseAppShell appSlug="ecgt" title="Conformité ECGT — Directive (UE) 2024/825">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="ecgt" appName="Conformité ECGT">
          <EcgtApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
