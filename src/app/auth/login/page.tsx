'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'

type View = 'login' | 'forgot'

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError('Email ou mot de passe incorrect.')
      setLoginLoading(false)
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
              <div className="mt-4 text-center">
                <button onClick={() => { setView('forgot'); setForgotEmail(email); setForgotSent(false) }}
                  className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
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
