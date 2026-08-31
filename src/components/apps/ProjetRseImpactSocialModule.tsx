'use client'

// Théorie du changement, retour social sur investissement et boucles
// d'apprentissage.
//
// La théorie du changement se lit dans un sens et se construit dans l'autre :
// on part de l'impact visé et on remonte jusqu'aux activités, ce qui oblige à
// écrire les hypothèses — ce qui doit être vrai pour que la chaîne tienne.
// C'est là que se trouve la valeur de l'exercice : une chaîne dont les
// hypothèses ne sont pas écrites n'est pas testable.
//
// Le ratio de retour social n'est affiché qu'accompagné de sa méthode. Sans
// elle, un ratio ne vaut rien et se retourne contre celui qui le publie.

import { useCallback, useEffect, useState } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'
import ProjetRseNotesPanel from '@/components/apps/ProjetRseNotesPanel'

interface Impact {
  besoin: string | null; activites: string | null; extrants: string | null
  resultats: string | null; impacts: string | null; hypotheses: string | null
  sroi_investissement: number | null; sroi_valeur: number | null
  sroi_methode: string | null; boucles: string | null
}

const VIDE: Impact = {
  besoin: '', activites: '', extrants: '', resultats: '', impacts: '', hypotheses: '',
  sroi_investissement: null, sroi_valeur: null, sroi_methode: '', boucles: '',
}

const CHAINE: { cle: keyof Impact; titre: string; aide: string }[] = [
  { cle: 'besoin', titre: '1 · Besoin', aide: 'Le problème social ou environnemental auquel le projet répond. Établi, pas supposé.' },
  { cle: 'activites', titre: '2 · Activités', aide: 'Ce que le projet fait concrètement.' },
  { cle: 'extrants', titre: '3 · Extrants', aide: 'Ce que les activités produisent directement — le premier niveau, mesurable et insuffisant.' },
  { cle: 'resultats', titre: '4 · Résultats', aide: 'Ce qui change chez les personnes concernées. C’est ici que la mesure devient difficile, et utile.' },
  { cle: 'impacts', titre: '5 · Impacts', aide: 'Le changement durable, net de ce qui serait arrivé sans le projet.' },
]

const inputCls = 'w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300'

export default function ProjetRseImpactSocialModule({ projetId, readOnly }: ProjetRseModuleProps) {
  const base = `/api/projet-rse/projets/${projetId}/impact-social`
  const [d, setD] = useState<Impact>(VIDE)
  const [charge, setCharge] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const r = await fetch(base); const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Chargement impossible')
      if (j.impact) setD({ ...VIDE, ...j.impact })
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [base])

  useEffect(() => { void charger() }, [charger])

  const set = (p: Partial<Impact>) => { setD(v => ({ ...v, ...p })); setMessage(null) }

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      const r = await fetch(base, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Enregistrement impossible')
      setD({ ...VIDE, ...j.impact }); setMessage('Enregistré.')
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  const inv = Number(d.sroi_investissement ?? 0)
  const val = Number(d.sroi_valeur ?? 0)
  const ratio = inv > 0 ? val / inv : null
  const chaineIncomplete = CHAINE.filter(c => !String(d[c.cle] ?? '').trim())

  return (
    <div className="space-y-4 max-w-4xl">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">La théorie du changement</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Elle se lit du besoin vers l’impact, et se construit dans l’autre sens : partir de l’impact visé et
          remonter, ce qui oblige à écrire les hypothèses. Une chaîne dont les hypothèses ne sont pas écrites
          n’est pas testable, et un projet dont la théorie n’est pas testable ne s’améliore jamais.
        </p>
        {chaineIncomplete.length > 0 && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Chaîne incomplète : {chaineIncomplete.map(c => c.titre.split(' · ')[1]).join(' · ')}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        {CHAINE.map(c => (
          <div key={c.cle}>
            <label className={labelCls}>{c.titre}</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
              disabled={readOnly} value={String(d[c.cle] ?? '')}
              onChange={e => set({ [c.cle]: e.target.value } as Partial<Impact>)} />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{c.aide}</p>
          </div>
        ))}
        <div>
          <label className={labelCls}>
            Hypothèses
            {!String(d.hypotheses ?? '').trim() && (
              <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">— la rubrique qui rend la chaîne testable</span>
            )}
          </label>
          <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--border)' }}
            disabled={readOnly} value={String(d.hypotheses ?? '')}
            onChange={e => set({ hypotheses: e.target.value })} />
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Ce qui doit être vrai pour que chaque maillon entraîne le suivant. Une hypothèse fausse fait
            tomber la chaîne entière, et c’est la première chose à vérifier en revue.
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Retour social sur investissement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Investissement (€)</label>
            <input type="number" step="1000" className={inputCls} style={{ borderColor: 'var(--border)' }}
              disabled={readOnly} value={d.sroi_investissement ?? ''}
              onChange={e => set({ sroi_investissement: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Valeur sociale créée (€)</label>
            <input type="number" step="1000" className={inputCls} style={{ borderColor: 'var(--border)' }}
              disabled={readOnly} value={d.sroi_valeur ?? ''}
              onChange={e => set({ sroi_valeur: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Ratio</label>
            <div className="rounded-md border px-2.5 py-1.5 text-sm" style={{ borderColor: 'var(--border)' }}>
              {ratio === null ? (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              ) : String(d.sroi_methode ?? '').trim() ? (
                <span className="font-semibold text-gray-900 dark:text-white">
                  {ratio.toFixed(2)} € pour 1 € investi
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  masqué — méthode non écrite
                </span>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Méthode de valorisation
            {!String(d.sroi_methode ?? '').trim() && (
              <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">— sans elle, le ratio n’est pas affiché</span>
            )}
          </label>
          <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--border)' }}
            disabled={readOnly} value={String(d.sroi_methode ?? '')}
            onChange={e => set({ sroi_methode: e.target.value })}
            placeholder="Approximations financières retenues, périmètre, durée, taux d’actualisation, part attribuable au projet — et ce qui a été délibérément exclu." />
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Le ratio reste masqué tant que la méthode n’est pas écrite. Un chiffre de retour social sans sa
            méthode se retourne contre celui qui le publie — c’est la même règle que « mesuré n’est pas
            déclaré ».
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <label className={labelCls}>Boucles d’apprentissage</label>
        <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--border)' }}
          disabled={readOnly} value={String(d.boucles ?? '')}
          onChange={e => set({ boucles: e.target.value })}
          placeholder="Ce qui a été appris, ce qui a été réorienté en conséquence, et quand." />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Un apprentissage qui ne réoriente rien n’est pas un apprentissage. Consigner la date rend la
          boucle vérifiable en revue de phase.
        </p>
      </div>

      {message && <p className="text-sm text-indigo-700 dark:text-indigo-300">{message}</p>}

      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={enregistrer} disabled={enCours}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}

      <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <ProjetRseNotesPanel projetId={projetId} actionKey="impact-social" readOnly={readOnly} />
      </div>
    </div>
  )
}
