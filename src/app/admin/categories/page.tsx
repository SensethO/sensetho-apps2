import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import CategoriesManager from '@/components/admin/CategoriesManager'

export default async function AdminCategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Catégories d&apos;applications</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les catégories et l&apos;ordre d&apos;apparition des applications dans le menu.</p>
        </div>
        <CategoriesManager />
      </div>
    </AppShell>
  )
}
