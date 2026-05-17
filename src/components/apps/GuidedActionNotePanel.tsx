'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import DOMPurify from 'dompurify'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import FileViewerModal from '@/components/ui/FileViewerModal'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AttachmentMeta {
  id: string
  name: string
  path: string   // sharepoint_item_id
  mime: string
  size: number
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

async function getSignedUrl(diagnosticId: string, spItemId: string): Promise<string> {
  const res = await fetch(
    `/api/guided-diagnostic/${diagnosticId}/notes/signed-url?item_id=${encodeURIComponent(spItemId)}`
  )
  if (!res.ok) throw new Error('Impossible de générer le lien')
  const { url } = await res.json()
  return url
}

// ─── DownloadAllButton ─────────────────────────────────────────────────────────

function DownloadAllButton({
  attachments,
  diagnosticId,
}: {
  attachments: AttachmentMeta[]
  diagnosticId: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(0)

  async function downloadAll() {
    setDownloading(true)
    setDone(0)
    try {
      for (const att of attachments) {
        try {
          const url = await getSignedUrl(diagnosticId, att.path)
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
}: {
  att: AttachmentMeta
  diagnosticId: string
  annexeRef?: string
  onDelete: () => void
  onRename?: (newName: string) => void
  readOnly: boolean
}) {
  const [loading, setLoading] = useState<'open' | 'download' | null>(null)
  const [editing, setEditing]   = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [thumbUrl, setThumbUrl]   = useState<string | null>(null)
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

  // Lazy-load miniature pour les images
  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    getSignedUrl(diagnosticId, att.path)
      .then(url => { if (!cancelled) setThumbUrl(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [att.path, diagnosticId, isImage])

  // Note: pas de thumbnail vidéo (endpoint non disponible dans sensetho-apps2)

  async function openViewer() {
    setLoading('open')
    try { setViewerUrl(await getSignedUrl(diagnosticId, att.path)) }
    catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(null) }
  }

  async function openVideoPlayer() {
    if (videoOpen) { setVideoOpen(false); return }
    if (videoUrl) { setVideoOpen(true); return }
    setVideoLoading(true)
    try {
      const url = await getSignedUrl(diagnosticId, att.path)
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
      const url = await getSignedUrl(diagnosticId, att.path)
      const a = document.createElement('a')
      a.href = url
      a.download = att.name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(null)
    }
  }

  function startEdit() {
    setEditValue(baseName)
    setEditing(true)
  }

  async function confirmRename() {
    const trimmed = editValue.trim()
    if (!trimmed) return
    const newName = aCodePrefix + trimmed + ext
    if (newName === att.name) { setEditing(false); return }
    setRenaming(true)
    try {
      const res = await fetch(
        `/api/guided-diagnostic/${diagnosticId}/notes/attachment?attachment_id=${encodeURIComponent(att.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: newName }),
        }
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert((j as Record<string, string>).error ?? 'Erreur lors du renommage')
        return
      }
      onRename?.(newName)
      setEditing(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setRenaming(false)
    }
  }

  function FileIcon() {
    if (isImage && thumbUrl) {
      return (
        <div className="shrink-0 w-10 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={openViewer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )
    }
    if (isVideo) {
      return (
        <div
          className="shrink-0 w-10 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer relative bg-gray-900 flex items-center justify-center"
          onClick={openVideoPlayer}
          title={videoOpen ? 'Fermer le lecteur' : 'Lire la vidéo'}
        >
          <span className="text-orange-400 text-base">🎬</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-black/50 border border-white/60 flex items-center justify-center">
              {videoLoading ? (
                <span className="text-white text-[7px]">…</span>
              ) : videoOpen ? (
                <span className="text-white text-[8px]">■</span>
              ) : (
                <span className="text-white text-[8px] ml-0.5">▶</span>
              )}
            </div>
          </div>
        </div>
      )
    }
    const cfg = isPdf   ? { bg: 'bg-red-100 dark:bg-red-900/40',     text: 'text-red-600 dark:text-red-400',    label: 'PDF' }
              : isWord  ? { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-600 dark:text-blue-400',  label: 'DOC' }
              : isExcel ? { bg: 'bg-green-100 dark:bg-green-900/40',  text: 'text-green-600 dark:text-green-400',label: 'XLS' }
              : isImage ? { bg: 'bg-purple-100 dark:bg-purple-900/40',text: 'text-purple-600 dark:text-purple-400',label:'IMG' }
              :           { bg: 'bg-gray-100 dark:bg-gray-700',        text: 'text-gray-500 dark:text-gray-400',  label: '···' }
    return (
      <div
        className={`shrink-0 w-10 h-12 rounded flex flex-col items-center justify-center cursor-pointer border border-gray-200 dark:border-gray-700 ${cfg.bg}`}
        onClick={openViewer}
        title="Cliquer pour visualiser"
      >
        <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
      </div>
    )
  }

  return (
    <>
      {viewerUrl && (
        <FileViewerModal url={viewerUrl} name={att.name} mime={att.mime} onClose={() => setViewerUrl(null)} />
      )}

      <div className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group overflow-hidden">
        <div className="flex items-start gap-2 p-2">
          <FileIcon />

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {annexeRef && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                      {annexeRef}-
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 min-w-0 flex-1">
                    {aCodePrefix && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 select-none">{aCodePrefix}</span>}
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmRename()
                        if (e.key === 'Escape') setEditing(false)
                      }}
                      className="flex-1 min-w-0 text-sm bg-transparent border-b border-indigo-400 outline-none text-gray-900 dark:text-white"
                    />
                    {ext && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 select-none">{ext}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={confirmRename}
                    disabled={renaming || !editValue.trim()}
                    className="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition"
                  >
                    {renaming ? '…' : '✓ OK'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={renaming}
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {annexeRef && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                      {annexeRef}
                    </span>
                  )}
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{att.name}</p>
                  {!readOnly && onRename && (
                    <button
                      onClick={startEdit}
                      title="Renommer le fichier"
                      className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition opacity-0 group-hover:opacity-100"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">{fmtSize(att.size)}</p>
              </div>
            )}
          </div>

          {!editing && (
            <div className="flex items-center gap-1 shrink-0">
              {isVideo ? (
                <button
                  onClick={openVideoPlayer}
                  disabled={videoLoading}
                  title={videoOpen ? 'Fermer le lecteur' : 'Lire la vidéo'}
                  className="text-xs px-2 py-1 rounded bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-800/30 text-orange-600 dark:text-orange-400 transition disabled:opacity-50"
                >
                  {videoLoading ? '…' : videoOpen ? '⏹ Fermer' : '▶ Lire'}
                </button>
              ) : (
                <button
                  onClick={openViewer}
                  disabled={!!loading}
                  title="Ouvrir dans le visualiseur"
                  className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition disabled:opacity-50"
                >
                  {loading === 'open' ? '…' : '↗ Ouvrir'}
                </button>
              )}
              <button
                onClick={downloadFile}
                disabled={!!loading}
                title="Télécharger le fichier"
                className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 transition disabled:opacity-50"
              >
                {loading === 'download' ? '…' : '⬇'}
              </button>
              {!readOnly && (
                <button
                  onClick={onDelete}
                  title="Supprimer"
                  className="text-xs px-1.5 py-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lecteur vidéo inline */}
        {isVideo && videoOpen && videoUrl && (
          <div className="border-t border-gray-100 dark:border-gray-700 bg-black">
            <video
              src={videoUrl}
              controls
              autoPlay
              preload="metadata"
              className="w-full max-h-72 block"
              style={{ display: 'block' }}
              onError={() => {
                setVideoOpen(false)
                setVideoUrl(null)
              }}
            />
          </div>
        )}
      </div>
    </>
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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const mime = file.type || 'application/octet-stream'

        // Étape 1 : obtenir la session d'upload SharePoint
        const sessionRes = await fetch(
          `/api/guided-diagnostic/${diagnosticId}/notes/upload-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              size: file.size,
              actionKey,
            }),
          }
        )
        const sessionText = await sessionRes.text()
        let sessionJson: Record<string, unknown> = {}
        try { sessionJson = JSON.parse(sessionText) } catch { /* non-JSON */ }
        if (!sessionRes.ok) {
          throw new Error((sessionJson.error as string) ?? sessionText.slice(0, 120) ?? `Erreur ${sessionRes.status}`)
        }

        const { uploadUrl, attachmentId, finalName } = sessionJson as {
          uploadUrl: string; attachmentId: string; finalName: string
        }

        // Étape 2 : PUT direct vers SharePoint
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mime,
            'Content-Length': String(file.size),
            'Content-Range': `bytes 0-${file.size - 1}/${file.size}`,
          },
          body: file,
        })
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '')
          throw new Error(`Erreur upload SharePoint ${uploadRes.status}: ${errText.slice(0, 120)}`)
        }
        const spItem = await uploadRes.json() as { id: string }

        // Étape 3 : confirmer l'enregistrement DB
        const confirmRes = await fetch(
          `/api/guided-diagnostic/${diagnosticId}/notes/upload-confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actionKey,
              attachmentId,
              spItemId: spItem.id,
              name: finalName,
              mime,
              size: file.size,
            }),
          }
        )
        if (!confirmRes.ok) {
          const j = await confirmRes.json().catch(() => ({})) as Record<string, string>
          throw new Error(j.error ?? 'Erreur confirmation upload')
        }

        const att: AttachmentMeta = {
          id:   attachmentId,
          name: finalName,
          path: spItem.id,
          mime,
          size: file.size,
        }
        onChange({
          ...sectionRef.current,
          attachments: [...sectionRef.current.attachments, att],
        })
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  async function deleteAttachment(att: AttachmentMeta) {
    try {
      await fetch(
        `/api/guided-diagnostic/${diagnosticId}/notes/attachment?attachment_id=${encodeURIComponent(att.id)}`,
        { method: 'DELETE' }
      )
      onChange({
        ...sectionRef.current,
        attachments: sectionRef.current.attachments.filter(a => a.id !== att.id),
      })
    } catch {
      // Silently fail
    }
  }

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

      {/* Attachments */}
      <div className="p-3 space-y-2">
        {section.attachments.length > 0 && (
          <div className="space-y-1.5">
            {section.attachments.length >= 2 && (
              <DownloadAllButton
                attachments={section.attachments}
                diagnosticId={diagnosticId}
              />
            )}
            {section.attachments.map(att => (
              <AttachmentItem
                key={att.id}
                att={att}
                diagnosticId={diagnosticId}
                annexeRef={annexeRefs.get(att.id)}
                onDelete={() => deleteAttachment(att)}
                onRename={!readOnly ? (newName) => {
                  onChange({
                    ...sectionRef.current,
                    attachments: sectionRef.current.attachments.map(a =>
                      a.id === att.id ? { ...a, name: newName } : a
                    ),
                  })
                } : undefined}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}

        {!readOnly && (
          <div
            className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
                : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600'
            } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragOver(false)
              handleFileSelect(e.dataTransfer.files)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.webm,.mkv,.3gp"
              onChange={e => handleFileSelect(e.target.files)}
            />
            {uploading ? (
              <p className="text-xs text-gray-500 dark:text-gray-300">Envoi en cours…</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-300">
                📎 Glisser-déposer ou <span className="text-indigo-500 dark:text-indigo-400 underline">cliquer</span> pour ajouter un fichier (PDF, image, vidéo)
              </p>
            )}
          </div>
        )}

        {uploadError && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}
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
  onSectionsChange: (sections: NoteSection[]) => void
  /** Called when realtime brings an external update (without triggering a DB save) */
  onExternalSync?: (note: string, sections: NoteSection[]) => void
  /** Prefix used for annexe refs. Default: 'A' */
  refPrefix?: string
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
  onSectionsChange,
  onExternalSync,
  refPrefix = 'A',
}: Props) {
  const [sections, setSections] = useState<NoteSection[]>(() =>
    initialSections.length > 0 ? initialSections : [newSection()]
  )
  const [collapsed, setCollapsed] = useState(true)
  const [editorVersion, setEditorVersion] = useState(0)
  // Save indicator: 'idle' | 'pending' | 'saved' | 'synced'
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved' | 'synced'>('idle')

  const sectionsRef      = useRef(sections)
  sectionsRef.current    = sections
  // Tracks whether the last initialSections change came from this component (our own echo)
  const isInternalChange = useRef(false)
  const saveIndicatorTimer = useRef<ReturnType<typeof setTimeout>>()
  // Blocks realtime updates while user is editing locally (prevents overwrite mid-type)
  const pendingSaveRef = useRef(false)
  const pendingResetTimer = useRef<ReturnType<typeof setTimeout>>()

  function markPending() {
    setSaveState('pending')
    pendingSaveRef.current = true
    if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current)
    if (pendingResetTimer.current) clearTimeout(pendingResetTimer.current)
    // The parent debounce is 800 ms → we wait 1 s then briefly show "saved"
    saveIndicatorTimer.current = setTimeout(() => {
      setSaveState('saved')
      saveIndicatorTimer.current = setTimeout(() => setSaveState('idle'), 1800)
    }, 1000)
    // Release the realtime block after 800ms debounce + ~1.2s network buffer
    pendingResetTimer.current = setTimeout(() => {
      pendingSaveRef.current = false
    }, 2200)
  }

  // Supabase Realtime — sync depuis DB (même pattern que ActionNotePanel de l'ancienne app)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`guided_action_notes_${diagnosticId}_${actionKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guided_action_notes',
        },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const row = (payload.new ?? payload.old) as {
            diagnostic_id?: string; action_key?: string
            sections?: NoteSection[]; content?: string
          } | null
          if (!row) return
          // Filtre client-side (diagnostic_id + action_key)
          if (row.diagnostic_id !== diagnosticId || row.action_key !== actionKey) return
          // Ignorer si l'utilisateur est en train d'écrire localement
          if (pendingSaveRef.current) return

          const remoteSections: NoteSection[] = row.sections ?? []
          const finalSections = remoteSections.length > 0 ? remoteSections : [newSection()]
          setSections(finalSections)
          setEditorVersion(v => v + 1)

          // Notifier le parent sans déclencher de sauvegarde
          onExternalSync?.(row.content ?? '', finalSections)
          setSaveState('synced' as typeof saveState)
          setTimeout(() => setSaveState('idle'), 2500)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [diagnosticId, actionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // BroadcastChannel — sync instantanée entre onglets du même navigateur
  // Fonctionne indépendamment de Supabase Realtime (API navigateur native)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const bc = new BroadcastChannel(`guided_notes_${diagnosticId}`)
    bc.onmessage = (evt: MessageEvent<{ action_key: string; content: string; sections: NoteSection[] }>) => {
      const { action_key, content, sections: remoteSections } = evt.data
      if (action_key !== actionKey) return
      // Ignorer si l'utilisateur est en train d'écrire localement
      if (pendingSaveRef.current) return
      const finalSections = remoteSections?.length > 0 ? remoteSections : [newSection()]
      // Marquer comme changement interne pour éviter le double-apply via initialSections
      isInternalChange.current = true
      setSections(finalSections)
      setEditorVersion(v => v + 1)
      // Notifier le parent sans déclencher de sauvegarde
      onExternalSync?.(content ?? '', finalSections)
      setSaveState('synced')
      setTimeout(() => setSaveState('idle'), 2500)
    }
    return () => bc.close()
  }, [diagnosticId, actionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // When initialSections changes from parent — only apply for EXTERNAL updates
  // (initial load, realtime sync). Ignore echoes of our own writes.
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    if (initialSections.length > 0) {
      setSections(initialSections)
      setEditorVersion(v => v + 1)
    }
  }, [initialSections])

  // Computed: does this action have any saved content?
  const totalAttachments = sections.reduce((n, s) => n + s.attachments.length, 0)
  const hasContent = !!note || sections.some(s => s.title || s.content || s.attachments.length > 0)

  const annexeRefs = buildAnnexeRefs(sections, refPrefix)

  const handleSectionChange = useCallback((index: number, updated: NoteSection) => {
    isInternalChange.current = true
    setSections(prev => {
      const next = [...prev]
      next[index] = updated
      onSectionsChange(next)
      return next
    })
    markPending()
  }, [onSectionsChange]) // eslint-disable-line react-hooks/exhaustive-deps

  function addSection() {
    isInternalChange.current = true
    setSections(prev => {
      const next = [...prev, newSection()]
      onSectionsChange(next)
      return next
    })
  }

  function deleteSection(index: number) {
    isInternalChange.current = true
    setSections(prev => {
      const next = prev.filter((_, i) => i !== index)
      const final = next.length === 0 ? [newSection()] : next
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
        onChange={e => { onNoteChange(e.target.value); markPending() }}
        placeholder="Notes, observations, pièces justificatives…"
        rows={3}
        className="w-full text-xs p-2 rounded-lg border resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />

      {/* ── Notes & documents (Tiptap sections) ──────────── */}
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
          {/* Content badge */}
          {hasContent && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-800/60 text-indigo-600 dark:text-indigo-300">
              {totalAttachments > 0 ? `📎 ${totalAttachments}` : '●'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {/* Save state indicator */}
          {saveState === 'pending' && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Enreg…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-green-500 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Enregistré
            </span>
          )}
          {saveState === 'synced' && (
            <span className="flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Synchronisé
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-indigo-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Sections */}
      {!collapsed && <div className="p-3 space-y-3">
        {sections.map((section, i) => (
          <SectionEditor
            key={`${section.id}-v${editorVersion}`}
            section={section}
            index={i}
            total={sections.length}
            diagnosticId={diagnosticId}
            actionKey={actionKey}
            annexeRefs={annexeRefs}
            onChange={updated => handleSectionChange(i, updated)}
            onDelete={() => deleteSection(i)}
            readOnly={readOnly}
          />
        ))}

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
