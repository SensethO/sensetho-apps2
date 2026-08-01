'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

// Double authentification par application (TOTP) : Microsoft Authenticator,
// Google Authenticator, 1Password, Bitwarden — c'est le même standard.
// Le service est déjà actif côté Supabase ; tout se joue ici, dans le parcours.

interface Facteur { id: string; friendly_name?: string | null; status: string; created_at?: string }

export default function TwoFactorPanel() {
  const [facteurs, setFacteurs] = useState<Facteur[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  // Enrôlement en cours
  const [enrolement, setEnrolement] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [secretVisible, setSecretVisible] = useState(false)

  const recharger = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) { setErreur('Impossible de lire vos méthodes de vérification.'); setChargement(false); return }
    // Seuls les facteurs vérifiés protègent réellement le compte : un enrôlement
    // abandonné en cours de route reste `unverified` et ne doit pas être compté.
    setFacteurs((data?.totp ?? []).filter(f => f.status === 'verified'))
    setChargement(false)
  }, [])

  useEffect(() => { void recharger() }, [recharger])

  async function commencer() {
    setOccupe(true); setErreur(''); setCode('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Application ${new Date().toLocaleDateString('fr-FR')}`,
    })
    setOccupe(false)
    if (error || !data) {
      // Un enrôlement précédent resté en suspens bloque le nouveau : on le dit.
      setErreur(/already exists|friendly/i.test(error?.message ?? '')
        ? 'Un enrôlement est déjà en cours. Rechargez la page et réessayez.'
        : 'Impossible de démarrer l’enrôlement. Réessayez dans un instant.')
      return
    }
    setEnrolement({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirmer() {
    if (!enrolement || code.trim().length < 6) return
    setOccupe(true); setErreur('')
    const supabase = createClient()
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enrolement.id })
    if (e1 || !ch) { setOccupe(false); setErreur('Impossible de vérifier le code. Réessayez.'); return }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId: enrolement.id, challengeId: ch.id, code: code.trim(),
    })
    setOccupe(false)
    if (e2) { setErreur('Code refusé. Vérifiez l’heure de votre téléphone, puis saisissez le code affiché.'); return }
    setEnrolement(null); setCode('')
    await recharger()
  }

  async function annulerEnrolement() {
    if (!enrolement) return
    const supabase = createClient()
    await supabase.auth.mfa.unenroll({ factorId: enrolement.id })
    setEnrolement(null); setCode(''); setErreur('')
    await recharger()
  }

  async function retirer(id: string) {
    setOccupe(true); setErreur('')
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    setOccupe(false)
    if (error) { setErreur('Impossible de retirer cette méthode.'); return }
    await recharger()
  }

  const champ = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900'

  if (chargement) return <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">Chargement…</p>

  return (
    <div className="space-y-5">
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {/* ── Enrôlement en cours ── */}
      {enrolement && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Scannez ce code</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Ouvrez Microsoft Authenticator, Google Authenticator ou votre gestionnaire de mots de passe,
              puis ajoutez un compte en scannant l’image.
            </p>
          </div>

          <div className="flex justify-center">
            {/* Le code QR est fourni par Supabase sous forme d'image encodée : rien
                ne transite par un service tiers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolement.qr} alt="Code QR de configuration" className="w-44 h-44 bg-white rounded-lg p-2" />
          </div>

          <div className="text-center">
            <button type="button" onClick={() => setSecretVisible(v => !v)}
              className="text-xs text-gray-500 dark:text-slate-400 hover:underline">
              {secretVisible ? 'Masquer la clé' : 'Impossible de scanner ? Afficher la clé'}
            </button>
            {secretVisible && (
              <p className="mt-2 font-mono text-xs break-all text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                {enrolement.secret}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Code à 6 chiffres affiché par l’application
            </label>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
              className={`${champ} tracking-widest font-mono`} />
          </div>

          <div className="flex gap-2">
            <button onClick={confirmer} disabled={occupe || code.length < 6}
              className="flex-1 bg-gray-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {occupe ? 'Vérification…' : 'Activer'}
            </button>
            <button onClick={annulerEnrolement} disabled={occupe}
              className="px-4 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Méthodes actives ── */}
      {!enrolement && facteurs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Icon name="shieldCheck" size={18} className="text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-slate-100">Double authentification active</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Un code vous sera demandé à chaque connexion par mot de passe.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-lg">
            {facteurs.map(f => (
              <li key={f.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-gray-700 dark:text-slate-300">{f.friendly_name || 'Application d’authentification'}</span>
                <button onClick={() => retirer(f.id)} disabled={occupe}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                  Retirer
                </button>
              </li>
            ))}
          </ul>
          <button onClick={commencer} disabled={occupe}
            className="text-xs text-gray-500 dark:text-slate-400 hover:underline">
            Ajouter un autre appareil
          </button>
        </div>
      )}

      {/* ── Aucune méthode ── */}
      {!enrolement && facteurs.length === 0 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Icon name="shieldCheck" size={18} className="text-gray-400 dark:text-slate-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-slate-100">Double authentification inactive</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Elle ajoute un code à usage unique à votre connexion. Un mot de passe volé ne suffit
                alors plus à entrer dans votre compte.
              </p>
            </div>
          </div>
          <button onClick={commencer} disabled={occupe}
            className="w-full bg-gray-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {occupe ? 'Préparation…' : 'Activer la double authentification'}
          </button>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Si vous vous connectez avec Microsoft, votre organisation gère déjà cette vérification :
            l’ajouter ici ne concerne que la connexion par mot de passe.
          </p>
        </div>
      )}
    </div>
  )
}
