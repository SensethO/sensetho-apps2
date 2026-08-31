'use client'

// Vue « Notes & documents » de l'app Plan Stratégique (projet-rse).
//
// Le panneau de notes vit au pied de chaque élément porteur — c'est le bon
// endroit pour écrire. Ce n'est pas le bon endroit pour retrouver : il faut se
// souvenir de l'élément. Cette vue balaie l'organisation entière et rend les
// pièces jointes cherchables par projet, par nature d'élément et par nom.
//
// Le téléchargement passe par une URL SharePoint signée obtenue à la demande —
// aucun octet ne traverse Vercel.

import { useCallback, useEffect, useMemo, useState } from 'react'

interface Piece {
  id: string
  nom: string
  item_id: string
  mime: string
  taille: number
  section: string
}

interface Element {
  projet_id: string
  projet_nom: string
  action_key: string
  nature: string
  libelle: string
  note: string
  nb_pieces: number
  pieces: Piece[]
  modifie_le: string
}

const carte = 'rounded-xl border p-4'
const champ = 'w-full rounded-lg border px-3 py-1.5 text-sm bg-transparent'

function poids(o: number) {
  if (!o) return ''
  if (o < 1024) return `${o} o`
  if (o < 1024 * 1024) return `${(o / 1024).toFixed(0)} Ko`
  return `${(o / 1024 / 1024).toFixed(1)} Mo`.replace('.', ',')
}

function icone(mime: string, nom: string) {
  const ext = nom.split('.').pop()?.toLowerCase() ?? ''
  if (mime.includes('pdf') || ext === 'pdf') return '📕'
  if (['docx', 'doc', 'odt'].includes(ext)) return '📘'
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) return '📗'
  if (['pptx', 'ppt', 'odp'].includes(ext)) return '📙'
  if (mime.startsWith('image/')) return '🖼️'
  return '📄'
}

export default function ProjetRseDocumentsView({ organisationId }: { organisationId: string }) {
  const [elements, setElements] = useState<Element[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [filtreProjet, setFiltreProjet] = useState('')
  const [filtreNature, setFiltreNature] = useState('')
  const [piecesSeules, setPiecesSeules] = useState(true)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setCharge(false)
    try {
      const r = await fetch(`/api/projet-rse/documents?organisation_id=${organisationId}`)
      const j = await r.json() as { elements?: Element[]; error?: string }
      if (!r.ok) throw new Error(j.error ?? 'Chargement impossible')
      setElements(j.elements ?? [])
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setCharge(true)
    }
  }, [organisationId])

  useEffect(() => { void charger() }, [charger])

  const projets = useMemo(
    () => Array.from(new Set(elements.map(e => e.projet_nom))).sort(), [elements])
  const natures = useMemo(
    () => Array.from(new Set(elements.map(e => e.nature))).sort(), [elements])

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return elements.filter(e => {
      if (piecesSeules && e.nb_pieces === 0) return false
      if (filtreProjet && e.projet_nom !== filtreProjet) return false
      if (filtreNature && e.nature !== filtreNature) return false
      if (!q) return true
      return (e.libelle + ' ' + e.projet_nom + ' ' + e.note + ' '
        + e.pieces.map(p => p.nom).join(' ')).toLowerCase().includes(q)
    })
  }, [elements, recherche, filtreProjet, filtreNature, piecesSeules])

  const totalPieces = useMemo(
    () => elements.reduce((n, e) => n + e.nb_pieces, 0), [elements])
  const piecesVisibles = useMemo(
    () => visibles.reduce((n, e) => n + e.nb_pieces, 0), [visibles])

  /** Ouvre le fichier par une URL SharePoint signée, obtenue à la demande. */
  const ouvrir = async (projetId: string, piece: Piece) => {
    setEnCours(piece.id)
    try {
      const r = await fetch(
        `/api/projet-rse/projets/${projetId}/notes/signed-url?item_id=${encodeURIComponent(piece.item_id)}`)
      const j = await r.json() as { url?: string; error?: string }
      if (!r.ok || !j.url) throw new Error(j.error ?? 'Fichier introuvable dans SharePoint')
      window.open(j.url, '_blank', 'noopener')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnCours(null)
    }
  }

  if (!charge && !elements.length) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement des documents…</p>
  }

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className={carte} style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
          Où sont les fichiers du programme
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Chaque note et chaque pièce jointe est attachée à l&apos;élément qu&apos;elle documente — une
          fiche de cadrage, un jalon, un risque. C&apos;est le bon endroit pour écrire, et le mauvais
          pour retrouver. Cette vue les rassemble. Les fichiers vivent dans SharePoint : ils s&apos;ouvrent
          par une adresse signée, sans passer par l&apos;application.
        </p>
        <p className="mt-2 text-sm">
          <strong>{totalPieces}</strong> pièce{totalPieces > 1 ? 's' : ''} jointe{totalPieces > 1 ? 's' : ''}
          {' · '}
          <strong>{elements.filter(e => e.nb_pieces > 0 || e.note).length}</strong> élément
          {elements.filter(e => e.nb_pieces > 0 || e.note).length > 1 ? 's' : ''} documenté
          {elements.filter(e => e.nb_pieces > 0 || e.note).length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={champ} style={{ borderColor: 'var(--border)' }}
            placeholder="Rechercher un fichier, un élément, un mot de la note…"
            value={recherche} onChange={e => setRecherche(e.target.value)} />
          <select className={champ} style={{ borderColor: 'var(--border)' }}
            value={filtreProjet} onChange={e => setFiltreProjet(e.target.value)}>
            <option value="">— tous les projets —</option>
            {projets.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={champ} style={{ borderColor: 'var(--border)' }}
            value={filtreNature} onChange={e => setFiltreNature(e.target.value)}>
            <option value="">— toutes les natures —</option>
            {natures.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" className="accent-indigo-600"
              checked={piecesSeules} onChange={e => setPiecesSeules(e.target.checked)} />
            N&apos;afficher que les éléments portant une pièce jointe
          </label>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {visibles.length} élément{visibles.length > 1 ? 's' : ''} · {piecesVisibles} pièce
            {piecesVisibles > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {!visibles.length && charge && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          {totalPieces === 0
            ? "Aucune pièce jointe pour l'instant. Les documents s'ajoutent depuis le panneau « Notes & documents » au pied de chaque élément — fiche de cadrage, jalon, risque."
            : 'Aucun élément ne correspond à ces filtres.'}
        </div>
      )}

      <div className="space-y-2">
        {visibles.map(e => (
          <div key={e.projet_id + e.action_key} className="rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{e.libelle}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300">
                    {e.nature}
                  </span>
                  {' · '}{e.projet_nom}
                </div>
              </div>
              {e.nb_pieces > 0 && (
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  📎 {e.nb_pieces}
                </span>
              )}
            </div>

            {e.note && (
              <p className="mt-2 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                {e.note.length > 220 ? e.note.slice(0, 220) + '…' : e.note}
              </p>
            )}

            {e.pieces.length > 0 && (
              <ul className="mt-2 space-y-1">
                {e.pieces.map(p => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{icone(p.mime, p.nom)}</span>
                    <button type="button" onClick={() => ouvrir(e.projet_id, p)}
                      disabled={enCours === p.id}
                      className="text-left text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 truncate">
                      {p.nom}
                    </button>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-subtle)' }}>
                      {poids(p.taille)}{p.section ? ` · ${p.section}` : ''}
                      {enCours === p.id ? ' · ouverture…' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
