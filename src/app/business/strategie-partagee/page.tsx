'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import StrategiePartageeApp from '@/components/apps/StrategiePartageeApp'

export default function StrategiePartageePage() {
  return (
    <RequireSubscription appSlug="strategie-partagee" appName="Stratégie Partagée (Hoshin Kanri)">
      <RseAppShell appSlug="strategie-partagee" title="Stratégie Partagée (Hoshin Kanri)" requireYear={false}>
        {(ctx) => <StrategiePartageeApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
