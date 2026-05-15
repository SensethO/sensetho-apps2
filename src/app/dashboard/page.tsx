import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mb-8">Bienvenue sur votre portail applicatif Sensetho.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portail</p>
            <p className="font-semibold text-gray-900">apps.sensetho.com</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Compte</p>
            <p className="font-semibold text-gray-900 truncate">{user.email}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Statut</p>
            <p className="font-semibold text-green-600">Actif</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
