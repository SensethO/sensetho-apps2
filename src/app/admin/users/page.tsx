import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import UsersManager from '@/components/admin/UsersManager'

export const metadata = { title: 'Utilisateurs — Admin' }

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer
        title="Gestion des utilisateurs"
        description="Validez les nouvelles inscriptions et gérez les accès à la plateforme."
      >
        <UsersManager />
      </PageContainer>
    </AppShell>
  )
}
