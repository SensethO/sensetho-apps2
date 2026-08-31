'use client'

// Panneau « Notes & documents » des niveaux autres que le projet.
//
// Jumeau de ProjetRseNotesPanel, à une adresse près : la cible s'écrit
// « programme:<uuid> » et les routes vivent sous /api/projet-rse/niveaux.
// L'éditeur partagé, lui, est le même — il ne sait pas ce qu'il documente,
// et c'est ce qui permet de l'employer partout.

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'

const GuidedActionNotePanel = dynamic(
  () => import('@/components/apps/GuidedActionNotePanel'),
  { ssr: false,
    loading: () => (
      <div className="py-2 text-xs text-gray-400 animate-pulse">Chargement de l’éditeur…</div>
    ) },
)

export type NiveauNote = 'organisation' | 'portefeuille' | 'programme'
                       | 'sous_programme' | 'acteur'

export default function ProjetRseNotesNiveauPanel({
  niveau, cibleId, actionKey = 'dossier', readOnly, libelle,
}: {
  niveau: NiveauNote
  cibleId: string
  /** Clé de l'élément documenté. Un seul dossier par défaut. */
  actionKey?: string
  readOnly: boolean
  /** Mention facultative, pour dire ce que le panneau documente. */
  libelle?: string
}) {
  const cible = `${niveau}:${cibleId}`
  const [ouvert, setOuvert] = useState(false)
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [sections, setSections] = useState<NoteSection[]>([])
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let annule = false
    fetch(`/api/projet-rse/niveaux/${cible}/notes?action_key=${encodeURIComponent(actionKey)}`)
      .then(async r => {
        const j = await r.json() as {
          data?: { sections?: Record<string, NoteSection[]>; notes?: Record<string, string> }
          error?: string }
        if (annule) return
        // La migration multi-niveaux peut ne pas être passée : on le dit.
        if (!r.ok) setErreur(j.error ?? 'Chargement impossible')
        else {
          setNote(j.data?.notes?.[actionKey] ?? '')
          setSections(j.data?.sections?.[actionKey] ?? [])
        }
        setCharge(true)
      })
      .catch(() => { if (!annule) setCharge(true) })
    return () => { annule = true }
  }, [cible, actionKey])

  const changerNote = (v: string) => {
    setNote(v)
    if (readOnly) return
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => {
      void fetch(`/api/projet-rse/niveaux/${cible}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: actionKey, content: v }),
      })
    }, 800)
  }

  const nbPieces = sections.reduce(
    (n, s) => n + (s.attachments?.filter(a => !a.deleted_at).length ?? 0), 0)
  const aContenu = !!note
    || sections.some(s => s.title || s.content || (s.attachments?.length ?? 0) > 0)

  return (
    <div>
      <button type="button" onClick={() => setOuvert(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {ouvert ? '▾' : '▸'} 📝 Notes &amp; documents{libelle ? ` — ${libelle}` : ''}
        {charge && aContenu && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-800/60 text-indigo-600 dark:text-indigo-300">
            {nbPieces > 0 ? `📎 ${nbPieces}` : '●'}
          </span>
        )}
      </button>

      {ouvert && (
        erreur ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{erreur}</p>
        ) : charge ? (
          <GuidedActionNotePanel
            diagnosticId={cible}
            actionKey={actionKey}
            apiBase="/api/projet-rse/niveaux"
            noteTable="projet_rse_notes"
            readOnly={readOnly}
            note={note}
            onNoteChange={changerNote}
            initialSections={sections}
            onSectionsChange={setSections}
          />
        ) : (
          <div className="py-2 text-xs text-gray-400 animate-pulse">Chargement des notes…</div>
        )
      )}
    </div>
  )
}
