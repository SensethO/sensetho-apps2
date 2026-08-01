'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

// Rattachement d'un compte existant à son identité Microsoft.
//
// Supabase sait rapprocher automatiquement une identité OAuth d'un compte de
// même adresse, mais cela reste implicite et dépend de la présence d'un email
// vérifié dans les claims Microsoft. Une action explicite est plus sûre et,
// surtout, elle se voit : l'utilisateur sait ce qu'il fait et peut revenir en
// arrière.

interface Identite { id: string; identity_id?: string; provider: string; identity_data?: Record<string, unknown> | null }

const NOMS: Record<string, string> = { email: 'Adresse et mot de passe', azure: 'Microsoft 365' }

export default function IdentitiesPanel() {
  const [identites, setIdentites] = useState<Identite[]>([])
  const [chargement, setChargement] = useState(true)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const recharger = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error) { setErreur('Impossible de lire vos méthodes de connexion.'); setChargement(false); return }
    setIdentites((data?.identities ?? []) as Identite[])
    setChargement(false)
  }, [])

  useEffect(() => { void recharger() }, [recharger])

  const azure = identites.find(i => i.provider === 'azure')

  async function lier() {
    setOccupe(true); setErreur('')
    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider: 'azure',
      options: {
        scopes: 'openid profile email offline_access',
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    })
    // En cas de succès le navigateur part chez Microsoft : on ne repasse pas ici.
    if (error) {
      setErreur(/identity is already linked|already exists/i.test(error.message)
        ? 'Ce compte Microsoft est déjà rattaché à un autre utilisateur de la plateforme.'
        : 'Impossible de joindre Microsoft. Réessayez dans un instant.')
      setOccupe(false)
    }
  }

  async function delier() {
    if (!azure) return
    // Retirer la dernière méthode de connexion rendrait le compte inaccessible.
    if (identites.length < 2) { setErreur('Impossible de retirer votre seule méthode de connexion.'); return }
    setOccupe(true); setErreur('')
    const supabase = createClient()
    const { error } = await supabase.auth.unlinkIdentity(azure as never)
    setOccupe(false)
    if (error) { setErreur('Impossible de retirer ce rattachement.'); return }
    await recharger()
  }

  if (chargement) return <p className="text-sm text-gray-500 dark:text-slate-400 py-6 text-center">Chargement…</p>

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900 dark:text-slate-100">Méthodes de connexion</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Rattachez votre compte Microsoft pour vous connecter en un clic, sans mot de passe.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      <ul className="divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-lg">
        {identites.map(i => (
          <li key={i.identity_id ?? i.id} className="flex items-center justify-between px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
              <Icon name="check" size={14} className="text-green-600 dark:text-green-400" />
              {NOMS[i.provider] ?? i.provider}
            </span>
            {i.provider === 'azure' && (
              <button onClick={delier} disabled={occupe}
                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>

      {!azure && (
        <>
          <button onClick={lier} disabled={occupe}
            className="w-full flex items-center justify-center gap-2.5 border border-gray-300 dark:border-slate-600 rounded-lg py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill="#f25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
              <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
              <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
            </svg>
            {occupe ? 'Redirection vers Microsoft…' : 'Rattacher mon compte Microsoft'}
          </button>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Votre mot de passe continuera de fonctionner. Rien n’est supprimé, une seconde voie
            d’accès est simplement ajoutée.
          </p>
        </>
      )}
    </div>
  )
}
