'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/providers/ThemeProvider'
import Icon from '@/components/ui/Icon'
import type { Profile, Theme } from '@/types'

type Tab = 'info' | 'password' | 'appearance' | '2fa'

export default function AccountSettings({ profile, forced = false }: { profile: Profile; forced?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(forced ? 'password' : 'info')
  const { theme, setTheme } = useTheme()

  // — Info
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [infoMsg, setInfoMsg] = useState('')
  const [infoSaving, setInfoSaving] = useState(false)

  // — Password
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  // — Appearance
  const [prefSaving, setPrefSaving] = useState(false)

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'info', label: 'Informations', icon: 'user' },
    { id: 'password', label: 'Sécurité', icon: 'lock' },
    { id: 'appearance', label: 'Apparence', icon: 'sun' },
    { id: '2fa', label: '2FA', icon: 'shieldCheck' },
  ]

  async function saveInfo() {
    setInfoSaving(true); setInfoMsg('')
    const res = await fetch('/api/account/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName }),
    })
    setInfoSaving(false)
    setInfoMsg(res.ok ? 'Informations mises à jour.' : 'Erreur lors de la mise à jour.')
    if (res.ok) router.refresh()
  }

  async function changePassword() {
    setPwdError(''); setPwdMsg('')
    if (newPwd.length < 8) { setPwdError('8 caractères minimum.'); return }
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return }
    setPwdSaving(true)
    const res = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPwd }),
    })
    setPwdSaving(false)
    if (res.ok) {
      setPwdMsg('Mot de passe modifié avec succès.')
      setNewPwd(''); setConfirmPwd('')
      if (forced) setTimeout(() => router.push('/dashboard'), 1200)
    } else {
      const d = await res.json()
      setPwdError(d.error ?? 'Erreur lors du changement.')
    }
  }

  async function saveTheme(t: Theme) {
    setTheme(t); setPrefSaving(true)
    await fetch('/api/account/update-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: t }),
    })
    setPrefSaving(false)
  }

  const THEMES = [
    { value: 'light' as Theme, label: 'Clair', icon: 'sun' },
    { value: 'dark' as Theme, label: 'Sombre', icon: 'moon' },
    { value: 'system' as Theme, label: 'Système', icon: 'monitor' },
  ]

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">

      {/* Bannière mot de passe forcé */}
      {forced && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-6 py-4">
          <Icon name="alertTriangle" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Changement de mot de passe requis</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Un administrateur a défini un mot de passe temporaire. Veuillez le modifier avant de continuer.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => (!forced || t.id === 'password') && setTab(t.id)}
            disabled={forced && t.id !== 'password'}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-gray-900 dark:border-slate-300 text-gray-900 dark:text-slate-100'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">

        {/* ── Informations ── */}
        {tab === 'info' && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-gray-50 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">L&apos;adresse email ne peut pas être modifiée.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rôle</label>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                profile.role === 'admin'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                <Icon name={profile.role === 'admin' ? 'shield' : 'user'} size={11} />
                {profile.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </span>
            </div>
            {infoMsg && <p className={`text-sm ${infoMsg.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>{infoMsg}</p>}
            <button onClick={saveInfo} disabled={infoSaving}
              className="px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {infoSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* ── Sécurité ── */}
        {tab === 'password' && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  <Icon name={showPwd ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Confirmer le mot de passe</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            {/* Indicateur de force */}
            {newPwd && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[8, 12, 16].map(len => (
                    <div key={len} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPwd.length >= len ? (len === 8 ? 'bg-red-400' : len === 12 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200 dark:bg-slate-600'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {newPwd.length < 8 ? 'Trop court' : newPwd.length < 12 ? 'Acceptable' : newPwd.length < 16 ? 'Bon' : 'Excellent'}
                </p>
              </div>
            )}
            {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
            {pwdMsg && <p className="text-sm text-green-600">{pwdMsg}</p>}
            <button onClick={changePassword} disabled={pwdSaving || !newPwd || !confirmPwd}
              className="px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {pwdSaving ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </div>
        )}

        {/* ── Apparence ── */}
        {tab === 'appearance' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">Choisissez l&apos;apparence de l&apos;interface.</p>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              {THEMES.map(opt => (
                <button key={opt.value} onClick={() => saveTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === opt.value
                      ? 'border-gray-900 dark:border-slate-300 bg-gray-50 dark:bg-slate-700'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                  }`}>
                  <Icon name={opt.icon} size={22} className={theme === opt.value ? 'text-gray-900 dark:text-slate-100' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${theme === opt.value ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
                    {opt.label}
                  </span>
                  {theme === opt.value && <Icon name="check" size={12} className="text-gray-900 dark:text-slate-300" />}
                </button>
              ))}
            </div>
            {prefSaving && <p className="text-xs text-gray-400">Enregistrement…</p>}
          </div>
        )}

        {/* ── 2FA ── */}
        {tab === '2fa' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <Icon name="shieldCheck" size={28} className="text-gray-400 dark:text-slate-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900 dark:text-slate-100">Double authentification</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Cette fonctionnalité sera disponible dans une prochaine mise à jour.
              </p>
            </div>
            <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs rounded-full">
              Prochainement
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
