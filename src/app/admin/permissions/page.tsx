import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import PermissionsManager from '@/components/admin/PermissionsManager'

export default async function AdminPermissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Droits d&apos;accès</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les droits d&apos;accès de chaque utilisateur pour toutes les applications.</p>
        </div>
        <PermissionsManager />
      </div>
    </AppShell>
  )
}
