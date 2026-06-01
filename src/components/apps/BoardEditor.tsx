'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

// Excalidraw doit être chargé côté client uniquement (pas de SSR)
const Excalidraw = dynamic(
  async () => {
    const { Excalidraw } = await import('@excalidraw/excalidraw')
    return Excalidraw
  },
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )}
)

interface BoardData {
  id: string
  title: string
  description: string | null
  document: {
    elements?: ExcalidrawElement[]
    appState?: Partial<AppState>
    files?: BinaryFiles
  } | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function BoardEditor({ boardId }: { boardId: string }) {
  const router  = useRouter()
  const [board, setBoard]         = useState<BoardData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [title, setTitle]         = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [isDark, setIsDark]       = useState(false)
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef  = useRef(false)

  // Détecter le thème dark
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Charger le board depuis l'API
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
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (isSavingRef.current || !excalidrawApiRef.current) return
      isSavingRef.current = true
      setSaveStatus('saving')
      try {
        const elements  = excalidrawApiRef.current.getSceneElements()
        const appState  = excalidrawApiRef.current.getAppState()
        const files     = excalidrawApiRef.current.getFiles()
        const document  = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files }
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
    const trimmed = newTitle.trim()
    if (!trimmed || trimmed === board?.title) { setEditingTitle(false); return }
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    setBoard(prev => prev ? { ...prev, title: trimmed } : null)
    setEditingTitle(false)
  }

  // Export PNG
  async function exportPng() {
    if (!excalidrawApiRef.current) return
    try {
      const { exportToCanvas } = await import('@excalidraw/excalidraw')
      const elements = excalidrawApiRef.current.getSceneElements()
      const appState = excalidrawApiRef.current.getAppState()
      const files    = excalidrawApiRef.current.getFiles()
      if (!elements.length) { alert('Le tableau est vide'); return }
      const canvas = await exportToCanvas({ elements, appState: { ...appState, exportBackground: true }, files })
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${board?.title ?? 'tableau'}.png`; a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (e) { alert('Erreur export: ' + String(e)) }
  }

  // Export SVG
  async function exportSvg() {
    if (!excalidrawApiRef.current) return
    try {
      const { exportToSvg } = await import('@excalidraw/excalidraw')
      const elements = excalidrawApiRef.current.getSceneElements()
      const appState = excalidrawApiRef.current.getAppState()
      const files    = excalidrawApiRef.current.getFiles()
      if (!elements.length) { alert('Le tableau est vide'); return }
      const svg = await exportToSvg({ elements, appState: { ...appState, exportBackground: true }, files })
      const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${board?.title ?? 'tableau'}.svg`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export: ' + String(e)) }
  }

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

  // Extraire les données Excalidraw du board — canvas vide si format incompatible
  // (évite le crash quand d'anciens boards avaient un format tldraw)
  const isValidExcalidrawDoc = (() => {
    try {
      const doc = board?.document
      if (!doc || !Array.isArray(doc.elements)) return false
      // Vérifier que les éléments ont bien la structure Excalidraw (id + type string)
      return doc.elements.every((e: unknown) =>
        e !== null && typeof e === 'object' &&
        typeof (e as Record<string, unknown>).id === 'string' &&
        typeof (e as Record<string, unknown>).type === 'string'
      )
    } catch { return false }
  })()

  const savedElements = isValidExcalidrawDoc ? (board?.document?.elements ?? []) : []
  const savedAppState = isValidExcalidrawDoc ? (board?.document?.appState ?? {}) : {}
  const savedFiles    = isValidExcalidrawDoc ? (board?.document?.files ?? {}) : {}

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b z-10 flex-shrink-0 gap-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sidebar)' }}>

        {/* Navigation + titre */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/business/board')}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            ← Tableaux
          </button>
          <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">|</span>

          {editingTitle ? (
            <input autoFocus value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => saveTitle(title)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(title); if (e.key === 'Escape') { setTitle(board?.title ?? ''); setEditingTitle(false) } }}
              className="text-sm font-semibold px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', width: 200 }}
            />
          ) : (
            <button onClick={() => setEditingTitle(true)}
              className="text-sm font-semibold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors truncate max-w-[300px]"
              style={{ color: 'var(--text)' }} title="Cliquer pour renommer">
              {board?.title ?? 'Sans titre'}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Statut */}
          <div className="text-[11px] flex items-center gap-1.5 hidden sm:flex" style={{ color: 'var(--text-muted)' }}>
            {saveStatus === 'saving' && <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Sauvegarde…</>}
            {saveStatus === 'saved'  && <><span className="w-2 h-2 rounded-full bg-emerald-500" />Sauvegardé</>}
            {saveStatus === 'error'  && <><span className="w-2 h-2 rounded-full bg-red-500" />Erreur</>}
            {saveStatus === 'idle'   && <><span className="w-2 h-2 rounded-full bg-gray-400" />Synchronisé</>}
          </div>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-indigo-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              ⬇️ Exporter ▾
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 z-50 min-w-[140px] hidden group-hover:block">
              <button onClick={exportPng} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" style={{ color: 'var(--text)' }}>
                🖼️ Image PNG
              </button>
              <button onClick={exportSvg} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" style={{ color: 'var(--text)' }}>
                📐 Vectoriel SVG
              </button>
            </div>
          </div>

          {/* Partager */}
          <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
            👥 Partager
          </button>
        </div>
      </div>

      {/* ── Canvas Excalidraw ── */}
      <div className="flex-1 relative overflow-hidden">
        {board !== null && (
          <Excalidraw
            excalidrawAPI={api => {
              excalidrawApiRef.current = api
              // Forcer la fermeture du panneau bibliothèque après montage
              // (Excalidraw peut le rouvrir depuis localStorage)
              setTimeout(() => {
                try {
                  api.updateScene({
                    appState: { openSidebar: null } as Parameters<typeof api.updateScene>[0]['appState'],
                  })
                } catch { /* ignore */ }
              }, 100)
            }}
            initialData={{
              elements: savedElements,
              appState: {
                ...savedAppState,
                theme: isDark ? 'dark' : 'light',
                openSidebar: null,
                defaultSidebarDockedPreference: false,
              },
              files: savedFiles,
              scrollToContent: true,
            }}
            onChange={() => { scheduleSave() }}
            theme={isDark ? 'dark' : 'light'}
            langCode="fr-FR"
          />
        )}
      </div>
    </div>
  )
}
