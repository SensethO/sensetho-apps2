'use client'

// Panneau « Notes & documents » de l’app « Plan Stratégique » (projet-rse).
//
// Règle universelle RSE : tout item porteur d’avancement (cadrage, jalon,
// risque…) offre un panneau de notes riches (sections Tiptap) et de pièces
// jointes SharePoint. Ce wrapper charge la note de l’item, la donne au
// panneau réutilisable GuidedActionNotePanel et sauvegarde le commentaire
// court en débouncé. Les fichiers vont directement du navigateur vers
// SharePoint — jamais par Vercel ni Supabase.

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'

const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-2 text-xs text-gray-400 animate-pulse">Chargement de l’éditeur…</div>,
})

export default function ProjetRseNotesPanel({ projetId, actionKey, readOnly }: {
  projetId: string
  /** Clé libre de l’item : 'cadrage', 'jalon_<id>', 'risque_<id>'… */
  actionKey: string
  readOnly: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [charge, setCharge] = useState(false)
  const [note, setNote] = useState('')
  const [sections, setSections] = useState<NoteSection[]>([])
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let annule = false
    fetch(`/api/projet-rse/projets/${projetId}/notes?action_key=${encodeURIComponent(actionKey)}`)
      .then(r => r.json())
      .then((j: { data?: { sections?: Record<string, NoteSection[]>; notes?: Record<string, string> } }) => {
        if (annule) return
        setNote(j.data?.notes?.[actionKey] ?? '')
        setSections(j.data?.sections?.[actionKey] ?? [])
        setCharge(true)
      })
      .catch(() => { if (!annule) setCharge(true) })
    return () => { annule = true }
  }, [projetId, actionKey])

  // Sauvegarde débouncée du commentaire court (les sections sont sauvées
  // par le panneau lui-même).
  const changerNote = (v: string) => {
    setNote(v)
    if (readOnly) return
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(() => {
      void fetch(`/api/projet-rse/projets/${projetId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: actionKey, content: v }),
      })
    }, 800)
  }

  const nbPieces = sections.reduce(
    (n, s) => n + (s.attachments?.filter(a => !a.deleted_at).length ?? 0), 0)
  const aContenu = !!note || sections.some(s => s.title || s.content || (s.attachments?.length ?? 0) > 0)

  return (
    <div>
      <button type="button" onClick={() => setOuvert(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {ouvert ? '▾' : '▸'} 📝 Notes &amp; documents
        {charge && aContenu && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-800/60 text-indigo-600 dark:text-indigo-300">
            {nbPieces > 0 ? `📎 ${nbPieces}` : '●'}
          </span>
        )}
      </button>

      {ouvert && (
        charge ? (
          <GuidedActionNotePanel
            diagnosticId={projetId}
            actionKey={actionKey}
            apiBase="/api/projet-rse/projets"
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
