import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import FavoritesBoard from '@/components/dashboard/FavoritesBoard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <AppShell>
      <PageContainer
        title="Tableau de bord"
        description="Vos applications favorites — survolez une app dans le menu et cliquez ⭐ pour l'épingler ici."
      >
        <FavoritesBoard />
      </PageContainer>
    </AppShell>
  )
}
