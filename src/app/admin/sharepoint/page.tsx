import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import SharepointAdmin from '@/components/admin/SharepointAdmin'

export default async function SharepointAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer
        title="Administration SharePoint"
        description="Gérez les tenants SharePoint, les affectations par application et les migrations de données."
      >
        <SharepointAdmin />
      </PageContainer>
    </AppShell>
  )
}
