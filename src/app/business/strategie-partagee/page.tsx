'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import StrategiePartageeApp from '@/components/apps/StrategiePartageeApp'

export default function StrategiePartageePage() {
  return (
    <RseAppShell appSlug="strategie-partagee" title="Stratégie Partagée (Hoshin Kanri)" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="strategie-partagee" appName="Stratégie Partagée (Hoshin Kanri)">
          <StrategiePartageeApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
