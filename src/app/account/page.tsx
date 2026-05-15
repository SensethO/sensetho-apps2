import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import AccountSettings from '@/components/account/AccountSettings'
import type { Profile } from '@/types'

interface Props {
  searchParams: { forced?: string }
}

export default async function AccountPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const forced = searchParams.forced === 'true'

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Mon compte</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gérez vos informations personnelles et préférences.</p>
        </div>
        <AccountSettings profile={profile as Profile} forced={forced} />
      </div>
    </AppShell>
  )
}
