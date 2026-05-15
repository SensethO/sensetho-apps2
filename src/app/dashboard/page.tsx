import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <AppShell>
      <PageContainer title="Tableau de bord" description="Bienvenue sur votre portail applicatif Sensetho." />
    </AppShell>
  )
}
