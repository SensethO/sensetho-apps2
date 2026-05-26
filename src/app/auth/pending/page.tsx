'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'

export default function PendingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'pending' | 'suspended' | 'loading'>('loading')

  useEffect(() => {
    async function checkStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('status').eq('id', user.id).single()
      if (data?.status === 'active') { router.push('/dashboard'); return }
      setStatus(data?.status === 'suspended' ? 'suspended' : 'pending')
    }
    checkStatus()
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  const isSuspended = status === 'suspended'

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm mx-4 text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900 dark:text-slate-100">Sensetho Apps</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Portail applicatif</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            isSuspended
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            <Icon
              name={isSuspended ? 'lock' : 'clock'}
              size={28}
              className={isSuspended ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}
            />
          </div>

          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {isSuspended ? 'Compte suspendu' : 'Compte en attente de validation'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            {isSuspended
              ? 'Votre accès à la plateforme a été suspendu. Contactez un administrateur pour plus d\'informations.'
              : 'Votre inscription a bien été reçue. Un administrateur doit valider votre accès avant que vous puissiez utiliser la plateforme.'}
          </p>

          {!isSuspended && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">⏳ Délai habituel</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Les demandes sont généralement traitées sous 24–48h ouvrées.
              </p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="logout" size={15} />
            Se déconnecter
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-300 dark:text-slate-600 mt-6">
          Contact :{' '}
          <a href="mailto:sylvain.cassaro@sensetho.com" className="hover:underline">
            sylvain.cassaro@sensetho.com
          </a>
        </p>
      </div>
    </div>
  )
}
