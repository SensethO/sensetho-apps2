import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PageContainer from '@/components/layout/PageContainer'
import QuotesManager from '@/components/admin/QuotesManager'

export default async function AdminQuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await createAdminClient()
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageContainer title="Demandes de devis" description="Traitez les demandes de devis et personnalisez vos offres.">
        <QuotesManager />
      </PageContainer>
    </AppShell>
  )
}
