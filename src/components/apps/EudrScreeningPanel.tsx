'use client'

import { useCallback, useEffect, useState } from 'react'


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
interface Doc { id: string; name: string; created_at: string }

const PASTILLE: Record<Gravite, string> = {
  bloquant: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  alerte: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  information: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function EudrScreeningPanel({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [tris, setTris] = useState<Record<string, Tri>>({})
  const [chargement, setChargement] = useState(true)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    const res = await fetch(`/api/eudr-fournisseurs/screening?org_id=${orgId}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErreur(j.error ?? `Erreur ${res.status}`); setChargement(false); return }
    setDocs(j.documents ?? [])
    setTris(Object.fromEntries((j.tris ?? []).map((t: Tri) => [t.attachment_id, t])))
    setChargement(false)
  }, [orgId])

  useEffect(() => { void charger() }, [charger])

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
        {docs.map(doc => {
          const tri = tris[doc.id]
          return (
            <div key={doc.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-slate-100 truncate">📄 {doc.name}</p>
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
                  {tri.constats.map((c, i) => (
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
