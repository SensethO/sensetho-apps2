'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import VeilleSindupApp from '@/components/apps/VeilleSindupApp'

export default function VeilleSindupPage() {
  return (
    <RequireSubscription appSlug="veille-sindup" appName="Veille stratégique (Sindup)">
      <RseAppShell appSlug="veille-sindup" title="Veille stratégique (Sindup)" requireYear={false}>
        {(ctx) => <VeilleSindupApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
