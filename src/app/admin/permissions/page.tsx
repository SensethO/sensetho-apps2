import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import PermissionsManager from '@/components/admin/PermissionsManager'

export default async function AdminPermissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer title="Droits d'accès" description="Gérez les droits d'accès de chaque utilisateur pour toutes les applications." maxWidth="xl">
        <PermissionsManager />
      </PageContainer>
    </AppShell>
  )
}
