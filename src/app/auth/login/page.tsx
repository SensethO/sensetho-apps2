'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type View = 'login' | 'forgot' | 'mfa'

/** Motifs de refus renvoyés par /auth/callback, traduits pour l'utilisateur. */
const MESSAGES_SSO: Record<string, string> = {
  callback: 'La connexion Microsoft n’a pas abouti. Réessayez.',
  sso_indisponible: 'Service momentanément indisponible — votre organisation n’a pas pu être vérifiée. Réessayez dans un instant.',
  sso_tenant_inconnu: 'Impossible d’identifier votre organisation Microsoft. Contactez votre administrateur.',
  sso_tenant_refuse: 'Votre organisation Microsoft n’est pas autorisée à accéder à cette plateforme. Contactez votre administrateur pour qu’il la déclare.',
}

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // Forgot
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSending, setForgotSending] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  // Microsoft 365
  const [msLoading, setMsLoading] = useState(false)

  // Double authentification
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaChecking, setMfaChecking] = useState(false)

  // Un refus survenu côté serveur revient par l'URL : on l'affiche au même
  // endroit que les erreurs de saisie, pour que l'utilisateur ait une seule
  // zone à lire. Lecture directe de l'URL plutôt que useSearchParams, qui
  // imposerait d'envelopper la page dans une frontière Suspense.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code) setLoginError(MESSAGES_SSO[code] ?? 'La connexion n’a pas abouti.')
  }, [])

  async function handleMicrosoft() {
    setMsLoading(true); setLoginError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // offline_access est nécessaire pour que Microsoft délivre un jeton de
        // rafraîchissement ; email et profile alimentent le profil créé.
        scopes: 'openid profile email offline_access',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // En cas de succès, le navigateur part chez Microsoft : on ne repasse pas ici.
    if (error) {
      setLoginError('Impossible de joindre Microsoft. Réessayez dans un instant.')
      setMsLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Distinguer une panne du service d'un vrai refus d'identifiants : lors de
      // l'incident du 30/07/2026, une base injoignable affichait « mot de passe
      // incorrect » et poussait les utilisateurs à réinitialiser inutilement.
      const msg = (error.message || '').toLowerCase()
      const unreachable =
        error.status === 0 || error.status === undefined ||
        (error.status !== undefined && error.status >= 500) ||
        /failed to fetch|network|timeout|load failed/.test(msg)
      setLoginError(unreachable
        ? 'Service momentanément indisponible — vos identifiants n’ont pas pu être vérifiés. Réessayez dans un instant.'
        : 'Email ou mot de passe incorrect.')
      setLoginLoading(false)
      return
    }

    // Le mot de passe seul n'ouvre qu'une session de niveau aal1. Si un facteur
    // est enrôlé, Supabase exige un second facteur pour atteindre aal2 : sans
    // cette étape, activer la double authentification ne protégerait rien.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: fac } = await supabase.auth.mfa.listFactors()
      const totp = (fac?.totp ?? []).find(f => f.status === 'verified')
      if (totp) {
        setMfaFactorId(totp.id)
        setView('mfa')
        setLoginLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setMfaChecking(true); setMfaError('')
    const supabase = createClient()
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (e1 || !ch) {
      setMfaChecking(false)
      setMfaError('Service momentanément indisponible. Réessayez dans un instant.')
      return
    }
    const { error: e2 } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: ch.id, code: mfaCode.trim(),
    })
    if (e2) {
      setMfaChecking(false)
      setMfaError('Code refusé. Vérifiez l’heure de votre téléphone, puis saisissez le code affiché.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim()) { setForgotError('Veuillez saisir votre email.'); return }
    setForgotSending(true); setForgotError('')
    const res = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: forgotEmail,
        subject: `Mot de passe oublié — ${forgotEmail}`,
        message: `L'utilisateur ${forgotEmail} a demandé la réinitialisation de son mot de passe.`,
        type: 'forgot_password',
      }),
    })
    setForgotSending(false)
    if (res.ok) setForgotSent(true)
    else setForgotError('Erreur lors de l\'envoi. Réessayez.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm mx-4">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100">Sensetho Apps</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Portail applicatif</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">

          {/* ── Login ── */}
          {view === 'login' && (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Connexion</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Accédez à votre espace Sensetho</p>

              {/* Le SSO est présenté en premier : c'est la voie recommandée, et les
                  comptes existants s'y rattachent automatiquement par leur adresse. */}
              <button type="button" onClick={handleMicrosoft} disabled={msLoading}
                className="w-full flex items-center justify-center gap-2.5 border border-gray-300 dark:border-slate-600 rounded-lg py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                  <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
                </svg>
                {msLoading ? 'Redirection vers Microsoft…' : 'Se connecter avec Microsoft'}
              </button>

              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 border-t border-gray-100 dark:border-slate-700" />
                <span className="text-xs text-gray-400 dark:text-slate-500">ou</span>
                <span className="flex-1 border-t border-gray-100 dark:border-slate-700" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="vous@exemple.com"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Mot de passe</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      <Icon name={showPwd ? 'eyeOff' : 'eye'} size={16} />
                    </button>
                  </div>
                </div>
                {loginError && <p className="text-sm text-red-600">{loginError}</p>}
                <button type="submit" disabled={loginLoading}
                  className="w-full bg-gray-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {loginLoading ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>
              <div className="mt-4 flex flex-col items-center gap-2">
                <button onClick={() => { setView('forgot'); setForgotEmail(email); setForgotSent(false) }}
                  className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                  Mot de passe oublié ?
                </button>
                <div className="w-full border-t border-gray-100 dark:border-slate-700 mt-1 pt-3 text-center">
                  <Link href="/auth/register"
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors">
                    Pas encore de compte ? <span className="font-semibold underline underline-offset-2">Créer un compte</span>
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* ── Second facteur ── */}
          {view === 'mfa' && (
            <>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Vérification</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                Saisissez le code affiché par votre application d’authentification.
              </p>
              <form onSubmit={handleMfa} className="space-y-4">
                <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-center text-lg tracking-[0.4em] font-mono bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                {mfaError && <p className="text-sm text-red-600">{mfaError}</p>}
                <button type="submit" disabled={mfaChecking || mfaCode.length < 6}
                  className="w-full bg-gray-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {mfaChecking ? 'Vérification…' : 'Valider'}
                </button>
              </form>
            </>
          )}

          {/* ── Mot de passe oublié ── */}
          {view === 'forgot' && (
            <>
              <button onClick={() => setView('login')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                <Icon name="chevronLeft" size={13} /> Retour à la connexion
              </button>

              {forgotSent ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <Icon name="check" size={22} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">Demande envoyée</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Un administrateur a été notifié et vous contactera pour réinitialiser votre accès.
                  </p>
                  <button onClick={() => setView('login')} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Mot de passe oublié</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                    Saisissez votre email. Un ticket sera créé et un administrateur vous contactera.
                  </p>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                        placeholder="vous@exemple.com"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                    {forgotError && <p className="text-sm text-red-600">{forgotError}</p>}
                    <button type="submit" disabled={forgotSending}
                      className="w-full bg-gray-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                      {forgotSending ? 'Envoi…' : 'Envoyer la demande'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-300 dark:text-slate-600 mt-6">
          © 2025 Sensetho™ · Version Bêta
        </p>
      </div>
    </div>
  )
}
