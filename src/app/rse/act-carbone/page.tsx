'use client'
import AppShell from '@/components/layout/AppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import dynamic from 'next/dynamic'
const ActCarboneDiagnosticApp = dynamic(() => import('@/components/apps/ActCarboneDiagnosticApp'), { ssr: false })
export default function Page() {
  return (
    <AppShell>
      <RequireSubscription appSlug="act-carbone" appName="Démarche ACT Bas-Carbone">
        {(ctx) => <ActCarboneDiagnosticApp ctx={ctx} />}
      </RequireSubscription>
    </AppShell>
  )
}
