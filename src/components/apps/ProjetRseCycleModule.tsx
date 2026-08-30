'use client'

// Découpage du travail, responsabilités, jalons, risques et indicateurs.
//
// Quatre outils qui se tiennent : on découpe le travail en lots, on dit qui
// porte chaque lot, on pose les points de décision, on inscrit ce qui peut
// faire échouer, et on décide de ce qu'on mesure. Les titulaires sont pris au
// registre des parties prenantes — jamais saisis en clair — pour qu'une
// succession suive jusqu'ici.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'
import ProjetRseNotesPanel from '@/components/apps/ProjetRseNotesPanel'

type Onglet = 'lots' | 'jalons' | 'risques' | 'indicateurs'

interface Acteur { id: string; nom: string; actif: boolean }
interface Lot { id: string; code: string | null; libelle: string; description: string | null
  charge_jh: number | null; echeance: string | null; statut: string; ordre: number }
interface Raci { id: string; lot_id: string; acteur_id: string; role: 'R' | 'A' | 'C' | 'I' }
interface Jalon { id: string; libelle: string; nature: string; echeance: string | null
  critere: string | null; preuve: string | null; instance: string | null
  consequence: string | null; statut: string }
interface Risque { id: string; code: string | null; libelle: string; categorie: string | null
  probabilite: number; impact: number; reponse: string; traitement: string | null
  porteur_acteur_id: string | null; seuil_escalade: string | null; statut: string }
interface Indicateur { id: string; nom: string; mesure: string | null; niveau: string
  formule: string | null; source: string | null; frequence: string | null
  proprietaire_acteur_id: string | null; valeur_depart: string | null; cible: string | null
  tolerance: string | null; obligatoire: boolean }

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'lots', label: '🧱 Lots & responsabilités' },
  { id: 'jalons', label: '🚩 Jalons' },
  { id: 'risques', label: '⚠️ Risques' },
  { id: 'indicateurs', label: '📊 Indicateurs' },
]

const RACI_ROLES: { v: Raci['role']; l: string; aide: string }[] = [
  { v: 'R', l: 'Réalise', aide: 'Fait le travail.' },
  { v: 'A', l: 'Approuve', aide: 'Rend compte du résultat. Un seul par lot : une approbation partagée n’est portée par personne.' },
  { v: 'C', l: 'Consulté', aide: 'Son avis est demandé avant.' },
  { v: 'I', l: 'Informé', aide: 'Reçoit le résultat.' },
]
const NATURES = [
  { v: 'ferme_externe', l: 'Ferme externe', aide: 'Imposé par un tiers, non négociable.' },
  { v: 'gouvernance', l: 'Gouvernance', aide: 'Installe une capacité de décision.' },
  { v: 'passage_phase', l: 'Passage de phase', aide: 'Conditionne l’ouverture de la suite.' },
  { v: 'conditionnel', l: 'Conditionnel', aide: 'Subordonné à un préalable ; son report n’a pas de conséquence propre.' },
]
const NIVEAUX = [
  { v: 'livrable', l: 'Livrable', aide: 'Le produit attendu est-il fait ?' },
  { v: 'capacite', l: 'Capacité', aide: 'L’organisation sait-elle faire ce qu’elle ne savait pas ?' },
  { v: 'resultat', l: 'Résultat', aide: 'La pratique a-t-elle changé ?' },
  { v: 'benefice', l: 'Bénéfice', aide: 'La valeur attendue est-elle réalisée ? Se mesure au programme.' },
]
const REPONSES = [
  { v: 'eviter', l: 'Éviter' }, { v: 'reduire', l: 'Réduire' },
  { v: 'transferer', l: 'Transférer' }, { v: 'accepter', l: 'Accepter' },
]

const inputCls = 'w-full rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400'
const btnAdd = 'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60'

function niveauCriticite(p: number, i: number) {
  const c = p * i
  if (c >= 16) return { c, l: 'Critique', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' }
  if (c >= 12) return { c, l: 'Élevé', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' }
  if (c >= 8) return { c, l: 'Moyen', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' }
  return { c, l: 'Modéré', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' }
}

export default function ProjetRseCycleModule({ projetId, organisationId, readOnly }: ProjetRseModuleProps) {
  const base = `/api/projet-rse/projets/${projetId}`
  const [onglet, setOnglet] = useState<Onglet>('lots')
  const [acteurs, setActeurs] = useState<Acteur[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [raci, setRaci] = useState<Raci[]>([])
  const [jalons, setJalons] = useState<Jalon[]>([])
  const [risques, setRisques] = useState<Risque[]>([])
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const j = useCallback(async (u: string) => {
    const r = await fetch(u); const d = await r.json()
    if (!r.ok) throw new Error(d.error ?? 'Chargement impossible')
    return d
  }, [])

  const charger = useCallback(async () => {
    try {
      const [a, l, rc, jl, rq, ind] = await Promise.all([
        j(`/api/projet-rse/acteurs?organisation_id=${organisationId}`),
        j(`${base}/lots`), j(`/api/projet-rse/raci?projet_id=${projetId}`),
        j(`${base}/jalons`), j(`${base}/risques`), j(`${base}/indicateurs`),
      ])
      setActeurs((a.acteurs ?? []).filter((x: Acteur) => x.actif))
      setLots(l.lots ?? []); setRaci(rc.raci ?? []); setJalons(jl.jalons ?? [])
      setRisques(rq.risques ?? []); setIndicateurs(ind.indicateurs ?? [])
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [base, projetId, organisationId, j])

  useEffect(() => { void charger() }, [charger])

  const envoyer = useCallback(async (url: string, methode: string, corps?: unknown) => {
    try {
      const r = await fetch(url, {
        method: methode, headers: { 'Content-Type': 'application/json' },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'Opération impossible')
      await charger()
      return true
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); return false }
  }, [charger])

  const nomActeur = useCallback((id: string | null) =>
    acteurs.find(a => a.id === id)?.nom ?? '—', [acteurs])

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        {ONGLETS.map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${onglet === o.id
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'lots' && (
        <OngletLots lots={lots} raci={raci} acteurs={acteurs} readOnly={readOnly}
          nomActeur={nomActeur}
          onAjouter={(c) => envoyer(`${base}/lots`, 'POST', c)}
          onSupprimer={(id) => envoyer(`${base}/lots?id=${id}`, 'DELETE', { id })}
          onStatut={(id, statut) => envoyer(`${base}/lots`, 'PATCH', { id, statut })}
          onRaci={(c) => envoyer('/api/projet-rse/raci', 'POST', c)}
          onRaciSupprimer={(id) => envoyer(`/api/projet-rse/raci?id=${id}`, 'DELETE', { id })} />
      )}
      {onglet === 'jalons' && (
        <OngletJalons jalons={jalons} projetId={projetId} readOnly={readOnly}
          onAjouter={(c) => envoyer(`${base}/jalons`, 'POST', c)}
          onModifier={(c) => envoyer(`${base}/jalons`, 'PATCH', c)}
          onSupprimer={(id) => envoyer(`${base}/jalons?id=${id}`, 'DELETE', { id })} />
      )}
      {onglet === 'risques' && (
        <OngletRisques risques={risques} projetId={projetId} acteurs={acteurs} readOnly={readOnly} nomActeur={nomActeur}
          onAjouter={(c) => envoyer(`${base}/risques`, 'POST', c)}
          onModifier={(c) => envoyer(`${base}/risques`, 'PATCH', c)}
          onSupprimer={(id) => envoyer(`${base}/risques?id=${id}`, 'DELETE', { id })} />
      )}
      {onglet === 'indicateurs' && (
        <OngletIndicateurs indicateurs={indicateurs} acteurs={acteurs} readOnly={readOnly}
          nomActeur={nomActeur}
          onAjouter={(c) => envoyer(`${base}/indicateurs`, 'POST', c)}
          onSupprimer={(id) => envoyer(`${base}/indicateurs?id=${id}`, 'DELETE', { id })} />
      )}
    </div>
  )
}

// ── Lots et responsabilités ─────────────────────────────────────────────────

function OngletLots({ lots, raci, acteurs, readOnly, nomActeur, onAjouter, onSupprimer, onStatut, onRaci, onRaciSupprimer }: {
  lots: Lot[]; raci: Raci[]; acteurs: Acteur[]; readOnly: boolean
  nomActeur: (id: string | null) => string
  onAjouter: (c: Record<string, unknown>) => Promise<boolean>
  onSupprimer: (id: string) => Promise<boolean>
  onStatut: (id: string, statut: string) => Promise<boolean>
  onRaci: (c: Record<string, unknown>) => Promise<boolean>
  onRaciSupprimer: (id: string) => Promise<boolean>
}) {
  const [code, setCode] = useState(''); const [libelle, setLibelle] = useState('')
  const [charge, setCharge] = useState(''); const [echeance, setEcheance] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [acteurChoisi, setActeurChoisi] = useState(''); const [role, setRole] = useState<Raci['role']>('R')

  const total = lots.reduce((s, l) => s + Number(l.charge_jh ?? 0), 0)
  const sansApprobateur = lots.filter(l => !raci.some(r => r.lot_id === l.id && r.role === 'A'))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Structure de découpage du travail</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          La descente s’arrête dès qu’un lot peut être confié à une personne nommée, avec une échéance et une
          charge. Descendre plus bas produit un document que personne ne tient à jour.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span><strong>{lots.length}</strong> lot{lots.length > 1 ? 's' : ''}</span>
          <span><strong>{total.toFixed(1)}</strong> jours-homme</span>
          {sansApprobateur.length > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              <strong>{sansApprobateur.length}</strong> sans approbateur
            </span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"
          style={{ borderColor: 'var(--border)' }}>
          <div><label className={labelCls}>Code</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={code} onChange={e => setCode(e.target.value)} placeholder="3.1.1" /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Lot de travail</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={libelle} onChange={e => setLibelle(e.target.value)} /></div>
          <div><label className={labelCls}>Charge (j·h)</label>
            <input type="number" step="0.5" className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={charge} onChange={e => setCharge(e.target.value)} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className={labelCls}>Échéance</label>
              <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={echeance} onChange={e => setEcheance(e.target.value)} /></div>
            <button className={btnAdd} disabled={!libelle.trim()}
              onClick={async () => {
                if (await onAjouter({ code: code || null, libelle: libelle.trim(),
                  charge_jh: charge ? Number(charge) : null, echeance: echeance || null,
                  ordre: lots.length })) { setCode(''); setLibelle(''); setCharge(''); setEcheance('') }
              }}>+</button>
          </div>
        </div>
      )}

      {lots.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun lot de travail défini.</p>
      ) : lots.map(l => {
        const miens = raci.filter(r => r.lot_id === l.id)
        return (
          <div key={l.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">
                  {l.code && <span className="text-indigo-600 dark:text-indigo-400 mr-1.5">{l.code}</span>}
                  {l.libelle}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {l.charge_jh ? `${l.charge_jh} j·h` : 'charge non estimée'}
                  {l.echeance ? ` · échéance ${l.echeance}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!readOnly && (
                  <select className="rounded-md border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{ borderColor: 'var(--border)' }} value={l.statut}
                    onChange={e => onStatut(l.id, e.target.value)}>
                    <option value="a_faire">À faire</option>
                    <option value="en_cours">En cours</option>
                    <option value="accepte">Achevé et accepté</option>
                    <option value="abandonne">Abandonné</option>
                  </select>
                )}
                <button onClick={() => setOuvert(ouvert === l.id ? null : l.id)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                  {ouvert === l.id ? '▾' : '▸'} RACI ({miens.length})
                </button>
                {!readOnly && (
                  <button onClick={() => onSupprimer(l.id)} title="Supprimer le lot"
                    className="text-xs opacity-50 hover:opacity-100">🗑</button>
                )}
              </div>
            </div>

            {ouvert === l.id && (
              <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                {miens.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Aucune responsabilité affectée. Un lot sans approbateur n’a pas de compte à rendre.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {miens.map(r => (
                      <li key={r.id} className="flex items-center gap-2 text-sm">
                        <span className="inline-block w-6 text-center text-xs font-bold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {r.role}
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">{nomActeur(r.acteur_id)}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {RACI_ROLES.find(x => x.v === r.role)?.l}
                        </span>
                        {!readOnly && (
                          <button onClick={() => onRaciSupprimer(r.id)}
                            className="ml-auto text-xs opacity-50 hover:opacity-100">✕</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!readOnly && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]">
                      <label className={labelCls}>Partie prenante du registre</label>
                      <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                        value={acteurChoisi} onChange={e => setActeurChoisi(e.target.value)}>
                        <option value="">— choisir —</option>
                        {acteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Rôle</label>
                      <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                        value={role} onChange={e => setRole(e.target.value as Raci['role'])}>
                        {RACI_ROLES.map(r => <option key={r.v} value={r.v}>{r.v} — {r.l}</option>)}
                      </select>
                    </div>
                    <button className={btnAdd} disabled={!acteurChoisi}
                      onClick={async () => {
                        if (await onRaci({ lot_id: l.id, acteur_id: acteurChoisi, role })) setActeurChoisi('')
                      }}>Affecter</button>
                    <p className="w-full text-xs" style={{ color: 'var(--text-muted)' }}>
                      {RACI_ROLES.find(r => r.v === role)?.aide}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Jalons ──────────────────────────────────────────────────────────────────

function OngletJalons({ jalons, projetId, readOnly, onAjouter, onModifier, onSupprimer }: {
  jalons: Jalon[]; projetId: string; readOnly: boolean
  onAjouter: (c: Record<string, unknown>) => Promise<boolean>
  onModifier: (c: Record<string, unknown>) => Promise<boolean>
  onSupprimer: (id: string) => Promise<boolean>
}) {
  const [f, setF] = useState({ libelle: '', nature: 'passage_phase', echeance: '',
    critere: '', preuve: '', instance: '', consequence: '' })
  const incomplets = jalons.filter(j => !j.critere || !j.preuve || !j.instance)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Un jalon n’est pas une date, c’est une décision</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Quatre attributs écrits avant l’ouverture : le critère de franchissement, rédigé de façon binaire ;
          la preuve exigée ; l’instance qui prononce, distincte de celle qui produit ; la conséquence d’un
          manquement, y compris lorsqu’elle est nulle. Aucun jalon n’est franchi par défaut.
        </p>
        {incomplets.length > 0 && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {incomplets.length} jalon{incomplets.length > 1 ? 's' : ''} sans critère, preuve ou instance —
            {incomplets.length > 1 ? ' ce ne sont que des dates.' : ' ce n’est qu’une date.'}
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2"><label className={labelCls}>Jalon</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></div>
            <div><label className={labelCls}>Échéance</label>
              <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Nature</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={f.nature} onChange={e => setF({ ...f, nature: e.target.value })}>
              {NATURES.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {NATURES.find(n => n.v === f.nature)?.aide}
            </p>
          </div>
          <div><label className={labelCls}>Critère de franchissement — rédigé de façon binaire</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={f.critere} onChange={e => setF({ ...f, critere: e.target.value })}
              placeholder="« Socle opérationnel » n’est pas un critère. « Les 28 indicateurs sont produits pour les 7 géographies, avec piste d’audit » en est un." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Preuve exigée</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.preuve} onChange={e => setF({ ...f, preuve: e.target.value })} /></div>
            <div><label className={labelCls}>Instance qui prononce</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.instance} onChange={e => setF({ ...f, instance: e.target.value })} /></div>
            <div><label className={labelCls}>Conséquence d’un manquement</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.consequence} onChange={e => setF({ ...f, consequence: e.target.value })} /></div>
          </div>
          <div className="flex justify-end">
            <button className={btnAdd} disabled={!f.libelle.trim()}
              onClick={async () => {
                if (await onAjouter({ ...f, echeance: f.echeance || null }))
                  setF({ libelle: '', nature: 'passage_phase', echeance: '', critere: '',
                    preuve: '', instance: '', consequence: '' })
              }}>+ Ajouter le jalon</button>
          </div>
        </div>
      )}

      {jalons.map(j => (
        <div key={j.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">{j.libelle}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {NATURES.find(n => n.v === j.nature)?.l}{j.echeance ? ` · ${j.echeance}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!readOnly && (
                <select className="rounded-md border px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  style={{ borderColor: 'var(--border)' }} value={j.statut}
                  onChange={e => onModifier({ id: j.id, statut: e.target.value,
                    franchi_le: e.target.value === 'franchi' ? new Date().toISOString().slice(0, 10) : null })}>
                  <option value="ouvert">Ouvert</option>
                  <option value="franchi">Franchi</option>
                  <option value="manque">Manqué</option>
                  <option value="reporte">Reporté</option>
                </select>
              )}
              {!readOnly && (
                <button onClick={() => onSupprimer(j.id)} className="text-xs opacity-50 hover:opacity-100">🗑</button>
              )}
            </div>
          </div>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {([['Critère', j.critere], ['Preuve', j.preuve], ['Instance', j.instance],
               ['Conséquence', j.consequence]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-semibold text-gray-700 dark:text-gray-300">{k} : </dt>
                <dd className={`inline ${v ? '' : 'text-amber-700 dark:text-amber-400'}`}
                  style={v ? { color: 'var(--text-muted)' } : undefined}>{v || 'non renseigné'}</dd>
              </div>
            ))}
          </dl>
          {/* Notes & documents du jalon — règle universelle des apps RSE */}
          <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            <ProjetRseNotesPanel projetId={projetId} actionKey={`jalon_${j.id}`} readOnly={readOnly} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Risques ─────────────────────────────────────────────────────────────────

function OngletRisques({ risques, projetId, acteurs, readOnly, nomActeur, onAjouter, onModifier, onSupprimer }: {
  risques: Risque[]; projetId: string; acteurs: Acteur[]; readOnly: boolean
  nomActeur: (id: string | null) => string
  onAjouter: (c: Record<string, unknown>) => Promise<boolean>
  onModifier: (c: Record<string, unknown>) => Promise<boolean>
  onSupprimer: (id: string) => Promise<boolean>
}) {
  const [f, setF] = useState({ libelle: '', probabilite: 3, impact: 3, reponse: 'reduire',
    traitement: '', porteur_acteur_id: '', seuil_escalade: '' })
  const tries = useMemo(() => [...risques].sort(
    (a, b) => b.probabilite * b.impact - a.probabilite * a.impact), [risques])
  const eleves = tries.filter(r => r.probabilite * r.impact >= 12 && r.statut === 'ouvert')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Registre des risques du projet</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Criticité = probabilité × impact, de 1 à 25. Deux seuils d’escalade : le niveau, à partir de 12 ;
          et la vitesse — deux points gagnés en un trimestre, quel que soit le niveau atteint. Le second est
          le moins habituel et le plus utile : c’est le moment où le traitement coûte le moins cher.
        </p>
        {eleves.length > 0 && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            {eleves.length} risque{eleves.length > 1 ? 's' : ''} ouvert{eleves.length > 1 ? 's' : ''} au-delà
            du seuil d’escalade.
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div><label className={labelCls}>Risque</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className={labelCls}>Probabilité : {f.probabilite}/5</label>
              <input type="range" min={1} max={5} className="w-full accent-indigo-600"
                value={f.probabilite} onChange={e => setF({ ...f, probabilite: Number(e.target.value) })} /></div>
            <div><label className={labelCls}>Impact : {f.impact}/5</label>
              <input type="range" min={1} max={5} className="w-full accent-indigo-600"
                value={f.impact} onChange={e => setF({ ...f, impact: Number(e.target.value) })} /></div>
            <div><label className={labelCls}>Réponse</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.reponse} onChange={e => setF({ ...f, reponse: e.target.value })}>
                {REPONSES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select></div>
            <div><label className={labelCls}>Porteur</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.porteur_acteur_id} onChange={e => setF({ ...f, porteur_acteur_id: e.target.value })}>
                <option value="">— au programme —</option>
                {acteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className={labelCls}>Traitement</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.traitement} onChange={e => setF({ ...f, traitement: e.target.value })} /></div>
            <div><label className={labelCls}>Seuil d’escalade</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.seuil_escalade} onChange={e => setF({ ...f, seuil_escalade: e.target.value })} /></div>
          </div>
          <div className="flex justify-end">
            <button className={btnAdd} disabled={!f.libelle.trim()}
              onClick={async () => {
                if (await onAjouter({ ...f, porteur_acteur_id: f.porteur_acteur_id || null }))
                  setF({ libelle: '', probabilite: 3, impact: 3, reponse: 'reduire',
                    traitement: '', porteur_acteur_id: '', seuil_escalade: '' })
              }}>+ Inscrire le risque</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Risque</th><th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">I</th><th className="px-3 py-2">Criticité</th>
              <th className="px-3 py-2">Réponse</th><th className="px-3 py-2">Porteur</th>
              <th className="px-3 py-2">Statut</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {tries.map(r => {
              const n = niveauCriticite(r.probabilite, r.impact)
              return (
                <Fragment key={r.id}>
                <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                    {r.libelle}
                    {r.traitement && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.traitement}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">{r.probabilite}</td>
                  <td className="px-3 py-2 text-center">{r.impact}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${n.badge}`}>
                      {n.c} · {n.l}
                    </span>
                  </td>
                  <td className="px-3 py-2">{REPONSES.find(x => x.v === r.reponse)?.l}</td>
                  <td className="px-3 py-2">{nomActeur(r.porteur_acteur_id)}</td>
                  <td className="px-3 py-2">
                    {readOnly ? r.statut : (
                      <select className="rounded-md border px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        style={{ borderColor: 'var(--border)' }} value={r.statut}
                        onChange={e => onModifier({ id: r.id, statut: e.target.value })}>
                        <option value="ouvert">Ouvert</option><option value="maitrise">Maîtrisé</option>
                        <option value="realise">Réalisé</option><option value="retire">Retiré</option>
                      </select>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <button onClick={() => onSupprimer(r.id)} className="text-xs opacity-50 hover:opacity-100">🗑</button>
                    </td>
                  )}
                </tr>
                {/* Notes & documents du risque — règle universelle des apps RSE */}
                <tr>
                  <td colSpan={readOnly ? 7 : 8} className="px-3 pb-2">
                    <ProjetRseNotesPanel projetId={projetId} actionKey={`risque_${r.id}`} readOnly={readOnly} />
                  </td>
                </tr>
                </Fragment>
              )
            })}
            {!tries.length && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucun risque inscrit.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Indicateurs ─────────────────────────────────────────────────────────────

const JEU_MINIMAL = [
  { nom: 'Avancement', mesure: 'Lots de travail achevés et acceptés, rapportés au total',
    niveau: 'livrable', formule: 'lots acceptés / lots totaux', frequence: 'Mensuelle' },
  { nom: 'Charge consommée', mesure: 'Effort réel rapporté à l’effort prévu à date',
    niveau: 'livrable', formule: 'jours-homme consommés / prévus à date', frequence: 'Mensuelle' },
  { nom: 'Conformité du livrable', mesure: 'Écart à la spécification acceptée par le destinataire',
    niveau: 'livrable', formule: 'exigences satisfaites / exigences spécifiées', frequence: 'À la clôture de phase' },
  { nom: 'Adoption', mesure: 'Ce que les destinataires font effectivement du livrable',
    niveau: 'capacite', formule: 'à définir projet par projet', frequence: 'Semestrielle' },
]

function OngletIndicateurs({ indicateurs, acteurs, readOnly, nomActeur, onAjouter, onSupprimer }: {
  indicateurs: Indicateur[]; acteurs: Acteur[]; readOnly: boolean
  nomActeur: (id: string | null) => string
  onAjouter: (c: Record<string, unknown>) => Promise<boolean>
  onSupprimer: (id: string) => Promise<boolean>
}) {
  const [f, setF] = useState({ nom: '', mesure: '', niveau: 'livrable', formule: '',
    source: '', frequence: '', proprietaire_acteur_id: '', valeur_depart: '', cible: '', tolerance: '' })
  const manquants = JEU_MINIMAL.filter(m => !indicateurs.some(i => i.nom.toLowerCase() === m.nom.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Le jeu minimal de quatre</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Quatre indicateurs obligatoires par projet. Trois sont classiques ; le quatrième — l’adoption — est
          celui qui manquait, et c’est le seul qui regarde en dehors du projet. Deux conditions de
          recevabilité : un propriétaire nommé, et une source de donnée identifiée.
        </p>
        {manquants.length > 0 && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Manquent : {manquants.map(m => m.nom).join(' · ')}
            </span>
            <button className={btnAdd}
              onClick={async () => { for (const m of manquants) await onAjouter({ ...m, obligatoire: true }) }}>
              Créer le jeu minimal
            </button>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Nom</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></div>
            <div><label className={labelCls}>Niveau mesuré</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.niveau} onChange={e => setF({ ...f, niveau: e.target.value })}>
                {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
              </select></div>
            <div><label className={labelCls}>Propriétaire — condition de recevabilité</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.proprietaire_acteur_id} onChange={e => setF({ ...f, proprietaire_acteur_id: e.target.value })}>
                <option value="">— à nommer —</option>
                {acteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select></div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {NIVEAUX.find(n => n.v === f.niveau)?.aide}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div><label className={labelCls}>Formule</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.formule} onChange={e => setF({ ...f, formule: e.target.value })} /></div>
            <div><label className={labelCls}>Source — condition de recevabilité</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.source} onChange={e => setF({ ...f, source: e.target.value })} /></div>
            <div><label className={labelCls}>Valeur de départ</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.valeur_depart} onChange={e => setF({ ...f, valeur_depart: e.target.value })} /></div>
            <div><label className={labelCls}>Cible</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.cible} onChange={e => setF({ ...f, cible: e.target.value })} /></div>
          </div>
          <div className="flex justify-end">
            <button className={btnAdd} disabled={!f.nom.trim()}
              onClick={async () => {
                if (await onAjouter({ ...f, proprietaire_acteur_id: f.proprietaire_acteur_id || null }))
                  setF({ nom: '', mesure: '', niveau: 'livrable', formule: '', source: '',
                    frequence: '', proprietaire_acteur_id: '', valeur_depart: '', cible: '', tolerance: '' })
              }}>+ Ajouter l’indicateur</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Indicateur</th><th className="px-3 py-2">Niveau</th>
              <th className="px-3 py-2">Propriétaire</th><th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Départ → cible</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {indicateurs.map(i => (
              <tr key={i.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-3 py-2 text-gray-900 dark:text-white">
                  {i.nom}{i.obligatoire && <span className="ml-1 text-xs text-indigo-600 dark:text-indigo-400">·min</span>}
                  {i.mesure && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{i.mesure}</div>}
                </td>
                <td className="px-3 py-2">{NIVEAUX.find(n => n.v === i.niveau)?.l}</td>
                <td className={`px-3 py-2 ${i.proprietaire_acteur_id ? '' : 'text-amber-700 dark:text-amber-400'}`}>
                  {i.proprietaire_acteur_id ? nomActeur(i.proprietaire_acteur_id) : 'à nommer'}
                </td>
                <td className={`px-3 py-2 ${i.source ? '' : 'text-amber-700 dark:text-amber-400'}`}>
                  {i.source || 'à identifier'}
                </td>
                <td className="px-3 py-2">{i.valeur_depart || '—'} → {i.cible || '—'}</td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <button onClick={() => onSupprimer(i.id)} className="text-xs opacity-50 hover:opacity-100">🗑</button>
                  </td>
                )}
              </tr>
            ))}
            {!indicateurs.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucun indicateur. Commencez par le jeu minimal.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
