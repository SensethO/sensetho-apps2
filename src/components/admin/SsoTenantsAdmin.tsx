'use client'

import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'

// Annuaires Microsoft autorisés à se connecter en SSO.
//
// L'inscription Entra est multilocataire : sans cette liste, tout utilisateur
// d'un annuaire Microsoft obtiendrait un compte. C'est donc le point de contrôle
// d'accès de la plateforme, pas un simple référentiel.

interface Tenant {
  id: string; tenant_id: string; nom: string; domaines: string[]
  actif: boolean; notes: string | null; created_at: string
}

/** Échéance du secret client Azure. Sans renouvellement, le SSO s'arrête ce jour-là. */
const SECRET_EXPIRE_LE = '2028-07-31'

function joursAvantExpiration(): number {
  const reste = new Date(SECRET_EXPIRE_LE).getTime() - Date.now()
  return Math.floor(reste / 86_400_000)
}

export default function SsoTenantsAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const [nom, setNom] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [domaines, setDomaines] = useState('')
  const [notes, setNotes] = useState('')

  const charger = useCallback(async () => {
    const res = await fetch('/api/admin/sso-tenants')
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); setChargement(false); return }
    setTenants(j.tenants ?? []); setChargement(false)
  }, [])

  useEffect(() => { void charger() }, [charger])

  async function ajouter(e: React.FormEvent) {
    e.preventDefault()
    setOccupe(true); setErreur('')
    const res = await fetch('/api/admin/sso-tenants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, tenant_id: tenantId, domaines, notes }),
    })
    const j = await res.json().catch(() => ({}))
    setOccupe(false)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    setNom(''); setTenantId(''); setDomaines(''); setNotes('')
    await charger()
  }

  async function basculer(t: Tenant) {
    setOccupe(true); setErreur('')
    const res = await fetch('/api/admin/sso-tenants', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, actif: !t.actif }),
    })
    setOccupe(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErreur(j.error ?? 'Modification impossible'); return }
    await charger()
  }

  async function supprimer(t: Tenant) {
    setOccupe(true); setErreur('')
    const res = await fetch(`/api/admin/sso-tenants?id=${t.id}`, { method: 'DELETE' })
    setOccupe(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErreur(j.error ?? 'Suppression impossible'); return }
    await charger()
  }

  const champ = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900'
  const jours = joursAvantExpiration()
  const urgent = jours < 90

  return (
    <div className="space-y-6">

      {/* Échéance du secret : invisible ailleurs, et son expiration arrête le SSO
          sans aucun préavis de Microsoft. */}
      <div className={`rounded-xl border p-4 ${urgent
        ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
        : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'}`}>
        <div className="flex items-start gap-2">
          <Icon name="alertTriangle" size={18} className={urgent ? 'text-red-600 dark:text-red-400 mt-0.5' : 'text-amber-600 dark:text-amber-400 mt-0.5'} />
          <div className="text-sm">
            <p className="font-semibold text-gray-900 dark:text-slate-100">
              Secret Microsoft à renouveler avant le {new Date(SECRET_EXPIRE_LE).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-gray-600 dark:text-slate-300 mt-1">
              {jours > 0
                ? `Il reste ${jours} jours. Passé cette date, la connexion Microsoft cessera de fonctionner sans avertissement préalable.`
                : 'Échéance dépassée : la connexion Microsoft est probablement hors service.'}
            </p>
            <p className="text-gray-500 dark:text-slate-400 mt-1">
              Renouvellement : portail Azure → Inscriptions d’applications → <strong>Sens’ethO Apps — Connexion SSO</strong>
              → Certificats &amp; secrets → nouveau secret, puis reporter sa valeur dans Supabase (Authentication → Providers → Azure).
            </p>
          </div>
        </div>
      </div>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {/* Liste */}
      <div>
        <p className="font-semibold text-gray-900 dark:text-slate-100 mb-1">Annuaires autorisés</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          Seuls les utilisateurs de ces annuaires Microsoft peuvent créer un compte par SSO.
          Désactiver un annuaire coupe l’accès à ses utilisateurs, y compris à ceux dont le compte existe déjà.
        </p>
        {chargement ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 py-4">Chargement…</p>
        ) : (
          <div className="overflow-x-auto border border-gray-100 dark:border-slate-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50 text-left">
                <tr className="text-xs text-gray-500 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">Organisation</th>
                  <th className="px-3 py-2 font-medium">Identifiant d’annuaire</th>
                  <th className="px-3 py-2 font-medium">Domaines</th>
                  <th className="px-3 py-2 font-medium">État</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {tenants.map(t => (
                  <tr key={t.id} className={t.actif ? '' : 'opacity-50'}>
                    <td className="px-3 py-2 text-gray-900 dark:text-slate-100">{t.nom}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-slate-400">{t.tenant_id}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{t.domaines?.join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.actif
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                        {t.actif ? 'Autorisé' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => basculer(t)} disabled={occupe}
                        className="text-xs text-gray-500 dark:text-slate-400 hover:underline disabled:opacity-50">
                        {t.actif ? 'Suspendre' : 'Réactiver'}
                      </button>
                      <button onClick={() => supprimer(t)} disabled={occupe}
                        className="ml-3 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {!tenants.length && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-slate-400">
                    Aucun annuaire déclaré — aucune connexion Microsoft ne sera acceptée.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ajout */}
      <form onSubmit={ajouter} className="space-y-3 border-t border-gray-100 dark:border-slate-700 pt-5">
        <p className="font-semibold text-gray-900 dark:text-slate-100">Déclarer un annuaire</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          L’identifiant d’annuaire se lit dans le portail Azure du client (Entra ID → Vue d’ensemble → ID de locataire).
          Le client peut aussi l’obtenir à l’adresse
          <span className="font-mono"> login.microsoftonline.com/&lt;son-domaine&gt;/v2.0/.well-known/openid-configuration</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={nom} onChange={e => setNom(e.target.value)} required
            placeholder="Nom de l’organisation" className={champ} />
          <input value={tenantId} onChange={e => setTenantId(e.target.value)} required
            placeholder="00000000-0000-0000-0000-000000000000" className={`${champ} font-mono text-xs`} />
        </div>
        <input value={domaines} onChange={e => setDomaines(e.target.value)}
          placeholder="Domaines, séparés par des virgules (indicatif)" className={champ} />
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notes (facultatif)" className={champ} />
        <button type="submit" disabled={occupe}
          className="px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {occupe ? 'Enregistrement…' : 'Déclarer'}
        </button>
      </form>
    </div>
  )
}
