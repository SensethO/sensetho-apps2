'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import AppShell from '@/components/layout/AppShell'

interface BoardData {
  id: string
  title: string
  description: string | null
  document: unknown
}

export default function BoardEditor({ boardId }: { boardId: string }) {
  const router  = useRouter()
  const [board, setBoard]     = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [title, setTitle]     = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const editorRef  = useRef<Editor | null>(null)
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  // Charger le board
  useEffect(() => {
    fetch(`/api/boards/${boardId}`)
      .then(r => r.json())
      .then(({ data, error: e }) => {
        if (e || !data) { setError(e ?? 'Board non trouvé'); return }
        setBoard(data)
        setTitle(data.title)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [boardId])

  // Sauvegarde auto (debounce 2s)
  const scheduleSave = useCallback(async (editor: Editor) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      setSaveStatus('saving')
      try {
        const document = editor.store.getSnapshot()
        await fetch(`/api/boards/${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document }),
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    }, 2000)
  }, [boardId])

  // Sauvegarder le titre
  async function saveTitle(newTitle: string) {
    if (!newTitle.trim() || newTitle === board?.title) { setEditingTitle(false); return }
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    setBoard(prev => prev ? { ...prev, title: newTitle.trim() } : null)
    setEditingTitle(false)
  }

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor

    // Charger le document existant s'il y en a un
    if (board?.document) {
      try {
        editor.store.loadSnapshot(board.document as Parameters<typeof editor.store.loadSnapshot>[0])
      } catch (e) {
        console.warn('Impossible de charger le document:', e)
      }
    }

    // Écouter les changements → sauvegarde auto
    editor.store.listen(() => {
      scheduleSave(editor)
    }, { source: 'user' })
  }, [board, scheduleSave])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">Chargement du tableau…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="text-5xl">😕</div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Tableau introuvable</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
            <button onClick={() => router.push('/business/board')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">
              ← Retour aux tableaux
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b z-10 flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/business/board')}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            ← Tableaux
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>

          {/* Titre éditable */}
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => saveTitle(title)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(title); if (e.key === 'Escape') { setTitle(board?.title ?? ''); setEditingTitle(false) } }}
              className="text-sm font-semibold px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', minWidth: 200 }}
            />
          ) : (
            <button onClick={() => setEditingTitle(true)}
              className="text-sm font-semibold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              style={{ color: 'var(--text)' }} title="Cliquer pour renommer">
              {board?.title ?? 'Sans titre'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Statut de sauvegarde */}
          <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            {saveStatus === 'saving' && <><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> Sauvegarde…</>}
            {saveStatus === 'saved'  && <><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Sauvegardé</>}
            {saveStatus === 'error'  && <><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Erreur</>}
            {saveStatus === 'idle'   && <><span className="inline-block w-2 h-2 rounded-full bg-gray-400" /> Synchronisé</>}
          </div>

          {/* Bouton partager */}
          <button
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Partager (bientôt disponible)"
          >
            👥 Partager
          </button>

          {/* Exporter image */}
          <button
            onClick={async () => {
              if (!editorRef.current) return
              const blob = await editorRef.current.toImage([...editorRef.current.getCurrentPageShapes()], { type: 'png', quality: 1, scale: 2, background: true })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `${board?.title ?? 'tableau'}.png`; a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            ⬇️ Exporter
          </button>
        </div>
      </div>

      {/* Canvas tldraw — plein écran */}
      <div className="flex-1 relative overflow-hidden">
        <Tldraw
          onMount={handleMount}
          persistenceKey={`board-${boardId}`}
          autoFocus
        />
      </div>
    </div>
  )
}
