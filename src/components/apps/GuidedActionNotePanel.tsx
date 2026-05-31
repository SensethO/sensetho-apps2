'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DOMPurify from 'dompurify'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import FileViewerModal from '@/components/ui/FileViewerModal'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AttachmentMeta {
  id: string
  name: string
  path: string   // sharepoint_item_id
  mime: string
  size: number
  deleted_at?: string | null  // soft-delete
}

export interface NoteSection {
  id: string
  title: string   // Tiptap HTML
  content: string // Tiptap HTML
  attachments: AttachmentMeta[]
}

// Legacy type kept for backward compat with GuidedDiagnostic that was importing it
export interface Attachment {
  id: string
  name: string
  sharepoint_item_id: string
  mime: string | null
  size: number | null
}

// ─── Tiptap extensions ─────────────────────────────────────────────────────────

const EXTENSIONS_TITLE = [
  StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false }),
  TextStyle,
  Color,
  Underline,
]

const EXTENSIONS_CONTENT = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  TextStyle,
  Color,
  Underline,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
]

// ─── Color palette ─────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: 'Défaut', value: '' },
  { label: 'Gris', value: '#6b7280' },
  { label: 'Rouge', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Vert', value: '#16a34a' },
  { label: 'Bleu', value: '#2563eb' },
  { label: 'Violet', value: '#9333ea' },
]

const HIGHLIGHT_COLORS = [
  { label: 'Aucun', value: '' },
  { label: 'Jaune', value: '#fef08a' },
  { label: 'Vert clair', value: '#bbf7d0' },
  { label: 'Bleu clair', value: '#bfdbfe' },
  { label: 'Rose', value: '#fecdd3' },
]

// ─── EditorToolbar ─────────────────────────────────────────────────────────────

function EditorToolbar({
  editor,
  isTitle = false,
}: {
  editor: ReturnType<typeof useEditor> | null
  isTitle?: boolean
}) {
  const [showColors, setShowColors] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)

  if (!editor) return null

  const btn = (active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )

  const sep = () => <span className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {btn(editor.isActive('bold'), 'Gras', () => editor.chain().focus().toggleBold().run(), <strong>G</strong>)}
      {btn(editor.isActive('italic'), 'Italique', () => editor.chain().focus().toggleItalic().run(), <em>I</em>)}
      {btn(editor.isActive('underline'), 'Souligné', () => editor.chain().focus().toggleUnderline().run(), <span className="underline">S</span>)}

      {!isTitle && (
        <>
          {sep()}
          {btn(editor.isActive('heading', { level: 2 }), 'Titre H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
          {btn(editor.isActive('heading', { level: 3 }), 'Titre H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
          {sep()}
          {btn(editor.isActive('bulletList'), 'Liste à puces', () => editor.chain().focus().toggleBulletList().run(), '• —')}
          {btn(editor.isActive('orderedList'), 'Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), '1.')}
          {sep()}
          {btn(editor.isActive({ textAlign: 'left' }), 'Gauche', () => editor.chain().focus().setTextAlign('left').run(), '⫷')}
          {btn(editor.isActive({ textAlign: 'center' }), 'Centre', () => editor.chain().focus().setTextAlign('center').run(), '≡')}
          {btn(editor.isActive({ textAlign: 'right' }), 'Droite', () => editor.chain().focus().setTextAlign('right').run(), '⫸')}
        </>
      )}

      {sep()}

      {/* Text color */}
      <div className="relative">
        <button
          onMouseDown={e => { e.preventDefault(); setShowColors(v => !v); setShowHighlight(false) }}
          title="Couleur du texte"
          className="px-1.5 py-0.5 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-0.5"
        >
          <span style={{ borderBottom: `3px solid ${editor.getAttributes('textStyle').color || '#111'}` }}>A</span>
          <span className="text-gray-400">▾</span>
        </button>
        {showColors && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex flex-wrap gap-1.5 w-32">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value}
                onMouseDown={e => {
                  e.preventDefault()
                  if (c.value) editor.chain().focus().setColor(c.value).run()
                  else editor.chain().focus().unsetColor().run()
                  setShowColors(false)
                }}
                title={c.label}
                className="w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: c.value || '#f3f4f6', color: c.value || '#111' }}
              >
                {!c.value && <span className="text-xs">×</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Highlight (content only) */}
      {!isTitle && (
        <div className="relative">
          <button
            onMouseDown={e => { e.preventDefault(); setShowHighlight(v => !v); setShowColors(false) }}
            title="Surbrillance"
            className="px-1.5 py-0.5 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-0.5"
          >
            <span className="bg-yellow-200 px-0.5 rounded">ab</span>
            <span className="text-gray-400">▾</span>
          </button>
          {showHighlight && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex flex-wrap gap-1.5 w-28">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.value}
                  onMouseDown={e => {
                    e.preventDefault()
                    if (c.value) editor.chain().focus().toggleHighlight({ color: c.value }).run()
                    else editor.chain().focus().unsetHighlight().run()
                    setShowHighlight(false)
                  }}
                  title={c.label}
                  className="w-6 h-6 rounded border-2 border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform flex items-center justify-center text-xs"
                  style={{ backgroundColor: c.value || '#f3f4f6' }}
                >
                  {!c.value && <span className="text-xs text-gray-400">×</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── File size helper ──────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── getSignedUrl ──────────────────────────────────────────────────────────────

async function getSignedUrl(apiBase: string, diagnosticId: string, spItemId: string): Promise<string> {
  const res = await fetch(
    `${apiBase}/${diagnosticId}/notes/signed-url?item_id=${encodeURIComponent(spItemId)}`
  )
  if (!res.ok) throw new Error('Impossible de générer le lien')
  const { url } = await res.json()
  return url
}

// ─── DownloadAllButton ─────────────────────────────────────────────────────────

function DownloadAllButton({
  attachments,
  diagnosticId,
  apiBase,
}: {
  attachments: AttachmentMeta[]
  diagnosticId: string
  apiBase: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(0)

  async function downloadAll() {
    setDownloading(true)
    setDone(0)
    try {
      for (const att of attachments) {
        try {
          const url = await getSignedUrl(apiBase, diagnosticId, att.path)
          const a = document.createElement('a')
          a.href = url
          a.download = att.name
          a.rel = 'noopener'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setDone(d => d + 1)
          await new Promise(r => setTimeout(r, 600))
        } catch {
          // Continuer même si un fichier échoue
        }
      }
    } finally {
      setDownloading(false)
      setDone(0)
    }
  }

  return (
    <button
      onClick={downloadAll}
      disabled={downloading}
      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium transition disabled:opacity-60"
    >
      {downloading
        ? <>⏳ Téléchargement {done}/{attachments.length}…</>
        : <>⬇ Tout télécharger ({attachments.length} fichiers)</>}
    </button>
  )
}

// ─── AttachmentItem ────────────────────────────────────────────────────────────

function AttachmentItem({
  att,
  diagnosticId,
  annexeRef,
  onDelete,
  onRename,
  readOnly,
  apiBase,
}: {
  att: AttachmentMeta
  diagnosticId: string
  annexeRef?: string
  onDelete: () => void
  onRename?: (newName: string) => void
  readOnly: boolean
  apiBase: string
}) {
  const [loading, setLoading] = useState<'open' | 'download' | null>(null)
  const [editing, setEditing]   = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [thumbUrl, setThumbUrl]   = useState<string | null>(null)
  const [pdfThumb, setPdfThumb]   = useState<string | null>(null)
  const [videoUrl, setVideoUrl]         = useState<string | null>(null)
  const [videoOpen, setVideoOpen]       = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)

  const lastDot = att.name.lastIndexOf('.')
  const fullBase = lastDot > 0 ? att.name.slice(0, lastDot) : att.name
  const ext      = lastDot > 0 ? att.name.slice(lastDot) : ''
  const aPrefixMatch = fullBase.match(/^(A\d+_)(.*)$/)
  const aCodePrefix = aPrefixMatch ? aPrefixMatch[1] : ''
  const baseName    = aPrefixMatch ? aPrefixMatch[2] : fullBase

  const [editValue, setEditValue] = useState(baseName)

  const isPdf    = att.mime === 'application/pdf'
  const isImage  = att.mime.startsWith('image/')
  const isVideo  = att.mime.startsWith('video/')
  const isWord   = att.mime.includes('word')
  const isExcel  = att.mime.includes('excel') || att.mime.includes('sheet')

  // Déduit l'app key depuis apiBase (ex: /api/guided-diagnostic → guided-diagnostic)
  const appKey = apiBase.replace('/api/', '').split('/')[0] ?? 'guided-diagnostic'

  // Miniature image
  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    getSignedUrl(apiBase, diagnosticId, att.path)
      .then(url => { if (!cancelled) setThumbUrl(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [att.path, diagnosticId, isImage, apiBase])

  // Miniature PDF via Microsoft Graph thumbnails
  useEffect(() => {
    if (!isPdf) return
    let cancelled = false
    fetch(`/api/sharepoint/thumbnail?item_id=${encodeURIComponent(att.path)}&app=${encodeURIComponent(appKey)}`)
      .then(r => r.json())
      .then((d: { url?: string | null }) => { if (!cancelled && d.url) setPdfThumb(d.url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [att.path, isPdf, appKey])

  async function openViewer() {
    if (isPdf) {
      // Ouvrir via proxy inline pour visualisation dans une iframe
      const proxyUrl = `/api/sharepoint/image?item_id=${encodeURIComponent(att.path)}&app=${encodeURIComponent(appKey)}`
      setViewerUrl(proxyUrl)
      return
    }
    setLoading('open')
    try { setViewerUrl(await getSignedUrl(apiBase, diagnosticId, att.path)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(null) }
  }

  async function openVideoPlayer() {
    if (videoOpen) { setVideoOpen(false); return }
    if (videoUrl) { setVideoOpen(true); return }
    setVideoLoading(true)
    try {
      const url = await getSignedUrl(apiBase, diagnosticId, att.path)
      setVideoUrl(url)
      setVideoOpen(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lecture vidéo')
    } finally {
      setVideoLoading(false)
    }
  }

  async function downloadFile() {
    setLoading('download')
    try {
      const url = await getSignedUrl(apiBase, diagnosticId, att.path)
      const a = document.createElement('a')
      a.href = url; a.download = att.name; a.rel = 'noopener'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(null) }
  }

  function startEdit() { setEditValue(baseName); setEditing(true) }

  async function confirmRename() {
    const trimmed = editValue.trim()
    if (!trimmed) return
    const newName = aCodePrefix + trimmed + ext
    if (newName === att.name) { setEditing(false); return }
    setRenaming(true)
    try {
      const res = await fetch(
        `${apiBase}/${diagnosticId}/notes/attachment?attachment_id=${encodeURIComponent(att.id)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: newName }) }
      )
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert((j as Record<string,string>).error ?? 'Erreur renommage'); return }
      onRename?.(newName); setEditing(false)
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setRenaming(false) }
  }

  // ── Thumbnail Preview ──────────────────────────────────────────────────────
  const thumbContent = isImage && thumbUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
  ) : isPdf && pdfThumb ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={pdfThumb} alt="Aperçu PDF" className="w-full h-full object-contain bg-white p-1" />
  ) : isVideo ? (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <span className="text-3xl">🎬</span>
    </div>
  ) : isPdf ? (
    <div className="w-full h-full bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center gap-1">
      <span className="text-2xl">📄</span>
      <span className="text-[9px] font-bold text-red-600">PDF</span>
    </div>
  ) : isWord ? (
    <div className="w-full h-full bg-blue-50 dark:bg-blue-900/20 flex flex-col items-center justify-center gap-1">
      <span className="text-2xl">📝</span>
      <span className="text-[9px] font-bold text-blue-600">DOC</span>
    </div>
  ) : isExcel ? (
    <div className="w-full h-full bg-green-50 dark:bg-green-900/20 flex flex-col items-center justify-center gap-1">
      <span className="text-2xl">📊</span>
      <span className="text-[9px] font-bold text-green-600">XLS</span>
    </div>
  ) : (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-700 flex flex-col items-center justify-center gap-1">
      <span className="text-2xl">📎</span>
    </div>
  )

  return (
    <>
      {viewerUrl && (
        <FileViewerModal url={viewerUrl} name={att.name} mime={att.mime} onClose={() => setViewerUrl(null)} />
      )}

      <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:shadow-md transition-shadow group">
        {/* Thumbnail zone */}
        <div
          className="relative w-full aspect-[4/3] cursor-pointer overflow-hidden bg-gray-100 dark:bg-gray-900"
          onClick={isVideo ? openVideoPlayer : openViewer}
          title={isVideo ? 'Lire la vidéo' : 'Visualiser'}
        >
          {thumbContent}
          {/* Overlay au hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs bg-black/50 px-2 py-1 rounded-lg">
              {isVideo ? (videoLoading ? '…' : videoOpen ? '⏹ Fermer' : '▶ Lire') : '↗ Voir'}
            </span>
          </div>
          {annexeRef && (
            <span className="absolute top-1 left-1 text-[9px] font-bold bg-cyan-600 text-white px-1.5 py-0.5 rounded">
              {annexeRef}
            </span>
          )}
        </div>

        {/* Video player inline */}
        {isVideo && videoOpen && videoUrl && (
          <div className="border-t border-gray-100 dark:border-gray-700 bg-black">
            <video src={videoUrl} controls autoPlay preload="metadata" className="w-full max-h-48" />
          </div>
        )}

        {/* File info + rename */}
        <div className="px-2 py-1.5 flex-1">
          {editing ? (
            <div className="space-y-1">
              <div className="flex items-center gap-0.5">
                {aCodePrefix && <span className="text-[9px] text-gray-400 shrink-0">{aCodePrefix}</span>}
                <input autoFocus value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditing(false) }}
                  className="flex-1 min-w-0 text-xs bg-transparent border-b border-indigo-400 outline-none text-gray-900 dark:text-white" />
                {ext && <span className="text-[9px] text-gray-400 shrink-0">{ext}</span>}
              </div>
              <div className="flex gap-1 mt-1">
                <button onClick={confirmRename} disabled={renaming || !editValue.trim()}
                  className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white disabled:opacity-50">
                  {renaming ? '…' : '✓'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">{att.name}</p>
              <p className="text-[10px] text-gray-400">{fmtSize(att.size)}</p>
            </div>
          )}
        </div>

        {/* 4 boutons d'action */}
        {!editing && (
          <div className="flex border-t border-gray-100 dark:border-gray-700 divide-x divide-gray-100 dark:divide-gray-700">
            <button onClick={isVideo ? openVideoPlayer : openViewer} disabled={!!loading || videoLoading}
              title={isVideo ? (videoOpen ? 'Fermer' : 'Lire') : 'Visualiser'}
              className="flex-1 py-1.5 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors">
              {loading === 'open' || videoLoading ? '⟳' : isVideo ? (videoOpen ? '⏹' : '▶') : '👁️'}
            </button>
            <button onClick={downloadFile} disabled={!!loading}
              title="Télécharger"
              className="flex-1 py-1.5 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors">
              {loading === 'download' ? '⟳' : '⬇️'}
            </button>
            {!readOnly && onRename && (
              <button onClick={startEdit} title="Renommer"
                className="flex-1 py-1.5 flex items-center justify-center text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm transition-colors">
                ✏️
              </button>
            )}
            {!readOnly && (
              <button onClick={onDelete} title="Supprimer"
                className="flex-1 py-1.5 flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition-colors">
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── SortableSectionWrapper ─────────────────────────────────────────────────────

function SortableSectionWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="relative group/sort">
      {/* Poignée DnD */}
      <div {...attributes} {...listeners}
        className="absolute left-0 top-2 -translate-x-5 hidden group-hover/sort:flex items-center cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 px-0.5 py-1 rounded transition-colors"
        title="Réorganiser">
        ⠿
      </div>
      {children}
    </div>
  )
}

// ─── SectionEditor ─────────────────────────────────────────────────────────────

function SectionEditor({
  section,
  index,
  total,
  diagnosticId,
  actionKey,
  annexeRefs,
  onChange,
  onDelete,
  readOnly,
  apiBase,
}: {
  section: NoteSection
  index: number
  total: number
  diagnosticId: string
  actionKey: string
  annexeRefs: Map<string, string>
  onChange: (updated: NoteSection) => void
  onDelete: () => void
  readOnly: boolean
  apiBase: string
}) {
  const initialized = useRef(false)
  void initialized // suppress unused warning
  const sectionRef = useRef(section)
  sectionRef.current = section

  const titleEditor = useEditor({
    extensions: EXTENSIONS_TITLE,
    content: section.title || '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange({ ...sectionRef.current, title: editor.getHTML() })
    },
  })

  const contentEditor = useEditor({
    extensions: EXTENSIONS_CONTENT,
    content: section.content || '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange({ ...sectionRef.current, content: editor.getHTML() })
    },
  })

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadTab, setUploadTab] = useState<'file' | 'folder'>('file')
  const [showTrash, setShowTrash] = useState(false)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    const fileArr = Array.from(files)
    setUploading(true); setUploadError(null); setUploadProgress(0)
    try {
      for (let fi = 0; fi < fileArr.length; fi++) {
        const file = fileArr[fi]
        const mime = file.type || 'application/octet-stream'
        setUploadProgress(Math.round((fi / fileArr.length) * 80))

        const sessionRes = await fetch(`${apiBase}/${diagnosticId}/notes/upload-session`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, size: file.size, actionKey }),
        })
        const sessionText = await sessionRes.text()
        let sessionJson: Record<string, unknown> = {}
        try { sessionJson = JSON.parse(sessionText) } catch { /* non-JSON */ }
        if (!sessionRes.ok) throw new Error((sessionJson.error as string) ?? `Erreur ${sessionRes.status}`)
        const { uploadUrl, attachmentId, finalName } = sessionJson as { uploadUrl: string; attachmentId: string; finalName: string }

        // Upload direct vers SharePoint via XHR pour avoir la progression
        const spItemId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round(80 + (e.loaded / e.total) * 18)
              setUploadProgress(pct)
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve((JSON.parse(xhr.responseText) as { id: string }).id) }
              catch { reject(new Error('Réponse SP invalide')) }
            } else reject(new Error(`Erreur upload SP ${xhr.status}`))
          }
          xhr.onerror = () => reject(new Error('Erreur réseau upload'))
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', mime)
          xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`)
          xhr.send(file)
        })

        setUploadProgress(98)
        const confirmRes = await fetch(`${apiBase}/${diagnosticId}/notes/upload-confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionKey, attachmentId, spItemId, name: finalName, mime, size: file.size }),
        })
        if (!confirmRes.ok) {
          const j = await confirmRes.json().catch(() => ({})) as Record<string, string>
          throw new Error(j.error ?? 'Erreur confirmation upload')
        }

        onChange({ ...sectionRef.current, attachments: [...sectionRef.current.attachments, { id: attachmentId, name: finalName, path: spItemId, mime, size: file.size }] })
        setUploadProgress(100)
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 500)
    }
  }

  async function deleteAttachment(att: AttachmentMeta) {
    try {
      await fetch(`${apiBase}/${diagnosticId}/notes/attachment?attachment_id=${encodeURIComponent(att.id)}`, { method: 'DELETE' })
      onChange({ ...sectionRef.current, attachments: sectionRef.current.attachments.filter(a => a.id !== att.id) })
    } catch { /* silently fail */ }
  }

  async function restoreAttachment(att: AttachmentMeta) {
    onChange({ ...sectionRef.current, attachments: sectionRef.current.attachments.map(a => a.id === att.id ? { ...a, deleted_at: null } : a) })
  }

  const activeAttachments = section.attachments.filter(a => !a.deleted_at)
  const trashAttachments  = section.attachments.filter(a => !!a.deleted_at)

  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
          Section {index + 1}
        </span>
        {!readOnly && total > 1 && (
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition"
            title="Supprimer cette section"
          >
            Supprimer
          </button>
        )}
      </div>

      {/* Title editor */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        {!readOnly && <EditorToolbar editor={titleEditor} isTitle />}
        <div
          className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 [&_.tiptap]:outline-none [&_.tiptap]:min-h-[1.5rem] [&_.tiptap_p]:m-0 [&_.tiptap]:placeholder:text-gray-300 [&_.tiptap]:dark:text-gray-100"
          onClick={() => titleEditor?.chain().focus().run()}
        >
          {titleEditor && !readOnly && (
            <EditorContent
              editor={titleEditor}
              placeholder="Titre de la section…"
            />
          )}
          {titleEditor && readOnly && (
            <div
              className="text-sm font-semibold"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.title || '<p class="text-gray-300">Sans titre</p>') }}
            />
          )}
        </div>
      </div>

      {/* Content editor */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        {!readOnly && <EditorToolbar editor={contentEditor} />}
        <div
          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-100 [&_.tiptap]:outline-none [&_.tiptap]:min-h-[5rem] [&_.tiptap_p]:my-1 [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-4 [&_.tiptap]:dark:text-gray-100"
          onClick={() => contentEditor?.chain().focus().run()}
        >
          {contentEditor && !readOnly && (
            <EditorContent editor={contentEditor} />
          )}
          {contentEditor && readOnly && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content || '<p class="text-gray-300">Vide</p>') }}
            />
          )}
        </div>
      </div>

      {/* Attachements — grille de cartes */}
      <div className="p-3 space-y-3">
        {/* Fichiers actifs */}
        {activeAttachments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              {activeAttachments.length >= 2 && (
                <DownloadAllButton attachments={activeAttachments} diagnosticId={diagnosticId} apiBase={apiBase} />
              )}
              <span className="text-[10px] text-gray-400 ml-auto">{activeAttachments.length} fichier{activeAttachments.length > 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeAttachments.map(att => (
                <AttachmentItem key={att.id} att={att} diagnosticId={diagnosticId}
                  annexeRef={annexeRefs.get(att.id)}
                  onDelete={() => deleteAttachment(att)}
                  onRename={!readOnly ? (newName) => onChange({ ...sectionRef.current, attachments: sectionRef.current.attachments.map(a => a.id === att.id ? { ...a, name: newName } : a) }) : undefined}
                  readOnly={readOnly} apiBase={apiBase}
                />
              ))}
            </div>
          </div>
        )}

        {/* Corbeille */}
        {trashAttachments.length > 0 && (
          <div>
            <button onClick={() => setShowTrash(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
              🗑️ Corbeille ({trashAttachments.length}) {showTrash ? '▾' : '›'}
            </button>
            {showTrash && (
              <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                {trashAttachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="truncate flex-1 line-through">{att.name}</span>
                    <button onClick={() => restoreAttachment(att)}
                      className="text-emerald-500 hover:text-emerald-700 shrink-0">↩ Restaurer</button>
                    <button onClick={() => deleteAttachment(att)}
                      className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Zone upload */}
        {!readOnly && (
          <div>
            {/* Onglets Fichier | Dossier */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden mb-2 text-[10px]">
              <button onClick={() => setUploadTab('file')}
                className={`flex-1 py-1 transition ${uploadTab === 'file' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                📎 Fichier
              </button>
              <button onClick={() => setUploadTab('folder')}
                className={`flex-1 py-1 transition ${uploadTab === 'folder' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                📁 Dossier
              </button>
            </div>

            <div
              className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                isDragOver ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
                : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600'
              } ${uploading ? 'opacity-80 pointer-events-none' : ''}`}
              onClick={() => uploadTab === 'folder' ? folderInputRef.current?.click() : fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFileSelect(e.dataTransfer.files) }}
            >
              <input ref={fileInputRef} type="file" className="hidden" multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.webm,.mkv,.3gp,.doc,.docx,.xls,.xlsx"
                onChange={e => handleFileSelect(e.target.files)} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <input ref={folderInputRef} type="file" className="hidden" multiple
                {...{ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
                onChange={e => handleFileSelect(e.target.files)} />

              {uploading ? (
                <div className="space-y-1.5">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{uploadProgress}% — Envoi en cours…</p>
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 dark:text-gray-300">
                  {uploadTab === 'folder'
                    ? '📁 Cliquer pour sélectionner un dossier'
                    : '📎 Glisser-déposer ou cliquer pour ajouter'
                  }
                </p>
              )}
            </div>
          </div>
        )}

        {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
      </div>
    </div>
  )
}

// ─── GuidedActionNotePanel ─────────────────────────────────────────────────────

interface Props {
  diagnosticId: string
  actionKey: string
  readOnly: boolean
  /** Commentaire court (texte brut) affiché au-dessus des sections Tiptap */
  note: string
  onNoteChange: (v: string) => void
  initialSections: NoteSection[]
  /** Incrémenté par le parent à chaque poll réussi — trigger de sync distante */
  notesRemoteVersion?: number
  onSectionsChange: (sections: NoteSection[]) => void
  /** Prefix used for annexe refs. Default: 'A' */
  refPrefix?: string
  /** API base path (without trailing slash). Default: '/api/guided-diagnostic' */
  apiBase?: string
  /** Supabase table name for Realtime subscription. Default: 'guided_action_notes' */
  noteTable?: string
}

function newSection(): NoteSection {
  return { id: crypto.randomUUID(), title: '', content: '', attachments: [] }
}

/** Build a map of attachment_id → ref like "A01" based on global attachment index */
function buildAnnexeRefs(sections: NoteSection[], refPrefix: string): Map<string, string> {
  const map = new Map<string, string>()
  let idx = 0
  for (const sec of sections) {
    for (const att of sec.attachments) {
      idx++
      map.set(att.id, `${refPrefix}${String(idx).padStart(2, '0')}`)
    }
  }
  return map
}

export default function GuidedActionNotePanel({
  diagnosticId,
  actionKey,
  readOnly,
  note,
  onNoteChange,
  initialSections,
  notesRemoteVersion,
  onSectionsChange,
  refPrefix = 'A',
  apiBase = '/api/guided-diagnostic',
  noteTable = 'guided_action_notes',
}: Props) {
  const [sections, setSections] = useState<NoteSection[]>(() =>
    initialSections.length > 0 ? initialSections : [newSection()]
  )
  const [collapsed, setCollapsed] = useState(true)
  const [editorVersion, setEditorVersion] = useState(0)

  const sectionsRef    = useRef(sections)
  sectionsRef.current  = sections
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** true pendant le debounce + fetch → bloque l'application d'une sync distante */
  const pendingSaveRef = useRef(false)

  // ── Sync depuis le parent ─────────────────────────────────────────────────────
  // Déclenché (a) au mount (chargement initial) et (b) à chaque tick de polling
  // réussi via notesRemoteVersion. On remonte les éditeurs Tiptap uniquement si
  // le contenu a changé et qu'aucune sauvegarde locale n'est en cours.
  useEffect(() => {
    if (pendingSaveRef.current) return
    if (initialSections.length === 0) return
    if (JSON.stringify(sectionsRef.current) !== JSON.stringify(initialSections)) {
      setSections(initialSections)
      setEditorVersion(v => v + 1)
    }
  // notesRemoteVersion sert de trigger explicite (chargement initial + polling)
  // initialSections est lu dans le closure au moment de l'exécution — pas dans les deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesRemoteVersion])

  // ─── Supabase Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`guided_note_${diagnosticId}_${actionKey}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  noteTable,
          filter: `diagnostic_id=eq.${diagnosticId}`,
        },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const row = (payload.new ?? payload.old) as { action_key?: string; sections?: NoteSection[]; content?: string } | null
          if (!row || row.action_key !== actionKey) return
          // Ignorer si une sauvegarde locale est en cours
          if (pendingSaveRef.current) return

          if (row.sections !== undefined) {
            const remoteSections = row.sections ?? []
            const final = remoteSections.length > 0 ? remoteSections : [newSection()]
            setSections(final)
            setEditorVersion(v => v + 1)
            onSectionsChange(final)
          }
          if (row.content !== undefined && typeof row.content === 'string') {
            onNoteChange(row.content)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [diagnosticId, actionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Debounced auto-save des sections ─────────────────────────────────────────
  const scheduleSave = useCallback((newSections: NoteSection[]) => {
    if (readOnly) return
    pendingSaveRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${apiBase}/${diagnosticId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_key: actionKey, sections: newSections }),
        })
      } finally {
        pendingSaveRef.current = false
        saveTimerRef.current = null
      }
    }, 800)
  }, [diagnosticId, actionKey, readOnly, apiBase])

  // Computed: does this action have any saved content?
  const totalAttachments = sections.reduce((n, s) => n + s.attachments.length, 0)
  const hasContent = !!note || sections.some(s => s.title || s.content || s.attachments.length > 0)

  const annexeRefs = buildAnnexeRefs(sections, refPrefix)

  const handleSectionChange = useCallback((index: number, updated: NoteSection) => {
    setSections(prev => {
      const next = [...prev]
      next[index] = updated
      scheduleSave(next)
      onSectionsChange(next)
      return next
    })
  }, [scheduleSave, onSectionsChange])

  // ── DnD sensors ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections(prev => {
      const from = prev.findIndex(s => s.id === active.id)
      const to   = prev.findIndex(s => s.id === over.id)
      if (from < 0 || to < 0) return prev
      const next = arrayMove(prev, from, to)
      scheduleSave(next)
      onSectionsChange(next)
      return next
    })
  }

  function addSection() {
    setSections(prev => {
      const next = [...prev, newSection()]
      scheduleSave(next)
      onSectionsChange(next)
      return next
    })
  }

  function deleteSection(index: number) {
    setSections(prev => {
      const next = prev.filter((_, i) => i !== index)
      const final = next.length === 0 ? [newSection()] : next
      scheduleSave(final)
      onSectionsChange(final)
      return final
    })
  }

  return (
    <div className="mt-1 flex flex-col gap-2 px-2 pb-2">

      {/* ── Commentaire de base ───────────────────────────── */}
      <textarea
        readOnly={readOnly}
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Notes, observations, pièces justificatives…"
        rows={3}
        className="w-full text-xs p-2 rounded-lg border resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />

      {/* ── Notes & documents (Tiptap sections + pièces jointes) ──────────── */}
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10 overflow-hidden">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
      >
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Notes &amp; documents
          {/* Badge : count total de pièces jointes */}
          {hasContent && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-800/60 text-indigo-600 dark:text-indigo-300">
              {totalAttachments > 0 ? `📎 ${totalAttachments}` : '●'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-indigo-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Sections avec DnD */}
      {!collapsed && <div className="p-3 space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section, i) => (
              <SortableSectionWrapper key={`${section.id}-v${editorVersion}`} id={section.id}>
                <SectionEditor
                  section={section}
                  index={i}
                  total={sections.length}
                  diagnosticId={diagnosticId}
                  actionKey={actionKey}
                  annexeRefs={annexeRefs}
                  onChange={updated => handleSectionChange(i, updated)}
                  onDelete={() => deleteSection(i)}
                  readOnly={readOnly}
                  apiBase={apiBase}
                />
              </SortableSectionWrapper>
            ))}
          </SortableContext>
        </DndContext>

        {!readOnly && (
          <button
            onClick={addSection}
            className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-700 text-indigo-500 dark:text-indigo-400 text-xs font-medium hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="text-base leading-none">+</span>
            Ajouter une section
          </button>
        )}
      </div>}
    </div>
    </div>
  )
}
