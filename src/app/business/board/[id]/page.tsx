'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

const BoardEditor = dynamic(() => import('@/components/apps/BoardEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Ouverture du tableau…</p>
      </div>
    </div>
  ),
})

export default function BoardEditorPage() {
  const params = useParams()
  return <BoardEditor boardId={params.id as string} />
}
