'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import VeilleSindupApp from '@/components/apps/VeilleSindupApp'

export default function VeilleSindupPage() {
  return (
    <RseAppShell appSlug="veille-sindup" title="Veille stratégique (Sindup)" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="veille-sindup" appName="Veille stratégique (Sindup)">
          <VeilleSindupApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
