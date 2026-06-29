'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import dynamic from 'next/dynamic'

const LeMiroirApp = dynamic(() => import('@/components/apps/LeMiroirApp'), { ssr: false })

export default function LeMiroirPage() {
  return (
    <RseAppShell appSlug="le-miroir" title="Le Miroir — éthologie d'entreprise">
      {(ctx: RseContext) => <LeMiroirApp ctx={ctx} />}
    </RseAppShell>
  )
}
