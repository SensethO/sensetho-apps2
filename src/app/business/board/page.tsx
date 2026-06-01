'use client'

import AppShell from '@/components/layout/AppShell'
import dynamic from 'next/dynamic'

const BoardsApp = dynamic(() => import('@/components/apps/BoardsApp'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-sm animate-pulse">Chargement des tableaux…</div>
    </div>
  ),
})

export default function BoardPage() {
  return (
    <AppShell>
      <BoardsApp />
    </AppShell>
  )
}
