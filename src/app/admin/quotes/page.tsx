import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Demandes de devis</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Traitez les demandes de devis et personnalisez vos offres.
          </p>
        </div>
        <QuotesManager />
      </div>
    </AppShell>
  )
}
