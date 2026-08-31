'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'


// Tri automatique des fichiers de géolocalisation.
//
// Filtre de qualité documentaire exécuté avant d'engager les frais d'une
// expertise satellite. Il ne conclut jamais à la conformité : un fichier sans
// constat bloquant est exploitable, il n'est pas validé pour autant.

type Gravite = 'bloquant' | 'alerte' | 'information'
interface Constat { code: string; gravite: Gravite; libelle: string; parcelles: number[]; detail?: string }
interface Tri {
  id: string; attachment_id: string; pays_declare: string | null
  nb_parcelles: number; surface_ha: number; nb_bloquants: number; nb_alertes: number
  exploitable: boolean; constats: Constat[]; analyzed_at: string; analyzed_by: string | null
}
interface Doc { id: string; name: string; created_at: string; corrige_de?: string | null }

/**
 * Versions d'un même fichier.
 *
 * La correction ne remplace pas l'original : elle dépose « X (corrigé).geojson »
 * à côté de lui. Les deux décrivent les mêmes terres, et le référentiel ne doit
 * jamais porter les deux à la fois. L'écran les montre donc appariés, jamais
 * comme deux fichiers sans rapport.
 */
const RE_CORRIGE = /\s*\(corrigé\)(?=\.[^.]+$|$)/i
const estNomCorrige = (nom: string) => RE_CORRIGE.test(nom)
const nomOriginalDe = (nom: string) => nom.replace(RE_CORRIGE, '')
const nomCorrigeDe = (nom: string) => {
  const base = nom.replace(/\.(geojson|json)$/i, '')
  const ext = nom.match(/\.(geojson|json)$/i)?.[0] ?? '.geojson'
  return `${base} (corrigé)${ext}`
}

interface Ligne { doc: Doc; corrigee: boolean; origine: Doc | null; corrige: Doc | null }

const PASTILLE: Record<Gravite, string> = {
  bloquant: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  alerte: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  information: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

// Anomalies que la correction automatique sait résoudre (géométrie réparable).
const CODES_REPARABLES = ['TROUS', 'SOMMETS_DUPLIQUES', 'ANNEAU_NON_FERME', 'AUTO_INTERSECTION']
const aReparable = (tri: Tri) => tri.constats.some(c => CODES_REPARABLES.includes(c.code))

export default function EudrScreeningPanel({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [tris, setTris] = useState<Record<string, Tri>>({})
  const [chargement, setChargement] = useState(true)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [verse, setVerse] = useState<Record<string, string>>({})
  const [rappel, setRappel] = useState<Record<string, string>>({})
  const [corrige, setCorrige] = useState<Record<string, string>>({})
  const [auReferentiel, setAuReferentiel] = useState<Set<string>>(new Set())

  const charger = useCallback(async () => {
    const res = await fetch(`/api/eudr-fournisseurs/screening?org_id=${orgId}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); setChargement(false); return }
    setDocs(j.documents ?? [])
    setTris(Object.fromEntries((j.tris ?? []).map((t: Tri) => [t.attachment_id, t])))
    setAuReferentiel(new Set<string>((j.auReferentiel ?? []) as string[]))
    setChargement(false)
  }, [orgId])

  useEffect(() => { void charger() }, [charger])

  // Chaque version corrigée est affichée sous son original, jamais ailleurs :
  // deux entrées sans lien visible laisseraient croire à deux fichiers distincts.
  const lignes = useMemo<Ligne[]>(() => {
    const parId = new Map(docs.map(d => [d.id, d]))
    const parNom = new Map(docs.map(d => [d.name, d]))
    const corrigeeDe = (d: Doc) => (d.corrige_de ? parId.get(d.corrige_de) ?? null : null) ?? (
      estNomCorrige(d.name) ? parNom.get(nomOriginalDe(d.name)) ?? null : null
    )
    const versionCorrigee = (d: Doc) =>
      docs.find(x => x.corrige_de === d.id) ?? parNom.get(nomCorrigeDe(d.name)) ?? null

    const estCorrigee = (d: Doc) => !!d.corrige_de || estNomCorrige(d.name)
    const placees = new Set<string>()
    const sortie: Ligne[] = []
    for (const d of docs) {
      if (placees.has(d.id) || estCorrigee(d)) continue
      const c = versionCorrigee(d)
      sortie.push({ doc: d, corrigee: false, origine: null, corrige: c })
      placees.add(d.id)
      if (c && !placees.has(c.id)) {
        sortie.push({ doc: c, corrigee: true, origine: d, corrige: null })
        placees.add(c.id)
      }
    }
    // Versions corrigées dont l'original a disparu : elles restent visibles.
    for (const d of docs) {
      if (placees.has(d.id)) continue
      sortie.push({ doc: d, corrigee: estCorrigee(d), origine: corrigeeDe(d), corrige: null })
      placees.add(d.id)
    }
    return sortie
  }, [docs])

  async function trier(doc: Doc) {
    setOccupe(doc.id); setErreur('')
    const res = await fetch('/api/eudr-fournisseurs/screening', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, attachmentId: doc.id }),
    })
    const j = await res.json().catch(() => ({}))
    setOccupe(null)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    setTris(t => ({ ...t, [doc.id]: j.tri }))
    setOuvert(doc.id)
  }

  /** Verse les parcelles du fichier au référentiel, socle de la traçabilité. */
  async function verser(doc: Doc) {
    setOccupe(doc.id); setErreur('')
    const res = await fetch('/api/eudr-fournisseurs/plots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, attachmentId: doc.id }),
    })
    const j = await res.json().catch(() => ({}))
    setOccupe(null)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    const alerte = (j.doublonsInterFournisseurs ?? []).length
    // Le message vient de la route : elle seule sait ce qui est sorti du
    // périmètre courant, et « en l'état » ou « version corrigée » n'engagent
    // pas la même chose vis-à-vis d'une déclaration déjà déposée.
    setVerse(v => ({
      ...v,
      [doc.id]: (j.message ?? `${j.versees} parcelle(s) versée(s), ${j.surfaceHa} ha`)
        + (alerte ? ` — ⚠️ ${alerte} contour(s) déclaré(s) par plusieurs fournisseurs` : ''),
    }))
    setRappel(r => ({ ...r, [doc.id]: j.rappel ?? '' }))
    await charger() // le périmètre courant a changé : l'autre version n'y est plus
  }

  /** Corrige automatiquement les erreurs réparables et dépose une version corrigée. */
  async function corriger(doc: Doc) {
    setOccupe(doc.id); setErreur('')
    const res = await fetch('/api/eudr-fournisseurs/screening/correct', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, attachmentId: doc.id }),
    })
    const j = await res.json().catch(() => ({}))
    setOccupe(null)
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); return }
    const restants = j.constatsRestants ?? 0
    setCorrige(c => ({
      ...c,
      [doc.id]: `Fichier corrigé déposé (${j.name}) — ${(j.codesResolus ?? []).length} type(s) d’erreur résolu(s)`
        + (j.exploitable
          ? ', désormais exploitable. Versez cette version corrigée au référentiel : elle en retirera les parcelles issues du fichier initial.'
          : ` ; ${restants} anomalie(s) rédhibitoire(s) restent à corriger par le fournisseur.`),
    }))
    await charger() // le fichier corrigé (avec sa note) apparaît dans la liste
  }

  /** Message prêt à envoyer au fournisseur, listant ce qui doit être corrigé. */
  function demandeRevision(doc: Doc, tri: Tri): string {
    const bloquants = tri.constats.filter(c => c.gravite === 'bloquant')
    const alertes = tri.constats.filter(c => c.gravite === 'alerte')
    const ligne = (c: Constat) =>
      `- ${c.libelle}${c.parcelles.length ? ` (parcelles ${c.parcelles.map(i => i + 1).join(', ')})` : ''}`
    return [
      `Objet : fichier de géolocalisation « ${doc.name} » — corrections demandées`,
      '',
      `Le contrôle automatique du fichier a relevé ${bloquants.length} anomalie(s) rédhibitoire(s)`,
      `sur ${tri.nb_parcelles} parcelle(s). Le dossier ne peut pas être instruit en l'état.`,
      '',
      ...(bloquants.length ? ['À corriger impérativement :', ...bloquants.map(ligne), ''] : []),
      ...(alertes.length ? ['À vérifier ou justifier :', ...alertes.map(ligne), ''] : []),
      'Merci de nous retourner un fichier corrigé. Les coordonnées doivent comporter',
      'au moins six décimales, et les parcelles de plus de 4 hectares être décrites',
      'par un polygone fermé.',
    ].join('\n')
  }

  if (chargement) return <p className="text-sm text-gray-500 dark:text-slate-400 py-6">Chargement…</p>

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900 dark:text-slate-100">Tri automatique des géodonnées</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Quatorze contrôles de qualité documentaire, exécutés avant d’engager une expertise externe.
          Un fichier sans constat bloquant est exploitable — <strong>il n’est pas conforme pour autant</strong> :
          la preuve d’absence de déforestation relève du prestataire spécialisé.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {!docs.length && (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-4">Aucun fichier de géolocalisation déposé.</p>
      )}

      <div className="space-y-2">
        {lignes.map(({ doc, corrigee, origine, corrige: docCorrige }) => {
          const tri = tris[doc.id]
          // Cas dangereux : la version corrigée existe, mais c'est l'original qui
          // porte le périmètre courant. La déclaration reposerait alors sur les
          // géométries que la correction a précisément écartées.
          const originalAuReferentiel = !corrigee && !!docCorrige
            && auReferentiel.has(doc.id) && !auReferentiel.has(docCorrige.id)
          return (
            <div key={doc.id}
              className={`border rounded-xl p-4 ${corrigee
                ? 'ml-6 border-l-4 border-l-amber-400 dark:border-l-amber-500/60 border-gray-200 dark:border-slate-700 bg-amber-50/40 dark:bg-amber-900/10'
                : 'border-gray-200 dark:border-slate-700'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                    {corrigee ? '🛠️' : '📄'} {doc.name}
                    {auReferentiel.has(doc.id) && (
                      <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        title="Les parcelles de ce fichier sont dans le périmètre courant du référentiel.">
                        au référentiel
                      </span>
                    )}
                  </p>
                  {corrigee && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      ↳ Version corrigée de « {origine?.name ?? 'fichier initial introuvable'} »
                    </p>
                  )}
                  {!corrigee && docCorrige && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Une version corrigée de ce fichier existe : « {docCorrige.name} ».
                    </p>
                  )}
                  {tri ? (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Trié le {new Date(tri.analyzed_at).toLocaleString('fr-FR')}
                      {tri.analyzed_by ? ` · ${tri.analyzed_by}` : ''}
                      {' · '}{tri.nb_parcelles} parcelle(s) · {tri.surface_ha} ha
                      {tri.pays_declare ? ` · ${tri.pays_declare}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Jamais trié</p>
                  )}
                  {verse[doc.id] && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">{verse[doc.id]}</p>
                  )}
                  {/* Le référentiel n'est pas la déclaration : si la géométrie
                      retenue change, ce qui a déjà été transmis ne correspond plus. */}
                  {rappel[doc.id] && (
                    <div className="mt-1.5 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5">
                      <p className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        À faire suite à ce versement
                      </p>
                      <p className="text-[11px] text-blue-900/90 dark:text-blue-200/90 mt-0.5">{rappel[doc.id]}</p>
                    </div>
                  )}
                  {originalAuReferentiel && (
                    <div className="mt-1.5 rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5">
                      <p className="text-[11px] font-semibold text-red-800 dark:text-red-300">
                        ⚠️ Le référentiel porte le fichier initial alors qu’une version corrigée existe
                      </p>
                      <p className="text-[11px] text-red-800/90 dark:text-red-200/90 mt-0.5">
                        Les parcelles au périmètre courant viennent des géométries que la correction a écartées.
                        Versez « {docCorrige?.name} » : le versement retire alors du périmètre courant les parcelles
                        issues de ce fichier-ci.
                      </p>
                    </div>
                  )}
                  {corrige[doc.id] && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">✅ {corrige[doc.id]}</p>
                  )}
                  {(() => {
                    const n = tri?.constats.find(c => c.code === 'CORRECTION_SYSTEME')
                    return n ? (
                      <div className="mt-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5">
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">🛠️ {n.libelle}</p>
                        {n.detail && <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 whitespace-pre-wrap mt-0.5">{n.detail}</p>}
                      </div>
                    ) : null
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {tri && (
                    <span className={`text-xs px-2 py-1 rounded-full ${tri.exploitable
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {tri.exploitable
                        ? `Exploitable${tri.nb_alertes ? ` · ${tri.nb_alertes} alerte(s)` : ''}`
                        : `${tri.nb_bloquants} anomalie(s) rédhibitoire(s)`}
                    </span>
                  )}
                  {tri && (
                    <button className="text-xs text-gray-500 hover:underline"
                      onClick={() => setOuvert(ouvert === doc.id ? null : doc.id)}>
                      {ouvert === doc.id ? 'Masquer' : 'Détail'}
                    </button>
                  )}
                  {canWrite && tri && aReparable(tri) && (
                    <button
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-400 dark:border-amber-500/60 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                      onClick={() => corriger(doc)} disabled={occupe === doc.id}
                      title="Corrige automatiquement les erreurs de géométrie réparables (trous, contour non refermé, auto-intersection, sommets dupliqués) et dépose une version corrigée, accompagnée d’une note indiquant ce qui a été modifié et pourquoi. Le fichier d’origine est conservé.">
                      {occupe === doc.id ? 'Correction…' : '🛠️ Corriger le fichier'}
                    </button>
                  )}
                  {canWrite && tri?.exploitable && (
                    <button
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
                      onClick={() => verser(doc)} disabled={occupe === doc.id}
                      title={corrigee || docCorrige
                        ? 'Enregistre les parcelles au référentiel. Les parcelles issues de l’autre version du même fichier sont retirées du périmètre courant : les deux versions décrivent les mêmes terres et ne doivent jamais y figurer ensemble.'
                        : 'Enregistre les parcelles au référentiel : identité stable, surfaces, détection des contours déclarés deux fois'}>
                      {corrigee ? 'Verser la version corrigée' : 'Verser au référentiel'}
                    </button>
                  )}
                  {/* Sans cette mention, l'absence du bouton laisse croire que les
                      parcelles ont disparu : elles ne sont simplement jamais entrées
                      au référentiel, un fichier rédhibitoire devant repartir en
                      révision plutôt que d'y figurer comme valide. */}
                  {canWrite && tri && !tri.exploitable && (
                    <span
                      className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400"
                      title="Le référentiel ne reçoit que des fichiers exploitables. Corrigez le fichier, ou faites-le corriger par le fournisseur, puis rejouez le tri.">
                      Versement au référentiel bloqué — anomalie rédhibitoire
                    </span>
                  )}
                  {canWrite && (
                    <button
                      className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                      onClick={() => trier(doc)} disabled={occupe === doc.id}>
                      {occupe === doc.id ? 'Tri…' : tri ? 'Rejouer le tri' : 'Trier'}
                    </button>
                  )}
                </div>
              </div>

              {tri && ouvert === doc.id && (
                <div className="mt-3 space-y-3">
                  {!tri.constats.length && (
                    <p className="text-sm text-green-700 dark:text-green-400">
                      ✓ Aucun constat. Le fichier peut partir en expertise.
                    </p>
                  )}
                  {tri.constats.filter(c => c.code !== 'CORRECTION_SYSTEME').map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${PASTILLE[c.gravite]}`}>
                        {c.gravite}
                      </span>
                      <div className="min-w-0">
                        <p className="text-gray-800 dark:text-slate-200">{c.libelle}</p>
                        {!!c.parcelles.length && (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Parcelles {c.parcelles.map(p => p + 1).join(', ')}
                          </p>
                        )}
                        {c.detail && <p className="text-xs text-gray-400 dark:text-slate-500">{c.detail}</p>}
                      </div>
                    </div>
                  ))}

                  {!tri.exploitable && (
                    <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                      <button
                        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={() => navigator.clipboard?.writeText(demandeRevision(doc, tri))}>
                        📋 Copier la demande de révision au fournisseur
                      </button>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        Message listant les corrections attendues, à coller dans votre courriel.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
