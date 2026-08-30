'use client'

// Plan de management de la durabilité.
//
// Il s'attache au programme et non au projet : un plan par projet serait
// vingt-neuf fois le même, et c'est exactement le genre de duplication qui
// fait qu'un plan n'est tenu par personne. Depuis un projet rattaché à un
// programme, cette page ouvre donc le plan du programme, et le dit.
//
// Chaque indicateur porte un seuil d'alerte et l'instance saisie en cas de
// franchissement : c'est le franchissement, et non la valeur, qui déclenche
// l'action.

import { useCallback, useEffect, useState } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'

interface Kpi {
  id: string; libelle: string; axe: string | null; unite: string | null
  valeur_depart: string | null; cible: string | null; echeance: string | null
  seuil_alerte: string | null; instance_escalade: string | null; frequence: string | null
  proprietaire_acteur_id: string | null
}
interface Acteur { id: string; nom: string; actif: boolean }

const AXES = [
  { v: 'financier', l: 'Financier', aide: 'Chiffre d’affaires sécurisé, coût évité, rendement.' },
  { v: 'client', l: 'Client et marché', aide: 'Référencements, attractivité, dialogue territorial.' },
  { v: 'processus', l: 'Processus internes', aide: 'Intensité carbone, eau recyclée, conformité, fournisseurs accompagnés.' },
  { v: 'apprentissage', l: 'Apprentissage et croissance', aide: 'Compréhension de la stratégie, compétences, égalité, couverture des géographies.' },
]

const inputCls = 'w-full rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400'

export default function ProjetRseSmpModule({ projetId, organisationId, readOnly }: ProjetRseModuleProps) {
  const [programmeId, setProgrammeId] = useState<string | null>(null)
  const [programmeNom, setProgrammeNom] = useState<string>('')
  const [kpi, setKpi] = useState<Kpi[]>([])
  const [acteurs, setActeurs] = useState<Acteur[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [f, setF] = useState({ libelle: '', axe: 'processus', unite: '', valeur_depart: '',
    cible: '', echeance: '', seuil_alerte: '', instance_escalade: '', frequence: '',
    proprietaire_acteur_id: '' })

  const charger = useCallback(async () => {
    try {
      const rp = await fetch(`/api/projet-rse/projets?organisation_id=${organisationId}`)
      const jp = await rp.json()
      if (!rp.ok) throw new Error(jp.error ?? 'Chargement impossible')
      const projet = (jp.projets ?? []).find((p: { id: string }) => p.id === projetId)
      const pid = projet?.programme_id ?? null
      setProgrammeId(pid)

      if (pid) {
        const rg = await fetch(`/api/projet-rse/programmes?organisation_id=${organisationId}`)
        if (rg.ok) setProgrammeNom(((await rg.json()).programmes ?? [])
          .find((g: { id: string }) => g.id === pid)?.nom ?? '')
      }
      const cible = pid ? `programme_id=${pid}` : `projet_id=${projetId}`
      const [rk, ra] = await Promise.all([
        fetch(`/api/projet-rse/smp?${cible}`),
        fetch(`/api/projet-rse/acteurs?organisation_id=${organisationId}`),
      ])
      const jk = await rk.json()
      if (!rk.ok) throw new Error(jk.error ?? 'Plan inaccessible')
      setKpi(jk.kpi ?? [])
      if (ra.ok) setActeurs(((await ra.json()).acteurs ?? []).filter((a: Acteur) => a.actif))
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [projetId, organisationId])

  useEffect(() => { void charger() }, [charger])

  const envoyer = async (methode: string, corps: Record<string, unknown>) => {
    try {
      const r = await fetch('/api/projet-rse/smp', {
        method: methode, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Opération impossible')
      await charger(); return true
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); return false }
  }

  const nomActeur = (id: string | null) => acteurs.find(a => a.id === id)?.nom ?? null
  const sansSeuil = kpi.filter(k => !k.seuil_alerte)

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
          {programmeId ? 'Plan du programme' : 'Plan du projet'}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {programmeId
            ? <>Ce plan est tenu au niveau du programme <strong>{programmeNom}</strong> et non projet par
                projet : un plan par projet serait le même vingt fois, et ce serait la meilleure façon qu’il
                ne soit tenu par personne. Ce que vous modifiez ici vaut pour tous les projets du programme.</>
            : <>Ce projet n’est rattaché à aucun programme : son plan lui est donc propre. Rattachez-le à un
                programme pour partager un plan commun.</>}
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span><strong>{kpi.length}</strong> indicateur{kpi.length > 1 ? 's' : ''}</span>
          {sansSeuil.length > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              <strong>{sansSeuil.length}</strong> sans seuil d’alerte — un indicateur sans seuil est un chiffre
            </span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2"><label className={labelCls}>Indicateur</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.libelle} onChange={e => setF({ ...f, libelle: e.target.value })} /></div>
            <div><label className={labelCls}>Axe</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.axe} onChange={e => setF({ ...f, axe: e.target.value })}>
                {AXES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
              </select></div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{AXES.find(a => a.v === f.axe)?.aide}</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div><label className={labelCls}>Unité</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.unite} onChange={e => setF({ ...f, unite: e.target.value })} /></div>
            <div><label className={labelCls}>Départ</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.valeur_depart} onChange={e => setF({ ...f, valeur_depart: e.target.value })} /></div>
            <div><label className={labelCls}>Cible</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.cible} onChange={e => setF({ ...f, cible: e.target.value })} /></div>
            <div><label className={labelCls}>Échéance</label>
              <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} /></div>
            <div><label className={labelCls}>Fréquence</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.frequence} onChange={e => setF({ ...f, frequence: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Seuil d’alerte</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.seuil_alerte} onChange={e => setF({ ...f, seuil_alerte: e.target.value })} /></div>
            <div><label className={labelCls}>Instance saisie au franchissement</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.instance_escalade} onChange={e => setF({ ...f, instance_escalade: e.target.value })} /></div>
            <div><label className={labelCls}>Propriétaire</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={f.proprietaire_acteur_id}
                onChange={e => setF({ ...f, proprietaire_acteur_id: e.target.value })}>
                <option value="">— à nommer —</option>
                {acteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select></div>
          </div>
          <div className="flex justify-end">
            <button disabled={!f.libelle.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              onClick={async () => {
                const ok = await envoyer('POST', {
                  ...(programmeId ? { programme_id: programmeId } : { projet_id: projetId }),
                  ...f, echeance: f.echeance || null,
                  proprietaire_acteur_id: f.proprietaire_acteur_id || null })
                if (ok) setF({ libelle: '', axe: 'processus', unite: '', valeur_depart: '', cible: '',
                  echeance: '', seuil_alerte: '', instance_escalade: '', frequence: '',
                  proprietaire_acteur_id: '' })
              }}>+ Ajouter l’indicateur</button>
          </div>
        </div>
      )}

      {AXES.map(axe => {
        const miens = kpi.filter(k => k.axe === axe.v)
        if (!miens.length) return null
        return (
          <div key={axe.v} className="rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{axe.l}</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                  <th className="py-1 pr-3">Indicateur</th><th className="py-1 pr-3">Départ → cible</th>
                  <th className="py-1 pr-3">Seuil d’alerte</th><th className="py-1 pr-3">Instance</th>
                  <th className="py-1 pr-3">Propriétaire</th>{!readOnly && <th />}
                </tr></thead>
                <tbody>
                  {miens.map(k => (
                    <tr key={k.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-1.5 pr-3 text-gray-900 dark:text-white">
                        {k.libelle}{k.unite ? ` (${k.unite})` : ''}
                      </td>
                      <td className="py-1.5 pr-3">{k.valeur_depart || '—'} → {k.cible || '—'}</td>
                      <td className={`py-1.5 pr-3 ${k.seuil_alerte ? '' : 'text-amber-700 dark:text-amber-400'}`}>
                        {k.seuil_alerte || 'à définir'}
                      </td>
                      <td className="py-1.5 pr-3">{k.instance_escalade || '—'}</td>
                      <td className={`py-1.5 pr-3 ${k.proprietaire_acteur_id ? '' : 'text-amber-700 dark:text-amber-400'}`}>
                        {nomActeur(k.proprietaire_acteur_id) ?? 'à nommer'}
                      </td>
                      {!readOnly && (
                        <td className="py-1.5">
                          <button onClick={() => envoyer('DELETE', { id: k.id })}
                            className="text-xs opacity-50 hover:opacity-100">🗑</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {kpi.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucun indicateur au plan. Une remarque de méthode : ne pas créer un cinquième axe consacré à la
          durabilité — ce serait l’isoler au lieu de l’intégrer, et reproduire dans le tableau de bord le
          cloisonnement que le diagnostic dénonce.
        </p>
      )}
    </div>
  )
}
