import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import AgriRolesManager from '@/components/admin/AgriRolesManager'

export const metadata = { title: 'Droits AgriTracker — Admin' }

export default async function AgriRolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer
        title="Droits AgriTracker"
        description="Assignez les rôles Planteur et/ou Acheteur aux utilisateurs de la plateforme."
      >
        <AgriRolesManager />
      </PageContainer>
    </AppShell>
  )
}
