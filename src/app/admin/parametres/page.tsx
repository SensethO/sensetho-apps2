import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import SiteSettings from '@/components/admin/SiteSettings'

export const metadata = { title: 'Paramètres du site — Admin' }

export default async function AdminParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer
        title="Paramètres du site"
        description="Modifiez les textes et informations affichés sur les pages publiques."
      >
        <SiteSettings />
      </PageContainer>
    </AppShell>
  )
}
