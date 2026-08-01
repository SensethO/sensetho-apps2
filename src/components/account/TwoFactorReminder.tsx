'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

// Invitation à activer la double authentification, tant qu'elle ne l'est pas.
//
// Elle reste facultative : on incite, on n'impose pas. Le rejet vaut pour la
// session en cours seulement — sessionStorage, pas localStorage — de sorte que
// l'invitation revienne à chaque connexion, comme convenu.

const CLE_REJET = 'sensetho.2fa.rappel.masque'

export default function TwoFactorReminder() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        if (sessionStorage.getItem(CLE_REJET)) return
      } catch { /* mode privé : on affiche */ }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // La seule condition qui compte : aucun facteur vérifié. Si la liste est
      // illisible, on n'affiche rien — mieux vaut se taire que crier à tort.
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) return
      if ((data?.totp ?? []).some(f => f.status === 'verified')) return

      // Un compte sans mot de passe, connecté uniquement par Microsoft, n'a rien
      // à protéger ici. Mais si les identités ne sont pas lisibles, on affiche :
      // une relance superflue se referme d'un clic, une relance escamotée laisse
      // un compte non protégé sans que personne ne s'en aperçoive.
      const identites = session.user?.identities
      const seulementMicrosoft = Array.isArray(identites) && identites.length > 0
        && !identites.some(i => i.provider === 'email')
      if (seulementMicrosoft) return

      if (vivant) setVisible(true)
    })()
    return () => { vivant = false }
  }, [])

  if (!visible) return null

  function masquer() {
    try { sessionStorage.setItem(CLE_REJET, '1') } catch { /* sans effet */ }
    setVisible(false)
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon name="shieldCheck" size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-gray-900 dark:text-slate-100">
            Renforcez la sécurité de votre compte
          </p>
          <p className="text-gray-600 dark:text-slate-300 mt-0.5">
            La double authentification n’est pas activée. Un mot de passe volé suffirait à entrer
            dans votre compte. Son activation prend une minute.
          </p>
          <div className="mt-2 flex items-center gap-4">
            <Link href="/account"
              className="text-xs font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2">
              Activer maintenant
            </Link>
            <button onClick={masquer}
              className="text-xs text-gray-500 dark:text-slate-400 hover:underline">
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
