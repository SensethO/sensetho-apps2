import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import SsoTenantsAdmin from '@/components/admin/SsoTenantsAdmin'

export default async function SsoAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer
        title="Connexion Microsoft 365"
        description="Annuaires autorisés à se connecter en SSO, et suivi du secret Microsoft."
      >
        <SsoTenantsAdmin />
      </PageContainer>
    </AppShell>
  )
}
