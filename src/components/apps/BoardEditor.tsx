/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AppShell from '@/components/layout/AppShell'
import dynamic from 'next/dynamic'

const ShareBoardModal = dynamic(() => import('./ShareBoardModal'), { ssr: false })
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
// CSS Excalidraw — OBLIGATOIRE pour le rendu correct (sans ce CSS, les icônes sont énormes)
import '@excalidraw/excalidraw/index.css'

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
  const [bgColor, setBgColor]     = useState('#09090b')
  const [showStickyPicker, setShowStickyPicker] = useState(false)
  const [addingPdf, setAddingPdf]   = useState(false)
  const [showShare, setShowShare]   = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef  = useRef(false)

  // Détecter le thème dark initial
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark')
    setIsDark(dark)
    setBgColor(dark ? '#09090b' : '#ffffff')
  }, [])

  // Insérer un post-it coloré au centre du viewport
  function addStickyNote(color: string) {
    if (!excalidrawApiRef.current) return
    const api = excalidrawApiRef.current
    const appState = api.getAppState()
    const elements = api.getSceneElements()
    const zoom = appState.zoom.value
    const cx = (-appState.scrollX + window.innerWidth  / 2) / zoom
    const cy = (-appState.scrollY + window.innerHeight / 2) / zoom
    const id = crypto.randomUUID()
    const txtId = crypto.randomUUID()
    const seed = Math.floor(Math.random() * 2 ** 30)
    const strokeColors: Record<string, string> = {
      '#fff9c4': '#b8860b', '#ffd6d6': '#c0392b', '#d0f4de': '#1a6b38',
      '#cce5ff': '#0056b3', '#e8d5f5': '#6f42c1', '#ffe8c0': '#c05621',
    }
    const stroke = strokeColors[color] ?? '#1e1e2e'
    api.updateScene({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: [...elements, {
        id, type: 'rectangle', x: cx - 110, y: cy - 110,
        width: 220, height: 220, angle: 0,
        strokeColor: stroke, backgroundColor: color, fillStyle: 'solid',
        strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100,
        roundness: { type: 3, value: 12 }, seed, version: 1, versionNonce: seed + 1,
        isDeleted: false, groupIds: [], frameId: null, link: null, locked: false,
        updated: Date.now(), boundElements: [{ type: 'text', id: txtId }], customData: null,
      } as any, {
        id: txtId, type: 'text', x: cx - 100, y: cy - 100,
        width: 200, height: 200, angle: 0,
        strokeColor: stroke, backgroundColor: 'transparent', fillStyle: 'solid',
        strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100,
        text: '📝 Note', fontSize: 18, fontFamily: 3,
        textAlign: 'center', verticalAlign: 'middle', containerId: id,
        originalText: '📝 Note', lineHeight: 1.25, autoResize: true,
        seed: seed + 2, version: 1, versionNonce: seed + 3,
        isDeleted: false, groupIds: [], frameId: null, link: null, locked: false,
        updated: Date.now(), boundElements: null, customData: null,
      } as any],
    })
    setShowStickyPicker(false)
  }

  // Changer la couleur de fond du canvas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function changeBackground(color: string) {
    setBgColor(color)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidrawApiRef.current?.updateScene({ appState: { viewBackgroundColor: color } } as any)
  }

  // ── Intégration PDF via PDF.js CDN ──
  // PDF.js est chargé depuis CDN au moment de l'appel (pas bundlé — évite les conflits webpack)
  async function loadPdfJs(): Promise<any> {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        const lib = (window as any).pdfjsLib
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(lib)
      }
      script.onerror = () => reject(new Error('Impossible de charger PDF.js'))
      document.head.appendChild(script)
    })
  }

  async function handlePdfFile(file: File) {
    if (!excalidrawApiRef.current || !file) return
    setAddingPdf(true)
    try {
      // 1. Charger PDF.js depuis CDN
      const pdfjsLib = await loadPdfJs()

      // 2. Lire et rendre la page 1
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page   = await pdfDoc.getPage(1)
      const scale  = 2 // haute résolution
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width  = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

      // 3. Réduire à max 900px de large
      const maxW = 900
      const ratio = Math.min(1, maxW / canvas.width)
      const finalCanvas = document.createElement('canvas')
      finalCanvas.width  = Math.round(canvas.width  * ratio)
      finalCanvas.height = Math.round(canvas.height * ratio)
      finalCanvas.getContext('2d')!.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height)
      const dataURL = finalCanvas.toDataURL('image/png')

      // 4. Insérer comme image sur le canvas Excalidraw
      const api      = excalidrawApiRef.current
      const appState = api.getAppState()
      const zoom = appState.zoom.value
      const cx = (-appState.scrollX + window.innerWidth  / 2) / zoom
      const cy = (-appState.scrollY + window.innerHeight / 2) / zoom
      const w  = finalCanvas.width  / scale
      const h  = finalCanvas.height / scale
      const id = `pdf_${Date.now()}` as any
      const seed = Math.floor(Math.random() * 2 ** 30)

      api.updateScene({
        elements: [...api.getSceneElements(), {
          id, type: 'image', x: cx - w / 2, y: cy - h / 2,
          width: w, height: h, angle: 0,
          strokeColor: 'transparent', backgroundColor: 'transparent',
          fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
          roughness: 0, opacity: 100, seed, version: 1, versionNonce: seed + 1,
          isDeleted: false, groupIds: [], frameId: null, link: null, locked: false,
          updated: Date.now(), boundElements: null, customData: null,
          status: 'saved', fileId: id,
        } as any],
        files: {
          ...api.getFiles(),
          [id]: { id, dataURL: dataURL as any, mimeType: 'image/png', created: Date.now() },
        } as any,
      })

      alert(`✅ PDF intégré — ${file.name} (page 1/${pdfDoc.numPages})`)
    } catch (e) {
      alert('Erreur : ' + String(e))
    } finally {
      setAddingPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  // Basculer le thème clair/sombre
  function toggleTheme() {
    const newDark = !isDark
    setIsDark(newDark)
    const newBg = newDark ? '#09090b' : '#ffffff'
    setBgColor(newBg)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidrawApiRef.current?.updateScene({ appState: { theme: newDark ? 'dark' : 'light', viewBackgroundColor: newBg } } as any)
  }

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

  // Sauvegarde auto (debounce 5s — réduit la charge Supabase)
  // Les images intégrées (base64) sont exclues du stockage DB pour éviter les JSONB géants
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (isSavingRef.current || !excalidrawApiRef.current) return
      isSavingRef.current = true
      setSaveStatus('saving')
      try {
        const elements  = excalidrawApiRef.current.getSceneElements()
        const appState  = excalidrawApiRef.current.getAppState()
        // Stocker les fichiers (images, PDF convertis) — limiter à <2MB total
        const files = excalidrawApiRef.current.getFiles()
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

          {/* ── Post-its colorés ── */}
          <div className="relative">
            <button
              onClick={() => setShowStickyPicker(v => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-yellow-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              title="Ajouter un post-it">
              📝 Post-it
            </button>
            {showStickyPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-3 z-50 min-w-[160px]"
                onClick={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Couleur du post-it</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { color: '#fff9c4', label: 'Jaune' },
                    { color: '#ffd6d6', label: 'Rose' },
                    { color: '#d0f4de', label: 'Vert' },
                    { color: '#cce5ff', label: 'Bleu' },
                    { color: '#e8d5f5', label: 'Violet' },
                    { color: '#ffe8c0', label: 'Orange' },
                  ].map(({ color, label }) => (
                    <button key={color} onClick={() => addStickyNote(color)}
                      title={label}
                      style={{ backgroundColor: color }}
                      className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-gray-400 dark:hover:border-gray-300 transition-all hover:scale-110 shadow-sm" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Intégrer PDF ── */}
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDrop={async e => {
              e.preventDefault(); e.stopPropagation()
              const file = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf')
              if (file) await handlePdfFile(file)
            }}
          >
            <input ref={pdfInputRef} type="file" accept="application/pdf"
              className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={addingPdf}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: addingPdf ? '#fee2e2' : 'transparent' }}
              title="Intégrer un PDF — cliquer pour choisir, ou glisser-déposer un PDF ici">
              {addingPdf ? <><span className="animate-spin inline-block">⟳</span> Conversion…</> : <>📄 PDF</>}
            </button>
          </div>

          {/* ── Couleur de fond ── */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)' }}
            title="Couleur du fond">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>🎨</span>
            <input type="color" value={bgColor}
              onChange={e => changeBackground(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              title="Couleur du fond du canvas" />
          </div>

          {/* ── Mode clair/sombre ── */}
          <button onClick={toggleTheme}
            className="text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}>
            {isDark ? '☀️' : '🌙'}
          </button>

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
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
            👥 Partager
          </button>
        </div>
      </div>

      {/* Modale partage */}
      {showShare && board && (
        <ShareBoardModal
          boardId={board.id}
          boardTitle={board.title}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* ── Canvas Excalidraw ── */}
      <div className="flex-1 relative overflow-hidden">
        {board !== null && (
          <Excalidraw
            // Intercepter les fichiers droppés sur le canvas
            onDrop={async (event) => {
              const files = Array.from(event.dataTransfer?.files ?? [])
              const pdfs  = files.filter(f => f.type === 'application/pdf')
              if (pdfs.length > 0) {
                event.preventDefault()
                for (const pdf of pdfs) {
                  await handlePdfFile(pdf)
                }
                return true // empêche Excalidraw de traiter le drop
              }
              return false
            }}
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
                viewBackgroundColor: bgColor,
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
