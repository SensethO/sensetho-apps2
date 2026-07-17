'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import BudgetAssociationApp from '@/components/apps/BudgetAssociationApp'

export default function BudgetAssociationPage() {
  return (
    <RequireSubscription appSlug="budget-association" appName="Budget association">
      <RseAppShell appSlug="budget-association" title="Budget association" requireYear={false}>
        {(ctx) => <BudgetAssociationApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
