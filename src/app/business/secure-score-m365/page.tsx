'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import SecureScoreApp from '@/components/apps/SecureScoreM365'

export default function SecureScoreM365Page() {
  return (
    <RseAppShell appSlug="secure-score-m365" title="Secure Score M365" requireYear={false}>
      {() => (
        <RequireSubscription appSlug="secure-score-m365" appName="Secure Score M365">
          <SecureScoreApp />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
