'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import BudgetEntrepriseApp from '@/components/apps/BudgetEntrepriseApp'

export default function BudgetEntreprisePage() {
  return (
    <RequireSubscription appSlug="budget-entreprise" appName="Budget entreprise">
      <RseAppShell appSlug="budget-entreprise" title="Budget entreprise" requireYear={false}>
        {(ctx) => <BudgetEntrepriseApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
