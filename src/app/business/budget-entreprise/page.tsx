'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import BudgetEntrepriseApp from '@/components/apps/BudgetEntrepriseApp'

export default function BudgetEntreprisePage() {
  return (
    <RseAppShell appSlug="budget-entreprise" title="Budget entreprise" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="budget-entreprise" appName="Budget entreprise">
          <BudgetEntrepriseApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
