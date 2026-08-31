'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Référentiel des parcelles.
 *
 * Le tri géodonnées verse les parcelles ; jusqu'ici rien ne permettait de les
 * relire. Cet écran est la contrepartie du versement : consulter, chercher,
 * rattacher, exporter.
 *
 * La surface y est portée à l'affichage. Elle est exigée par la déclaration de
 * diligence raisonnée, et elle est ici mesurée à partir du contour déposé — pas
 * déclarée par le fournisseur. Au-delà de 4 hectares, l'article 9 du règlement
 * (UE) 2023/1115 impose un polygone : une parcelle plus grande décrite par un
 * simple point est un manquement, et ce contrôle ne peut se faire qu'au niveau
 * du référentiel, le tri ne voyant qu'un fichier à la fois.
 */

interface Signal { etat: 'perturbation' | 'risque_eleve' | 'sans_signal' | 'non_analyse'; analyseLe: string | null }

interface Parcelle {
  id: string
  supplier_id: string | null
  attachment_id: string
  feature_index: number
  plot_ref: string | null
  producer_name: string | null
  commodity: string | null
  country: string | null
  geometry_type: string | null
  declared_area_ha: number | null
  computed_area_ha: number | null
  centroid_lon: number | null
  centroid_lat: number | null
  survey_date: string | null
  survey_source: string | null
  created_at: string
  created_by: string | null
  supplier_assigned_at?: string | null
  supplier_assigned_by?: string | null
  attachment_name: string | null
  supplier_name: string | null
  surface_retenue_ha: number
  polygone_requis: boolean
  polygone_manquant: boolean
  signal: Signal
}

interface Totaux {
  parcelles: number
  surfaceHa: number
  fournisseursCouverts: number
  sansFournisseur: number
  auDela4Ha: number
  manquementsPolygone: number
  seuilHa: number
}

interface Doublon {
  geom_hash: string
  occurrences: number
  fournisseurs: number
  surface_ha: number | null
}

interface Fournisseur { id: string; company: string | null }

const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4'
const input = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const btnP = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnG = 'px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'

const SIGNAUX = {
  perturbation: { label: 'Perturbation', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  risque_eleve: { label: 'Risque élevé', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  sans_signal: { label: 'Aucun signal', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  non_analyse: { label: 'Non analysée', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300' },
} as const

type Colonne = 'ref' | 'fournisseur' | 'fichier' | 'pays' | 'geometrie' | 'surface' | 'versee' | 'signal'

const nb = (v: number, d = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const jour = (v?: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(+d) ? String(v) : d.toLocaleDateString('fr-FR')
}
const refLisible = (p: Parcelle) => p.plot_ref?.trim() || `#${p.feature_index + 1}`

export default function EudrPlotsPanel({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [doublons, setDoublons] = useState<Doublon[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(false)

  // Filtres
  const [recherche, setRecherche] = useState('')
  const [fFournisseur, setFFournisseur] = useState('')
  const [fPays, setFPays] = useState('')
  const [fSurface, setFSurface] = useState<'' | 'grandes' | 'petites' | 'manquement'>('')
  const [fSignal, setFSignal] = useState('')

  // Tri
  const [triCol, setTriCol] = useState<Colonne>('surface')
  const [triAsc, setTriAsc] = useState(false)

  // Sélection et rattachement
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [cible, setCible] = useState('')

  const charger = useCallback(async () => {
    setChargement(true)
    const res = await fetch(`/api/eudr-fournisseurs/plots?org_id=${orgId}`)
    const j = await res.json().catch(() => ({}))
    setChargement(false)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    setErreur('')
    setParcelles(j.parcelles ?? [])
    setTotaux(j.totaux ?? null)
    setDoublons((j.doublons ?? []).filter((d: Doublon) => (d.fournisseurs ?? 0) > 1))
    setFournisseurs(j.fournisseurs ?? [])
    setSelection(new Set())
  }, [orgId])

  useEffect(() => { void charger() }, [charger])

  const pays = useMemo(
    () => Array.from(new Set(parcelles.map(p => p.country).filter((c): c is string => !!c))).sort(),
    [parcelles],
  )

  const listeFiltree = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const filtrees = parcelles.filter(p => {
      if (fFournisseur === '__sans__' ? !!p.supplier_id : fFournisseur && p.supplier_id !== fFournisseur) return false
      if (fPays && p.country !== fPays) return false
      if (fSurface === 'grandes' && !p.polygone_requis) return false
      if (fSurface === 'petites' && p.polygone_requis) return false
      if (fSurface === 'manquement' && !p.polygone_manquant) return false
      if (fSignal && p.signal.etat !== fSignal) return false
      if (q) {
        const foin = [refLisible(p), p.supplier_name, p.producer_name, p.attachment_name, p.country, p.commodity, p.survey_source]
          .filter(Boolean).join(' ').toLowerCase()
        if (!foin.includes(q)) return false
      }
      return true
    })

    const sens = triAsc ? 1 : -1
    const cle = (p: Parcelle): string | number => {
      switch (triCol) {
        case 'ref': return refLisible(p).toLowerCase()
        case 'fournisseur': return (p.supplier_name ?? '').toLowerCase()
        case 'fichier': return (p.attachment_name ?? '').toLowerCase()
        case 'pays': return (p.country ?? '').toLowerCase()
        case 'geometrie': return (p.geometry_type ?? '').toLowerCase()
        case 'surface': return p.surface_retenue_ha
        case 'versee': return p.created_at ?? ''
        case 'signal': return p.signal.etat
      }
    }
    return filtrees.sort((a, b) => {
      const va = cle(a), vb = cle(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sens
      return String(va).localeCompare(String(vb), 'fr') * sens
    })
  }, [parcelles, recherche, fFournisseur, fPays, fSurface, fSignal, triCol, triAsc])

  // Totaux de la sélection courante : c'est la surface filtrée qui sert à préparer
  // une déclaration, pas toujours celle du référentiel entier.
  const surfaceFiltree = useMemo(
    () => listeFiltree.reduce((s, p) => s + p.surface_retenue_ha, 0),
    [listeFiltree],
  )

  function trierPar(col: Colonne) {
    if (col === triCol) setTriAsc(a => !a)
    else { setTriCol(col); setTriAsc(col !== 'surface' && col !== 'versee') }
  }

  function basculer(id: string) {
    setSelection(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toutSelectionne = listeFiltree.length > 0 && listeFiltree.every(p => selection.has(p.id))
  function basculerTout() {
    setSelection(s => {
      const n = new Set(s)
      if (toutSelectionne) listeFiltree.forEach(p => n.delete(p.id))
      else listeFiltree.forEach(p => n.add(p.id))
      return n
    })
  }

  async function rattacher(supplierId: string | null) {
    if (!selection.size) return
    setOccupe(true); setErreur(''); setMessage('')
    const res = await fetch('/api/eudr-fournisseurs/plots', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, plotIds: Array.from(selection), supplier_id: supplierId }),
    })
    const j = await res.json().catch(() => ({}))
    setOccupe(false)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    const nom = fournisseurs.find(f => f.id === supplierId)?.company
    setMessage(supplierId
      ? `${j.modifiees} parcelle(s) rattachée(s) à ${nom ?? 'ce fournisseur'}.`
      : `${j.modifiees} parcelle(s) détachée(s) de leur fournisseur.`)
    setCible('')
    await charger()
  }

  async function exporter() {
    setExportEnCours(true); setErreur('')
    try {
      const res = await fetch(`/api/eudr-fournisseurs/plots/export-excel?org_id=${orgId}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErreur(j.error ?? `Erreur ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'EUDR_Parcelles.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErreur(String((e as Error).message ?? e))
    } finally {
      setExportEnCours(false)
    }
  }

  if (chargement) return <p className="text-sm text-gray-500 dark:text-gray-400 py-6">Chargement du référentiel…</p>

  const seuil = totaux?.seuilHa ?? 4
  const fleche = (col: Colonne) => (triCol === col ? (triAsc ? ' ▲' : ' ▼') : '')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">Référentiel des parcelles</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Toutes les parcelles versées depuis le tri géodonnées. La surface indiquée est
            <strong> calculée à partir du contour déposé</strong>, non reprise de la déclaration du fournisseur ;
            elle est exigée par la déclaration de diligence raisonnée.
          </p>
        </div>
        <button className={btnP} onClick={exporter} disabled={exportEnCours || !parcelles.length}>
          {exportEnCours ? 'Export…' : '📊 Exporter (Excel)'}
        </button>
      </div>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

      {/* Totaux */}
      {totaux && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={card}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Parcelles au référentiel</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totaux.parcelles}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Surface totale</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{nb(totaux.surfaceHa)} ha</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Exactement {nb(totaux.surfaceHa, 4)} ha
            </p>
          </div>
          <div className={card}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fournisseurs couverts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totaux.fournisseursCouverts}</p>
            {totaux.sansFournisseur > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                {totaux.sansFournisseur} parcelle(s) non rattachée(s)
              </p>
            )}
          </div>
          <div className={card}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Au-delà de {seuil} ha</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totaux.auDela4Ha}</p>
            <p className={`text-[11px] mt-0.5 ${totaux.manquementsPolygone > 0
              ? 'text-red-600 dark:text-red-400 font-semibold'
              : 'text-gray-400 dark:text-gray-500'}`}>
              {totaux.manquementsPolygone > 0
                ? `${totaux.manquementsPolygone} sans polygone`
                : 'Toutes en polygone'}
            </p>
          </div>
        </div>
      )}

      {/* Manquement réglementaire : le dire, et dire quoi en faire */}
      {totaux && totaux.manquementsPolygone > 0 && (
        <div className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            ⚠️ {totaux.manquementsPolygone} parcelle(s) de plus de {seuil} ha sans polygone
          </p>
          <p className="text-xs text-red-800/90 dark:text-red-200/90 mt-1">
            L’article 9 du règlement (UE) 2023/1115 impose une géolocalisation en polygone au-delà de {seuil} hectares.
            Un point ne suffit pas : la déclaration de diligence raisonnée serait incomplète.
            Demandez au fournisseur un contour fermé pour ces parcelles.
          </p>
          <button className={`${btnG} mt-2`} onClick={() => { setFSurface('manquement'); setFSignal(''); setRecherche('') }}>
            Voir ces parcelles
          </button>
        </div>
      )}

      {/* Contours déclarés par plusieurs fournisseurs */}
      {doublons.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            ⚠️ {doublons.length} contour(s) déclaré(s) par plusieurs fournisseurs
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">
            Un même contour vendu par deux fournisseurs différents ne se voit qu’au référentiel.
            À instruire avant toute déclaration.
          </p>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} flex-1 min-w-[200px]`}
          placeholder="Rechercher (référence, producteur, fichier, pays…)"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        <select className={input} value={fFournisseur} onChange={e => setFFournisseur(e.target.value)}>
          <option value="">Tous les fournisseurs</option>
          <option value="__sans__">Non rattachées</option>
          {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.company ?? '(sans nom)'}</option>)}
        </select>
        <select className={input} value={fPays} onChange={e => setFPays(e.target.value)}>
          <option value="">Tous les pays</option>
          {pays.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={input} value={fSurface} onChange={e => setFSurface(e.target.value as typeof fSurface)}>
          <option value="">Toutes surfaces</option>
          <option value="grandes">Plus de {seuil} ha</option>
          <option value="petites">{seuil} ha ou moins</option>
          <option value="manquement">Polygone manquant</option>
        </select>
        <select className={input} value={fSignal} onChange={e => setFSignal(e.target.value)}>
          <option value="">Tous signaux</option>
          {Object.entries(SIGNAUX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(recherche || fFournisseur || fPays || fSurface || fSignal) && (
          <button className={btnG} onClick={() => { setRecherche(''); setFFournisseur(''); setFPays(''); setFSurface(''); setFSignal('') }}>
            Réinitialiser
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {listeFiltree.length} parcelle(s) affichée(s) · {nb(surfaceFiltree)} ha
        {listeFiltree.length !== parcelles.length && ` (sur ${parcelles.length} au référentiel)`}
      </p>

      {/* Rattachement par lot */}
      {canWrite && selection.size > 0 && (
        <div className="rounded-xl border border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-900/20 px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-green-900 dark:text-green-200">
            {selection.size} parcelle(s) sélectionnée(s) — rattacher à
          </span>
          <select className={input} value={cible} onChange={e => setCible(e.target.value)}>
            <option value="">Choisir un fournisseur…</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.company ?? '(sans nom)'}</option>)}
          </select>
          <button className={btnP} disabled={!cible || occupe} onClick={() => rattacher(cible)}>
            {occupe ? 'Rattachement…' : 'Rattacher'}
          </button>
          <button className={btnG} disabled={occupe} onClick={() => rattacher(null)}>
            Détacher
          </button>
          <button className={btnG} onClick={() => setSelection(new Set())}>Annuler la sélection</button>
        </div>
      )}

      {/* Liste */}
      {!parcelles.length ? (
        <div className={card}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucune parcelle au référentiel. Versez un fichier depuis l’onglet « 🔎 Tri géodonnées »,
            bouton « Verser au référentiel » : seuls les fichiers jugés exploitables peuvent y entrer.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                {canWrite && (
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={toutSelectionne} onChange={basculerTout} aria-label="Tout sélectionner" />
                  </th>
                )}
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('ref')}>Référence{fleche('ref')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('fournisseur')}>Fournisseur{fleche('fournisseur')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('fichier')}>Fichier d’origine{fleche('fichier')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('pays')}>Pays{fleche('pays')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('geometrie')}>Géométrie{fleche('geometrie')}</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => trierPar('surface')}>Surface (ha){fleche('surface')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('versee')}>Versée le{fleche('versee')}</th>
                <th className="px-3 py-2 cursor-pointer" onClick={() => trierPar('signal')}>Signal{fleche('signal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {listeFiltree.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 ${selection.has(p.id) ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selection.has(p.id)} onChange={() => basculer(p.id)} aria-label={`Sélectionner ${refLisible(p)}`} />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {refLisible(p)}
                    {p.producer_name && (
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">{p.producer_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {p.supplier_name ?? <span className="text-amber-700 dark:text-amber-400">Non rattachée</span>}
                    {p.supplier_assigned_at && (
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        rattachée le {jour(p.supplier_assigned_at)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[220px] truncate" title={p.attachment_name ?? ''}>
                    {p.attachment_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.country ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {p.geometry_type ?? '—'}
                    {p.polygone_manquant && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        title={`Plus de ${seuil} ha : l’article 9 impose un polygone`}>
                        polygone requis
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${p.polygone_requis ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                    title={`${nb(p.surface_retenue_ha, 4)} ha${p.computed_area_ha ? '' : ' (surface déclarée, contour non mesurable)'}`}>
                    {nb(p.surface_retenue_ha)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{jour(p.created_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SIGNAUX[p.signal.etat].cls}`}
                      title={p.signal.analyseLe ? `Analyse du ${jour(p.signal.analyseLe)}` : 'Aucune analyse de couvert pour ce fichier'}>
                      {SIGNAUX[p.signal.etat].label}
                    </span>
                  </td>
                </tr>
              ))}
              {!listeFiltree.length && (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                    Aucune parcelle ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        La géométrie complète n’est pas recopiée dans le référentiel : le fichier GeoJSON reste sur SharePoint
        et fait foi. Ne sont conservées que les valeurs dérivées utiles aux contrôles — surface, centroïde,
        emprise, empreinte du contour. Le signal reprend la dernière analyse de couvert du fichier d’origine :
        il indique un changement de couvert, jamais une déforestation qualifiée.
      </p>
    </div>
  )
}
