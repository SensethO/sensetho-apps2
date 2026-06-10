/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import {
  GESSessionData, GESEntry, GESMethode, S3CatId,
  EMISSION_SOURCES, GES_METHODES, SCOPE3_CATEGORIES,
  computeScopeTotal, formatTCO2e, makeid,
  ESRSObjectif, ESRSAbsorption, GESScope3Config, GESObjectif,
  GESEntrySection, GESEntryAttachment,
  groupBySubcategory, getSourcesByScope, getSourcesByS3Cat,
} from '@/data/bilan-ges'
import FileViewerModal from '@/components/ui/FileViewerModal'
import type { Organisation } from '@/types/organisation'

// ─── Types locaux ─────────────────────────────────────────────────────────────

type Tab = 'synthese' | 'scope1' | 'scope2' | 'scope3' | 'esrs' | 'guide'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newEntry(scopeId: 'scope1' | 'scope2' | 'scope3'): GESEntry {
  const sources = getSourcesByScope(scopeId)
  const first = sources[0]
  return {
    id: makeid(),
    source_id: first?.id ?? null,
    source_label: first?.label ?? '',
    subcategory: first?.subcategory ?? '',
    s3_cat: first?.s3_cat,
    quantity: 0,
    unit: first?.unit ?? '',
    factor: first?.factor ?? 0,
    factor_custom: false,
    total_tco2e: 0,
    lieu: '',
    notes: '',
  }
}

function computeSessionTotals(session: GESSessionData): GESSessionData {
  const t1 = computeScopeTotal(session.scope1.entries)
  const t2 = computeScopeTotal(session.scope2.entries)
  const t3 = computeScopeTotal(session.scope3.entries)
  return { ...session, total_scope1: t1, total_scope2: t2, total_scope3: t3, total_global: t1 + t2 + t3 }
}

function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function ProgressBar({ pct: p, color }: { pct: number; color: string }) {
  const bg: Record<string, string> = {
    red: 'bg-red-500', orange: 'bg-orange-500', blue: 'bg-blue-500',
    emerald: 'bg-emerald-500', purple: 'bg-purple-500', gray: 'bg-gray-400',
  }
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
      <div className={`h-2 rounded-full transition-all ${bg[color] ?? bg.gray}`} style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  )
}

// ─── Tiptap extensions ─────────────────────────────────────────────────────────

const GES_EXTENSIONS_TITLE = [
  StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false }),
  TextStyle,
  Color,
  Underline,
]

const GES_EXTENSIONS_CONTENT = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  TextStyle,
  Color,
  Underline,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
]

// ─── Color palette ─────────────────────────────────────────────────────────────

const GES_TEXT_COLORS = [
  { label: 'Défaut', value: '' },
  { label: 'Gris',   value: '#6b7280' },
  { label: 'Rouge',  value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Vert',   value: '#16a34a' },
  { label: 'Bleu',   value: '#2563eb' },
  { label: 'Violet', value: '#9333ea' },
]

const GES_HIGHLIGHT_COLORS = [
  { label: 'Aucun',       value: '' },
  { label: 'Jaune',       value: '#fef08a' },
  { label: 'Vert clair',  value: '#bbf7d0' },
  { label: 'Bleu clair',  value: '#bfdbfe' },
  { label: 'Rose',        value: '#fecdd3' },
]

// ─── EditorToolbar (identique ActionNotePanel) ─────────────────────────────────

function GESEditorToolbar({
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
      {btn(editor.isActive('bold'),      'Gras',     () => editor.chain().focus().toggleBold().run(),      <strong>G</strong>)}
      {btn(editor.isActive('italic'),    'Italique', () => editor.chain().focus().toggleItalic().run(),    <em>I</em>)}
      {btn(editor.isActive('underline'), 'Souligné', () => editor.chain().focus().toggleUnderline().run(), <span className="underline">S</span>)}

      {!isTitle && (
        <>
          {sep()}
          {btn(editor.isActive('heading', { level: 2 }), 'Titre H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2')}
          {btn(editor.isActive('heading', { level: 3 }), 'Titre H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3')}
          {sep()}
          {btn(editor.isActive('bulletList'),  'Liste à puces',    () => editor.chain().focus().toggleBulletList().run(),  '• —')}
          {btn(editor.isActive('orderedList'), 'Liste numérotée',  () => editor.chain().focus().toggleOrderedList().run(), '1.')}
          {sep()}
          {btn(editor.isActive({ textAlign: 'left' }),   'Gauche', () => editor.chain().focus().setTextAlign('left').run(),   '⫷')}
          {btn(editor.isActive({ textAlign: 'center' }), 'Centre', () => editor.chain().focus().setTextAlign('center').run(), '≡')}
          {btn(editor.isActive({ textAlign: 'right' }),  'Droite', () => editor.chain().focus().setTextAlign('right').run(),  '⫸')}
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
            {GES_TEXT_COLORS.map(c => (
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
              {GES_HIGHLIGHT_COLORS.map(c => (
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

// ─── fmtSize helper ────────────────────────────────────────────────────────────

function gesFmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── GESAttachmentItem ─────────────────────────────────────────────────────────

function GESAttachmentItem({
  att, sessionId, onChange, onDelete,
}: {
  att: GESEntryAttachment
  sessionId: string
  onChange: (updated: GESEntryAttachment) => void
  onDelete: () => void
}) {
  const [loading, setLoading] = useState<'open' | 'download' | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [thumbUrl, setThumbUrl]   = useState<string | null>(null)
  const [editing,  setEditing]    = useState(false)
  const renaming = false

  const isPdf   = att.mime === 'application/pdf'
  const isImage = att.mime.startsWith('image/')
  const isWord  = att.mime.includes('word')
  const isExcel = att.mime.includes('excel') || att.mime.includes('sheet')

  // Séparation nom / extension pour le renommage
  const lastDot  = att.name.lastIndexOf('.')
  const baseName = lastDot > 0 ? att.name.slice(0, lastDot) : att.name
  const ext      = lastDot > 0 ? att.name.slice(lastDot) : ''
  const [editValue, setEditValue] = useState(baseName)

  // Lazy-load miniature pour les images
  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    fetch(`/api/bilan-ges/sessions/${sessionId}/entry-signed-url?path=${encodeURIComponent(att.path)}`)
      .then(r => r.json())
      .then(({ url }) => { if (!cancelled && url) setThumbUrl(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [att.path, sessionId, isImage])

  async function getUrl() {
    const res = await fetch(`/api/bilan-ges/sessions/${sessionId}/entry-signed-url?path=${encodeURIComponent(att.path)}`)
    const { url } = await res.json()
    if (!url) throw new Error('Lien indisponible')
    return url as string
  }

  async function openViewer() {
    setLoading('open')
    try { setViewerUrl(await getUrl()) }
    catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(null) }
  }

  async function downloadFile() {
    setLoading('download')
    try {
      const url = await getUrl()
      const a = document.createElement('a')
      a.href = url; a.download = att.name; a.rel = 'noopener'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(null) }
  }

  function confirmRename() {
    const trimmed = editValue.trim()
    if (!trimmed) return
    onChange({ ...att, name: trimmed + ext })
    setEditing(false)
  }

  // Icône selon le type de fichier
  function FileIcon() {
    if (isImage && thumbUrl) {
      return (
        <div className="shrink-0 w-10 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={openViewer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )
    }
    const cfg = isPdf   ? { bg: 'bg-red-100 dark:bg-red-900/40',    text: 'text-red-600 dark:text-red-400',    label: 'PDF' }
              : isWord  ? { bg: 'bg-blue-100 dark:bg-blue-900/40',   text: 'text-blue-600 dark:text-blue-400',  label: 'DOC' }
              : isExcel ? { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-600 dark:text-green-400',label: 'XLS' }
              : isImage ? { bg: 'bg-purple-100 dark:bg-purple-900/40',text:'text-purple-600 dark:text-purple-400',label:'IMG' }
              :           { bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-500 dark:text-gray-400',  label: '···' }
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

      <div className="flex items-start gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group">
        <FileIcon />

        <div className="flex-1 min-w-0">
          {/* Préfixe + nom */}
          {editing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 flex-wrap">
                {att.prefix && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                    {att.prefix}
                  </span>
                )}
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmRename()
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  className="flex-1 min-w-0 text-xs px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <span className="shrink-0 text-xs text-gray-400 select-none">{ext}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={confirmRename}
                  disabled={renaming || !editValue.trim()}
                  className="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition"
                >
                  {renaming ? '…' : '✓ OK'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {att.prefix && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                    {att.prefix}
                  </span>
                )}
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{att.name}</p>
                <button
                  onClick={() => { setEditValue(baseName); setEditing(true) }}
                  title="Renommer"
                  className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition opacity-0 group-hover:opacity-100"
                >
                  ✏️
                </button>
              </div>
              <p className="text-xs text-gray-400">{gesFmtSize(att.size)}</p>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={openViewer} disabled={!!loading}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition disabled:opacity-50">
              {loading === 'open' ? '…' : '↗ Ouvrir'}
            </button>
            <button onClick={downloadFile} disabled={!!loading}
              className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 transition disabled:opacity-50">
              {loading === 'download' ? '…' : '⬇ Télécharger'}
            </button>
            <button
              onClick={() => { if (confirm(`Supprimer la pièce jointe « ${att.name} » ?`)) onDelete() }}
              disabled={!!loading}
              title="Supprimer la pièce jointe"
              className="text-xs px-2 py-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-50">
              🗑
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── GESSectionEditor ──────────────────────────────────────────────────────────

function GESSectionEditor({
  section, index, total, sessionId, entryId, scopePrefix,
  onChange, onDelete,
}: {
  section: GESEntrySection
  index: number
  total: number
  sessionId: string
  entryId: string
  scopePrefix?: string
  onChange: (updated: GESEntrySection) => void
  onDelete: () => void
}) {
  const sectionRef = useRef(section)
  sectionRef.current = section

  const titleEditor = useEditor({
    extensions: GES_EXTENSIONS_TITLE,
    content: section.title || '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange({ ...sectionRef.current, title: editor.getHTML() })
    },
  })

  const contentEditor = useEditor({
    extensions: GES_EXTENSIONS_CONTENT,
    content: section.content || '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange({ ...sectionRef.current, content: editor.getHTML() })
    },
  })

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload direct navigateur → SharePoint (AUCUN transit de fichier par Vercel) :
  // 1. POST entry-upload-session → uploadUrl SharePoint
  // 2. PUT direct du fichier vers SharePoint (chunks de 10 Mo)
  // 3. POST entry-upload-confirm → métadonnées stockées dans le JSONB de la session
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const mime = file.type || 'application/octet-stream'

        // 1. Session d'upload SharePoint
        const sessionRes = await fetch(`/api/bilan-ges/sessions/${sessionId}/entry-upload-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, size: file.size, prefix: scopePrefix, entryId, sectionId: section.id }),
        })
        const sessionJson = await sessionRes.json().catch(() => ({}))
        if (!sessionRes.ok || sessionJson.error) throw new Error(sessionJson.error ?? `Erreur ${sessionRes.status}`)
        const { uploadUrl, attachmentId } = sessionJson as { uploadUrl: string; attachmentId: string }

        // 2. PUT direct navigateur → SharePoint par chunks de 10 Mo
        const CHUNK = 10 * 1024 * 1024
        let spItemId: string | null = null
        for (let start = 0; start < file.size || (file.size === 0 && start === 0); start += CHUNK) {
          const end = Math.min(start + CHUNK, file.size)
          const blob = file.slice(start, end)
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Range': `bytes ${start}-${Math.max(end - 1, 0)}/${file.size}`,
            },
            body: blob,
          })
          if (!putRes.ok) throw new Error(`Erreur upload SharePoint (${putRes.status})`)
          if (putRes.status === 200 || putRes.status === 201) {
            const itemJson = await putRes.json().catch(() => ({}))
            spItemId = (itemJson as { id?: string }).id ?? null
          }
          if (file.size === 0) break
        }
        if (!spItemId) throw new Error('Upload SharePoint incomplet')

        // 3. Confirmation — le serveur renvoie les métadonnées de la pièce jointe
        const confirmRes = await fetch(`/api/bilan-ges/sessions/${sessionId}/entry-upload-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachmentId, spItemId, name: file.name, mime, size: file.size, prefix: scopePrefix }),
        })
        const json = await confirmRes.json().catch(() => ({}))
        if (!confirmRes.ok || json.error) throw new Error(json.error ?? 'Erreur confirmation upload')
        const att: GESEntryAttachment = json.data
        onChange({ ...sectionRef.current, attachments: [...(sectionRef.current.attachments ?? []), att] })
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  async function deleteAttachment(att: GESEntryAttachment) {
    try {
      await fetch(
        `/api/bilan-ges/sessions/${sessionId}/entry-attachment?path=${encodeURIComponent(att.path)}`,
        { method: 'DELETE' }
      )
      onChange({ ...sectionRef.current, attachments: (sectionRef.current.attachments ?? []).filter(a => a.id !== att.id) })
    } catch {
      // silent
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
          Section {index + 1}
        </span>
        {total > 1 && (
          <button onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition"
            title="Supprimer cette section">
            Supprimer
          </button>
        )}
      </div>

      {/* Title editor */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <GESEditorToolbar editor={titleEditor} isTitle />
        <div
          className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 [&_.tiptap]:outline-none [&_.tiptap]:min-h-[1.5rem] [&_.tiptap_p]:m-0 [&_.tiptap]:dark:text-gray-100"
          onClick={() => titleEditor?.chain().focus().run()}
        >
          <EditorContent editor={titleEditor} />
        </div>
      </div>

      {/* Content editor */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <GESEditorToolbar editor={contentEditor} />
        <div
          className="px-3 py-2 text-sm text-gray-700 dark:text-gray-100 [&_.tiptap]:outline-none [&_.tiptap]:min-h-[5rem] [&_.tiptap_p]:my-1 [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-4 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-4 [&_.tiptap]:dark:text-gray-100"
          onClick={() => contentEditor?.chain().focus().run()}
        >
          <EditorContent editor={contentEditor} />
        </div>
      </div>

      {/* Attachments per section */}
      <div className="p-3 space-y-2">
        {(section.attachments ?? []).length > 0 && (
          <div className="space-y-1.5">
            {(section.attachments ?? []).map(att => (
              <GESAttachmentItem
                key={att.id}
                att={att}
                sessionId={sessionId}
                onChange={updatedAtt => onChange({
                  ...sectionRef.current,
                  attachments: (sectionRef.current.attachments ?? []).map(a =>
                    a.id === updatedAtt.id ? updatedAtt : a
                  )
                })}
                onDelete={() => deleteAttachment(att)}
              />
            ))}
          </div>
        )}

        {/* Upload zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10'
              : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files) }}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          {uploading
            ? <p className="text-xs text-gray-500 dark:text-gray-300">Envoi en cours…</p>
            : <p className="text-xs text-gray-400 dark:text-gray-300">
                📎 Glisser-déposer ou <span className="text-indigo-500 dark:text-indigo-400 underline">cliquer</span> pour ajouter un fichier (PDF, image · max 10 Mo)
              </p>
          }
        </div>

        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>
    </div>
  )
}

// ─── Panel Notes & Documents par entrée ──────────────────────────────────────

function newGESSection(): GESEntrySection {
  return { id: makeid(), title: '', content: '', attachments: [] }
}

function EntryNotesPanel({
  entry, sessionId, scopePrefix,
  onUpdateSections,
}: {
  entry: GESEntry
  sessionId: string
  scopePrefix?: string
  onUpdateSections: (sections: GESEntrySection[]) => void
}) {
  // Normalise les sections venant de la DB (ancien format sans title/attachments)
  const rawSections = entry.sections ?? []
  const sections = rawSections.length > 0
    ? rawSections.map(s => ({ ...s, title: s.title ?? '', attachments: s.attachments ?? [] }))
    : [newGESSection()]
  const [collapsed, setCollapsed] = useState(true)

  const totalAttachments = sections.reduce((n, s) => n + s.attachments.length, 0)
  const hasContent = sections.some(s => s.title || s.content || s.attachments.length > 0)

  function addSection() {
    onUpdateSections([...sections, newGESSection()])
  }

  function updateSection(index: number, updated: GESEntrySection) {
    const next = [...sections]
    next[index] = updated
    onUpdateSections(next)
  }

  function deleteSection(index: number) {
    const next = sections.filter((_, i) => i !== index)
    onUpdateSections(next.length === 0 ? [newGESSection()] : next)
  }

  return (
    <div className="mt-2 mb-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
      >
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Notes &amp; documents
          {(hasContent || totalAttachments > 0) && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 text-xs font-bold">
              {sections.length + totalAttachments}
            </span>
          )}
        </span>
        <svg className={`w-3.5 h-3.5 text-indigo-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Sections */}
      {!collapsed && (
        <div className="p-3 space-y-3">
          {sections.map((section, i) => (
            <GESSectionEditor
              key={section.id}
              section={section}
              index={i}
              total={sections.length}
              sessionId={sessionId}
              entryId={entry.id}
              scopePrefix={scopePrefix}
              onChange={updated => updateSection(i, updated)}
              onDelete={() => deleteSection(i)}
            />
          ))}

          <button
            onClick={addSection}
            className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-700 text-indigo-500 dark:text-indigo-400 text-xs font-medium hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Ajouter une section
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sélecteur de source + ligne d'entrée ─────────────────────────────────────

function EntryRow({
  entry, scopeId, s3cat, sessionId, onUpdate, onDelete,
}: {
  entry: GESEntry
  scopeId: 'scope1' | 'scope2' | 'scope3'
  s3cat?: S3CatId
  sessionId: string
  onUpdate: (updated: GESEntry) => void
  onDelete: (id: string) => void
}) {
  const entryRef = useRef(entry)
  entryRef.current = entry
  const sources = s3cat ? getSourcesByS3Cat(s3cat) : getSourcesByScope(scopeId)

  // Calcul du préfixe de scope
  const scopePrefix = scopeId === 'scope1' ? 'SC1'
    : scopeId === 'scope2' ? 'SC2'
    : s3cat ? `SC3-${s3cat.replace('cat', 'CAT').toUpperCase()}`
    : 'SC3'

  function handleSourceChange(sourceId: string) {
    if (sourceId === '__custom__') {
      onUpdate({ ...entry, source_id: null, source_label: '', unit: '', factor: 0, factor_custom: true })
      return
    }
    const src = EMISSION_SOURCES.find(s => s.id === sourceId)
    if (!src) return
    const total = entry.quantity * src.factor
    onUpdate({ ...entry, source_id: src.id, source_label: src.label, unit: src.unit, factor: src.factor, factor_custom: false, subcategory: src.subcategory, s3_cat: src.s3_cat, total_tco2e: total })
  }

  function handleQtyChange(qty: number) {
    onUpdate({ ...entry, quantity: qty, total_tco2e: qty * entry.factor })
  }

  function handleFactorChange(f: number) {
    onUpdate({ ...entry, factor: f, factor_custom: true, total_tco2e: entry.quantity * f })
  }

  const grouped = groupBySubcategory(sources)

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="grid grid-cols-12 gap-2 items-center py-2">
      {/* Source */}
      <div className="col-span-3">
        {entry.source_id === null && entry.factor_custom ? (
          <input
            type="text"
            value={entry.source_label}
            onChange={e => onUpdate({ ...entry, source_label: e.target.value })}
            placeholder="Source personnalisée..."
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        ) : (
          <select
            value={entry.source_id ?? ''}
            onChange={e => handleSourceChange(e.target.value)}
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {Object.entries(grouped).map(([subcat, srcs]) => (
              <optgroup key={subcat} label={subcat}>
                {srcs.map(s => (
                  <option key={s.id} value={s.id}>{s.label} ({s.unit})</option>
                ))}
              </optgroup>
            ))}
            <option value="__custom__">✏️ Source personnalisée...</option>
          </select>
        )}
      </div>

      {/* Lieu de consommation */}
      <div className="col-span-2">
        <input
          type="text"
          value={entry.lieu ?? ''}
          onChange={e => onUpdate({ ...entry, lieu: e.target.value })}
          placeholder="Lieu / site..."
          className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
      </div>

      {/* Quantité */}
      <div className="col-span-2">
        <input
          type="number"
          min="0"
          step="any"
          value={entry.quantity || ''}
          onChange={e => handleQtyChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white tabular-nums"
        />
      </div>

      {/* Unité */}
      <div className="col-span-1 text-xs text-gray-500 dark:text-gray-400 truncate">
        {entry.source_id === null ? (
          <input
            type="text"
            value={entry.unit}
            onChange={e => onUpdate({ ...entry, unit: e.target.value })}
            placeholder="unité"
            className="w-full border border-gray-200 dark:border-gray-700 rounded px-1 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        ) : entry.unit}
      </div>

      {/* Facteur tCO2e/unité */}
      <div className="col-span-2">
        <input
          type="number"
          min="0"
          step="any"
          value={entry.factor || ''}
          onChange={e => handleFactorChange(parseFloat(e.target.value) || 0)}
          className={`w-full text-xs border rounded px-2 py-1.5 tabular-nums ${
            entry.factor_custom
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400'
          }`}
          title="Facteur tCO₂e/unité (modifiable)"
        />
      </div>

      {/* Total */}
      <div className="col-span-1 text-right">
        <span className={`text-xs font-semibold tabular-nums ${entry.total_tco2e > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
          {formatTCO2e(entry.total_tco2e)}
        </span>
      </div>

      {/* Actions : supprimer */}
      <div className="col-span-1 flex items-center justify-end gap-1">
        <button
          onClick={() => onDelete(entry.id)}
          className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors text-xs"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
    </div>

    {/* Panel Notes & Documents — toujours visible, style ISO26000 */}
    <EntryNotesPanel
      entry={entryRef.current}
      sessionId={sessionId}
      scopePrefix={scopePrefix}
      onUpdateSections={sections => onUpdate({ ...entryRef.current, sections })}
    />
    </div>
  )
}

// ─── Header tableau entrées ────────────────────────────────────────────────────

function EntriesHeader() {
  return (
    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-200 dark:border-gray-700 mb-1">
      <div className="col-span-3">Source d'émission</div>
      <div className="col-span-2">Lieu / site</div>
      <div className="col-span-2">Quantité</div>
      <div className="col-span-1">Unité</div>
      <div className="col-span-2">Facteur tCO₂e/u</div>
      <div className="col-span-1 text-right">Total</div>
      <div className="col-span-1" />
    </div>
  )
}

// ─── Onglet Scope générique (1 ou 2) ─────────────────────────────────────────

function ScopeTab({
  scopeId, entries, total, sessionId, onAdd, onUpdate, onDelete,
  extra,
}: {
  scopeId: 'scope1' | 'scope2'
  entries: GESEntry[]
  total: number
  sessionId: string
  onAdd: () => void
  onUpdate: (e: GESEntry) => void
  onDelete: (id: string) => void
  extra?: React.ReactNode
}) {
  const grouped = entries.reduce((acc, e) => {
    const k = e.subcategory || 'Autre'
    if (!acc[k]) acc[k] = []
    acc[k].push(e)
    return acc
  }, {} as Record<string, GESEntry[]>)

  return (
    <div className="space-y-4">
      {extra}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {entries.length} source{entries.length !== 1 ? 's' : ''} saisie{entries.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            Total : <span className="text-lg">{formatTCO2e(total)}</span>
          </span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
          >
            + Ajouter une source
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-600">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Aucune source saisie — cliquez sur "Ajouter une source"</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <EntriesHeader />
          {Object.entries(grouped).map(([subcat, list]) => (
            <div key={subcat} className="mb-3">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide py-1">{subcat}</div>
              {list.map(e => (
                <EntryRow key={e.id} entry={e} scopeId={scopeId} sessionId={sessionId} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Scope 3 ───────────────────────────────────────────────────────────

function Scope3Tab({
  scope3, total, sessionId, onAddEntry, onUpdateEntry, onDeleteEntry, onToggleCat,
}: {
  scope3: GESScope3Config
  total: number
  sessionId: string
  onAddEntry: (cat: S3CatId) => void
  onUpdateEntry: (e: GESEntry) => void
  onDeleteEntry: (id: string) => void
  onToggleCat: (cat: S3CatId, val: boolean) => void
}) {
  const [openCat, setOpenCat] = useState<S3CatId | null>(null)
  const catIds = Object.keys(SCOPE3_CATEGORIES) as S3CatId[]

  const entriesByCat = scope3.entries.reduce((acc, e) => {
    const cat = e.s3_cat ?? 'cat1'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {} as Partial<Record<S3CatId, GESEntry[]>>)

  const filledCats = catIds.filter(c => (entriesByCat[c]?.length ?? 0) > 0).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{filledCats}</span> / 15 catégories renseignées
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          Total Scope 3 : <span className="text-lg">{formatTCO2e(total)}</span>
        </span>
      </div>

      {/* Amont */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">⬅️ Amont (Upstream)</h3>
        <div className="space-y-2">
          {catIds.filter(c => SCOPE3_CATEGORIES[c].direction === 'amont').map(catId => (
            <Scope3CatBlock
              key={catId}
              catId={catId}
              entries={entriesByCat[catId] ?? []}
              pertinent={scope3.categories_pertinentes[catId]}
              isOpen={openCat === catId}
              sessionId={sessionId}
              onToggle={() => setOpenCat(openCat === catId ? null : catId)}
              onTogglePertinent={v => onToggleCat(catId, v)}
              onAdd={() => onAddEntry(catId)}
              onUpdate={onUpdateEntry}
              onDelete={onDeleteEntry}
            />
          ))}
        </div>
      </div>

      {/* Aval */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">➡️ Aval (Downstream)</h3>
        <div className="space-y-2">
          {catIds.filter(c => SCOPE3_CATEGORIES[c].direction === 'aval').map(catId => (
            <Scope3CatBlock
              key={catId}
              catId={catId}
              entries={entriesByCat[catId] ?? []}
              pertinent={scope3.categories_pertinentes[catId]}
              isOpen={openCat === catId}
              sessionId={sessionId}
              onToggle={() => setOpenCat(openCat === catId ? null : catId)}
              onTogglePertinent={v => onToggleCat(catId, v)}
              onAdd={() => onAddEntry(catId)}
              onUpdate={onUpdateEntry}
              onDelete={onDeleteEntry}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Scope3CatBlock({
  catId, entries, pertinent, isOpen, sessionId, onToggle, onTogglePertinent, onAdd, onUpdate, onDelete,
}: {
  catId: S3CatId
  entries: GESEntry[]
  pertinent: boolean | undefined
  isOpen: boolean
  sessionId: string
  onToggle: () => void
  onTogglePertinent: (v: boolean) => void
  onAdd: () => void
  onUpdate: (e: GESEntry) => void
  onDelete: (id: string) => void
}) {
  const cat = SCOPE3_CATEGORIES[catId]
  const catTotal = computeScopeTotal(entries)
  const hasSources = getSourcesByS3Cat(catId).length > 0
  const isNonPertinent = pertinent === false

  return (
    <div className={`rounded-xl border transition-all ${
      isNonPertinent
        ? 'border-gray-100 dark:border-gray-800 opacity-50'
        : entries.length > 0
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
          : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pertinence toggle */}
        <button
          onClick={() => onTogglePertinent(!isNonPertinent)}
          className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs transition-colors ${
            isNonPertinent
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
          }`}
          title={isNonPertinent ? 'Marquer comme pertinente' : 'Marquer comme non pertinente'}
        >
          {isNonPertinent ? '—' : '✓'}
        </button>

        {/* Expand */}
        <button onClick={onToggle} className="flex-1 flex items-center gap-3 text-left">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{cat.label}</span>
          {entries.length > 0 && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatTCO2e(catTotal)}</span>
          )}
          <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
        </button>

        {!isNonPertinent && (
          <button
            onClick={e => { e.stopPropagation(); onAdd() }}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors font-medium"
          >
            + Ajouter
          </button>
        )}
      </div>

      {isOpen && !isNonPertinent && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{cat.description}</p>
          {!hasSources && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
              ⚠️ Aucun facteur prédéfini pour cette catégorie — entrez une source personnalisée.
            </p>
          )}
          {entries.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-3 mb-2">
              <EntriesHeader />
              {entries.map(e => (
                <EntryRow key={e.id} entry={e} scopeId="scope3" s3cat={catId} sessionId={sessionId} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          )}
          {entries.length === 0 && (
            <div className="text-center py-4 text-gray-400 dark:text-gray-600 text-xs">Aucune donnée saisie</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Onglet ESRS E1 ────────────────────────────────────────────────────────────

function ESRSE1Tab({ esrs, total1, total2, total3, onChange }: {
  esrs: NonNullable<GESSessionData['esrs_e1']>
  total1: number; total2: number; total3: number
  onChange: (updated: NonNullable<GESSessionData['esrs_e1']>) => void
}) {
  function addObjectif() {
    const obj: ESRSObjectif = {
      id: makeid(), label: '', annee_baseline: null, valeur_baseline_tco2e: null,
      annee_cible: null, reduction_pct: null, perimetre: 'Scopes 1, 2 et 3', sbtialigne: false, notes: '',
    }
    onChange({ ...esrs, objectifs: [...esrs.objectifs, obj] })
  }

  function updateObjectif(id: string, patch: Partial<ESRSObjectif>) {
    onChange({ ...esrs, objectifs: esrs.objectifs.map(o => o.id === id ? { ...o, ...patch } : o) })
  }

  function removeObjectif(id: string) {
    onChange({ ...esrs, objectifs: esrs.objectifs.filter(o => o.id !== id) })
  }

  function addAbsorption() {
    const a: ESRSAbsorption = { id: makeid(), label: '', type: 'nature', tco2e_annuel: null, notes: '' }
    onChange({ ...esrs, absorptions: [...esrs.absorptions, a] })
  }

  function updateAbsorption(id: string, patch: Partial<ESRSAbsorption>) {
    onChange({ ...esrs, absorptions: esrs.absorptions.map(a => a.id === id ? { ...a, ...patch } : a) })
  }

  function removeAbsorption(id: string) {
    onChange({ ...esrs, absorptions: esrs.absorptions.filter(a => a.id !== id) })
  }

  const totalEnergie = (esrs.energie_renouvelable_mwh ?? 0) + (esrs.energie_non_renouvelable_mwh ?? 0)
  const pctRenew = totalEnergie > 0 ? Math.round(((esrs.energie_renouvelable_mwh ?? 0) / totalEnergie) * 100) : 0

  return (
    <div className="space-y-8">
      {/* E1-6 — Émissions GES (synthèse auto) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">E1-6</span>
          <h3 className="font-semibold text-gray-900 dark:text-white">Émissions GES brutes (calculées automatiquement)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-3 text-center">
            <div className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">Scope 1</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{formatTCO2e(total1)}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-3 text-center">
            <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-1">Scope 2</div>
            <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatTCO2e(total2)}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-3 text-center">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Scope 3</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatTCO2e(total3)}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-3 text-center">
            <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">Total brut</div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatTCO2e(total1 + total2 + total3)}</div>
          </div>
        </div>
      </section>

      {/* E1-5 — Énergie */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">E1-5</span>
          <h3 className="font-semibold text-gray-900 dark:text-white">Consommation d'énergie</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Énergie renouvelable (MWh/an)
            </label>
            <input
              type="number" min="0" step="any"
              value={esrs.energie_renouvelable_mwh ?? ''}
              onChange={e => onChange({ ...esrs, energie_renouvelable_mwh: parseFloat(e.target.value) || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="ex: 150000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Énergie non renouvelable (MWh/an)
            </label>
            <input
              type="number" min="0" step="any"
              value={esrs.energie_non_renouvelable_mwh ?? ''}
              onChange={e => onChange({ ...esrs, energie_non_renouvelable_mwh: parseFloat(e.target.value) || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="ex: 500000"
            />
          </div>
        </div>
        {totalEnergie > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Part renouvelable : <strong>{pctRenew}%</strong></span>
              <span>Total : {(totalEnergie / 1000).toFixed(1)} GWh</span>
            </div>
            <ProgressBar pct={pctRenew} color="emerald" />
          </div>
        )}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes E1-5</label>
          <textarea
            value={esrs.notes_energie}
            onChange={e => onChange({ ...esrs, notes_energie: e.target.value })}
            rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
            placeholder="Mix énergétique, certifications, plans d'efficacité..."
          />
        </div>
      </section>

      {/* E1-4 — Objectifs de réduction */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">E1-4</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Objectifs de réduction des émissions</h3>
          </div>
          <button
            onClick={addObjectif}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
          >
            + Ajouter objectif
          </button>
        </div>

        {esrs.objectifs.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-gray-600 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Aucun objectif défini — cliquez sur "+ Ajouter objectif"
          </div>
        ) : (
          <div className="space-y-3">
            {esrs.objectifs.map(obj => (
              <div key={obj.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="col-span-2 md:col-span-4">
                    <input
                      type="text"
                      value={obj.label}
                      onChange={e => updateObjectif(obj.id, { label: e.target.value })}
                      placeholder="Intitulé de l'objectif (ex: Réduction 42% émissions scope 1+2 vs 2019)"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Année baseline</label>
                    <input
                      type="number" min="2000" max="2030"
                      value={obj.annee_baseline ?? ''}
                      onChange={e => updateObjectif(obj.id, { annee_baseline: parseInt(e.target.value) || null })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="2019"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valeur baseline (tCO₂e)</label>
                    <input
                      type="number" min="0" step="any"
                      value={obj.valeur_baseline_tco2e ?? ''}
                      onChange={e => updateObjectif(obj.id, { valeur_baseline_tco2e: parseFloat(e.target.value) || null })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="ex: 1500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Année cible</label>
                    <input
                      type="number" min="2025" max="2050"
                      value={obj.annee_cible ?? ''}
                      onChange={e => updateObjectif(obj.id, { annee_cible: parseInt(e.target.value) || null })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="2030"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Réduction cible (%)</label>
                    <input
                      type="number" min="0" max="100"
                      value={obj.reduction_pct ?? ''}
                      onChange={e => updateObjectif(obj.id, { reduction_pct: parseFloat(e.target.value) || null })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="42"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obj.sbtialigne}
                      onChange={e => updateObjectif(obj.id, { sbtialigne: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Aligné SBTi (Science Based Targets)</span>
                  </label>
                  <button onClick={() => removeObjectif(obj.id)} className="ml-auto text-xs text-red-500 hover:text-red-700">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes E1-4</label>
          <textarea
            value={esrs.notes_objectifs}
            onChange={e => onChange({ ...esrs, notes_objectifs: e.target.value })}
            rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
            placeholder="Jalons intermédiaires, gouvernance, plans de transition..."
          />
        </div>
      </section>

      {/* E1-7 — Absorptions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">E1-7</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Absorptions et projets de séquestration</h3>
          </div>
          <button
            onClick={addAbsorption}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            + Ajouter projet
          </button>
        </div>

        {esrs.absorptions.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-gray-600 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Aucun projet de séquestration — reforestation, CCS, etc.
          </div>
        ) : (
          <div className="space-y-3">
            {esrs.absorptions.map(a => (
              <div key={a.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={a.label}
                      onChange={e => updateAbsorption(a.id, { label: e.target.value })}
                      placeholder="Nom du projet"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <select
                      value={a.type}
                      onChange={e => updateAbsorption(a.id, { type: e.target.value as ESRSAbsorption['type'] })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="nature">🌿 Base nature</option>
                      <option value="technologie">⚙️ Technologie (CCS)</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">tCO₂e séquestrées/an</label>
                    <input
                      type="number" min="0" step="any"
                      value={a.tco2e_annuel ?? ''}
                      onChange={e => updateAbsorption(a.id, { tco2e_annuel: parseFloat(e.target.value) || null })}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="ex: 50"
                    />
                  </div>
                  <button onClick={() => removeAbsorption(a.id)} className="self-end text-xs text-red-500 hover:text-red-700 pb-2">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Onglet Synthèse ──────────────────────────────────────────────────────────

function SyntheseTab({ session, onUpdateObjectif }: { session: GESSessionData; onUpdateObjectif: (o: GESObjectif | null) => void }) {
  const { total_scope1: t1, total_scope2: t2, total_scope3: t3, total_global: tg } = session
  const methode = GES_METHODES[session.methode]
  const filledCats = (Object.keys(SCOPE3_CATEGORIES) as S3CatId[]).filter(
    c => session.scope3.entries.some(e => e.s3_cat === c)
  ).length

  const maturity = tg === 0 ? 'Vide'
    : filledCats === 0 ? 'Scopes 1 & 2 uniquement'
    : filledCats < 5 ? 'Scope 3 partiel'
    : filledCats < 10 ? 'Scope 3 standard'
    : 'Scope 3 avancé'

  const maturityColor = tg === 0 ? 'gray' : filledCats >= 10 ? 'emerald' : filledCats >= 5 ? 'blue' : 'amber'

  return (
    <div className="space-y-6">
      {/* Méthode & maturité */}
      <div className="flex flex-wrap gap-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
          session.methode === 'csrd_esrs' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
          : session.methode === 'bilan_carbone' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
        }`}>
          📋 {methode.label}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
          maturityColor === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          : maturityColor === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
          : maturityColor === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
          📊 {maturity}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
          {session.exercice} · {session.secteur || 'Secteur non précisé'}
        </span>
      </div>

      {/* Scores par scope */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">🔴 Scope 1 — Direct</div>
          <div className="text-xl font-bold text-red-700 dark:text-red-300 tabular-nums">{formatTCO2e(t1)}</div>
          {tg > 0 && <div className="text-xs text-red-500 dark:text-red-400 mt-1">{pct(t1, tg)}% du total</div>}
          <div className="mt-2"><ProgressBar pct={pct(t1, tg)} color="red" /></div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">🟡 Scope 2 — Énergie</div>
          <div className="text-xl font-bold text-orange-700 dark:text-orange-300 tabular-nums">{formatTCO2e(t2)}</div>
          {tg > 0 && <div className="text-xs text-orange-500 dark:text-orange-400 mt-1">{pct(t2, tg)}% du total</div>}
          <div className="mt-2"><ProgressBar pct={pct(t2, tg)} color="orange" /></div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">🔵 Scope 3 — Chaîne valeur</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">{formatTCO2e(t3)}</div>
          {tg > 0 && <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">{pct(t3, tg)}% du total</div>}
          <div className="mt-2"><ProgressBar pct={pct(t3, tg)} color="blue" /></div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">⚫ Total global</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{formatTCO2e(tg)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">tCO₂e / an</div>
          <div className="mt-2"><ProgressBar pct={100} color="gray" /></div>
        </div>
      </div>

      {/* Scope 3 — couverture */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Couverture Scope 3</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{filledCats} / 15 catégories</span>
        </div>
        <ProgressBar pct={Math.round((filledCats / 15) * 100)} color="blue" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(SCOPE3_CATEGORIES) as S3CatId[]).map(c => {
            const hasDatas = session.scope3.entries.some(e => e.s3_cat === c)
            const nonPert  = session.scope3.categories_pertinentes[c] === false
            return (
              <span key={c} className={`text-xs px-2 py-0.5 rounded-full border ${
                nonPert ? 'border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 line-through'
                : hasDatas ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600'
              }`}>
                {c.replace('cat', 'C')}
              </span>
            )
          })}
        </div>
      </div>

      {/* Objectif de réduction */}
      <ObjectifSection objectif={session.objectif ?? null} total={tg} onUpdate={onUpdateObjectif} />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes générales</label>
        <textarea
          value={session.notes}
          readOnly
          rows={3}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 resize-none"
          placeholder="Les notes sont modifiables dans les onglets Scope"
        />
      </div>
    </div>
  )
}

// ─── Section Objectif ──────────────────────────────────────────────────────────

function ObjectifSection({ objectif, total, onUpdate }: {
  objectif: GESObjectif | null
  total: number
  onUpdate: (o: GESObjectif | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GESObjectif>(objectif ?? {
    annee_baseline: null, valeur_baseline_tco2e: null,
    annee_cible: null, reduction_pct: null,
    perimetre: 'Scopes 1, 2 et 3', sbtialigne: false, notes: '',
  })

  function save() {
    onUpdate(draft)
    setEditing(false)
  }

  function remove() {
    if (confirm('Supprimer l\'objectif ?')) { onUpdate(null); setEditing(false) }
  }

  // Calcul progression
  const baseline = objectif?.valeur_baseline_tco2e
  const targetPct = objectif?.reduction_pct
  const cible = (baseline && targetPct) ? baseline * (1 - targetPct / 100) : null
  const progressPct = (baseline && cible && total > 0)
    ? Math.max(0, Math.round(((baseline - total) / (baseline - cible)) * 100))
    : null
  const reductionActuelle = (baseline && total > 0) ? Math.round(((baseline - total) / baseline) * 100) : null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          🎯 Objectif de réduction
        </h3>
        <div className="flex gap-2">
          {objectif && !editing && (
            <button onClick={remove} className="text-xs text-red-400 hover:text-red-600 transition-colors">Supprimer</button>
          )}
          <button
            onClick={() => { if (editing) save(); else setEditing(true) }}
            className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium ${
              editing
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600'
            }`}
          >
            {editing ? '✓ Enregistrer' : objectif ? '✏️ Modifier' : '+ Définir un objectif'}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Annuler</button>
          )}
        </div>
      </div>

      {!objectif && !editing && (
        <p className="text-xs text-gray-400 dark:text-gray-600 italic">
          Définissez une cible de réduction (ex : -30% d'ici 2030) pour suivre votre progression.
        </p>
      )}

      {editing && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Année baseline</label>
            <input type="number" min="2015" max="2030"
              value={draft.annee_baseline ?? ''}
              onChange={e => setDraft({ ...draft, annee_baseline: e.target.value || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="2024" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Émissions baseline (tCO₂e)</label>
            <input type="number" min="0" step="any"
              value={draft.valeur_baseline_tco2e ?? ''}
              onChange={e => setDraft({ ...draft, valeur_baseline_tco2e: parseFloat(e.target.value) || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="ex: 392" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Année cible</label>
            <input type="number" min="2025" max="2050"
              value={draft.annee_cible ?? ''}
              onChange={e => setDraft({ ...draft, annee_cible: e.target.value || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="2030" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Réduction cible (%)</label>
            <input type="number" min="0" max="100"
              value={draft.reduction_pct ?? ''}
              onChange={e => setDraft({ ...draft, reduction_pct: parseFloat(e.target.value) || null })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="30" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Périmètre</label>
            <input type="text"
              value={draft.perimetre}
              onChange={e => setDraft({ ...draft, perimetre: e.target.value })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="ex: Scopes 1, 2 et 3" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={draft.sbtialigne}
                onChange={e => setDraft({ ...draft, sbtialigne: e.target.checked })}
                className="w-4 h-4 accent-emerald-600" />
              <span className="text-gray-700 dark:text-gray-300 text-xs">Aligné SBTi (Science Based Targets)</span>
            </label>
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input type="text"
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Contexte, jalons, plan d'action..." />
          </div>
        </div>
      )}

      {objectif && !editing && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Baseline <strong className="text-gray-900 dark:text-white">{objectif.annee_baseline ?? '—'}</strong>
              {objectif.valeur_baseline_tco2e != null && (
                <> : <strong className="text-gray-900 dark:text-white">{formatTCO2e(objectif.valeur_baseline_tco2e)}</strong></>
              )}
            </span>
            <span className="text-gray-300 dark:text-gray-600">→</span>
            <span className="text-gray-500 dark:text-gray-400">
              Cible <strong className="text-gray-900 dark:text-white">{objectif.annee_cible ?? '—'}</strong>
              {cible != null && (
                <> : <strong className="text-emerald-600 dark:text-emerald-400">−{objectif.reduction_pct}% = {formatTCO2e(cible)}</strong></>
              )}
            </span>
            {objectif.sbtialigne && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800">
                ✓ SBTi
              </span>
            )}
            {objectif.perimetre && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{objectif.perimetre}</span>
            )}
          </div>

          {progressPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Progression vers l'objectif</span>
                <span className="font-semibold">
                  {progressPct}%
                  {reductionActuelle != null && (
                    <span className="ml-1 text-gray-400">
                      ({reductionActuelle > 0 ? '−' : '+'}{Math.abs(reductionActuelle)}% vs baseline)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600">
                <span>{objectif.valeur_baseline_tco2e != null ? formatTCO2e(objectif.valeur_baseline_tco2e) : '—'} (baseline {objectif.annee_baseline})</span>
                <span>{cible != null ? formatTCO2e(cible) : '—'} (cible {objectif.annee_cible})</span>
              </div>
            </div>
          )}

          {objectif.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">{objectif.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Guide & Formation ────────────────────────────────────────────────────────

type AccordionSection = {
  id: string
  icon: string
  title: string
  badge?: { text: string; color: string }
  content: React.ReactNode
}

function Accordion({ sections }: { sections: AccordionSection[] }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.id ?? null)
  return (
    <div className="space-y-2">
      {sections.map(s => (
        <div key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setOpen(open === s.id ? null : s.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              open === s.id
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{s.title}</span>
            {s.badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge.color}`}>{s.badge.text}</span>
            )}
            <span className="text-gray-400 text-xs ml-2">{open === s.id ? '▲' : '▼'}</span>
          </button>
          {open === s.id && (
            <div className="px-5 py-4 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 space-y-3">
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function InfoBox({ type, children }: { type: 'info' | 'tip' | 'warning' | 'example'; children: React.ReactNode }) {
  const styles = {
    info:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800',    text: 'text-blue-800 dark:text-blue-200',    icon: 'ℹ️' },
    tip:     { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-200', icon: '💡' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-800 dark:text-amber-200',   icon: '⚠️' },
    example: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-200', icon: '📌' },
  }
  const s = styles[type]
  return (
    <div className={`rounded-lg border ${s.bg} ${s.border} px-4 py-3 flex gap-2.5`}>
      <span>{s.icon}</span>
      <div className={`text-xs ${s.text}`}>{children}</div>
    </div>
  )
}

function RefLink({ href, label, source }: { href: string; label: string; source: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
    >
      <span className="text-lg">🔗</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate">{label}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{source}</div>
      </div>
      <span className="text-gray-300 group-hover:text-emerald-400 text-xs">↗</span>
    </a>
  )
}

function QuizQuestion({ q, options, correct, explanation }: {
  q: string; options: string[]; correct: number; explanation: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{q}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            disabled={answered}
            onClick={() => setSelected(i)}
            className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${
              !answered
                ? 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : i === correct
                  ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-medium'
                  : i === selected
                    ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 opacity-60'
            }`}
          >
            {answered && i === correct && '✓ '}
            {answered && i === selected && i !== correct && '✗ '}
            {opt}
          </button>
        ))}
      </div>
      {answered && (
        <div className={`text-xs rounded-lg px-3 py-2 ${
          selected === correct
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
        }`}>
          {selected === correct ? '🎉 Bonne réponse ! ' : '📖 '}
          {explanation}
        </div>
      )}
    </div>
  )
}

function GuideFormationTab() {
  const [quizSection, setQuizSection] = useState<'bases' | 'avance' | null>(null)

  const GUIDE_SECTIONS: AccordionSection[] = [
    {
      id: 'concepts',
      icon: '🌡️',
      title: 'Concepts fondamentaux — GES, PRG et tCO₂e',
      badge: { text: 'Base', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
      content: (
        <div className="space-y-3">
          <p>
            Les <strong>gaz à effet de serre (GES)</strong> sont des composés qui absorbent et ré-émettent le rayonnement infrarouge,
            contribuant au réchauffement climatique. Le protocole de Kyoto en identifie <strong>7 principaux</strong> :
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { gaz: 'CO₂', nom: 'Dioxyde de carbone', prg: '1', source: 'Combustion fossile, déforestation' },
              { gaz: 'CH₄', nom: 'Méthane', prg: '28–36', source: 'Élevage, décharges, gaz naturel' },
              { gaz: 'N₂O', nom: 'Protoxyde d\'azote', prg: '265–298', source: 'Agriculture, engrais azotés' },
              { gaz: 'HFC', nom: 'Hydrofluorocarbures', prg: '12–14 800', source: 'Fluides frigorigènes, climatiseurs' },
              { gaz: 'PFC', nom: 'Perfluorocarbures', prg: '6 630–11 100', source: 'Industrie aluminium, semi-conducteurs' },
              { gaz: 'SF₆', nom: 'Hexafluorure de soufre', prg: '23 500', source: 'Appareillages électriques HT' },
              { gaz: 'NF₃', nom: 'Trifluorure d\'azote', prg: '16 100', source: 'Fabrication écrans LCD, panneaux solaires' },
            ].map(g => (
              <div key={g.gaz} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs w-8 flex-shrink-0">{g.gaz}</span>
                <div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">{g.nom}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">PRG : {g.prg} · {g.source}</div>
                </div>
              </div>
            ))}
          </div>
          <InfoBox type="info">
            <strong>PRG = Potentiel de Réchauffement Global</strong> — mesure l'impact d'un gaz sur 100 ans
            par rapport au CO₂ (PRG=1). Exemple : 1 kg de CH₄ équivaut à <strong>28 kg de CO₂</strong>.
            Tous les gaz sont convertis en <strong>tCO₂e (tonnes équivalent CO₂)</strong> pour avoir une unité commune.
            Cette application utilise les PRG du <strong>5ᵉ rapport du GIEC (AR5, 2014)</strong>, référence officielle ADEME.
          </InfoBox>
          <InfoBox type="tip">
            <strong>Formule universelle : Émissions (tCO₂e) = Quantité × Facteur d'émission</strong><br />
            Exemple : 10 000 L de gazole × 0,00267 tCO₂e/L = <strong>26,7 tCO₂e</strong>
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'scope1',
      icon: '🔴',
      title: 'Scope 1 — Émissions directes',
      badge: { text: 'Obligatoire', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
      content: (
        <div className="space-y-3">
          <p>
            Le <strong>Scope 1</strong> couvre toutes les émissions issues de sources que l'organisation
            <strong> possède ou contrôle directement</strong>. C'est le périmètre de base de tout bilan GES.
          </p>
          <div className="space-y-2">
            {[
              {
                cat: '🔥 Combustion fixe',
                desc: 'Chaudières, fours, groupes électrogènes, procédés industriels utilisant du combustible (gaz naturel, fioul, charbon, bois).',
                ex: 'Chaudière gaz 500 kW · Four industriel · Groupe électrogène secours',
              },
              {
                cat: '🚗 Combustion mobile',
                desc: 'Véhicules et engins appartenant ou loués par l\'organisation (voitures, camions, chariots, bateaux).',
                ex: 'Flotte commerciale · Camions de livraison propres · Engins de chantier',
              },
              {
                cat: '❄️ Fuites frigorigènes',
                desc: 'Fuites de fluides réfrigérants dans les climatiseurs, pompes à chaleur, chambres froides. PRG très élevé (R410A = 2 088).',
                ex: 'Recharge annuelle clim · Fuite détectée PAC · Maintenance chambre froide',
              },
              {
                cat: '⚗️ Procédés industriels',
                desc: 'Émissions chimiques non liées à la combustion : ciment, acier, chimie, agriculture.',
                ex: 'Four cimenterie · Fermentation · Épandage agricole',
              },
            ].map(item => (
              <div key={item.cat} className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 p-3">
                <div className="font-semibold text-red-800 dark:text-red-300 text-xs mb-1">{item.cat}</div>
                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">{item.desc}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">Exemples : {item.ex}</p>
              </div>
            ))}
          </div>
          <InfoBox type="warning">
            <strong>Attention aux fuites frigorigènes</strong> — elles sont souvent négligées mais peuvent représenter
            5 à 20% des émissions Scope 1 d'une entreprise tertiaire. Vérifiez les carnets de maintenance et les recharges annuelles.
          </InfoBox>
          <InfoBox type="tip">
            <strong>Données nécessaires :</strong> factures gaz/fioul, relevés compteurs, carnets de maintenance
            véhicules (litres consommés), bons de recharge frigorifique, données process industriel.
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'scope2',
      icon: '🟡',
      title: 'Scope 2 — Énergie indirecte achetée',
      badge: { text: 'Obligatoire', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
      content: (
        <div className="space-y-3">
          <p>
            Le <strong>Scope 2</strong> couvre les émissions liées à la production de l'<strong>énergie achetée</strong> et
            consommée par l'organisation : électricité, chaleur, vapeur, froid.
            Ces émissions se produisent chez le fournisseur d'énergie, pas sur site.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
              <div className="font-bold text-blue-800 dark:text-blue-300 text-xs mb-2">📍 Méthode location-based</div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                Utilise le <strong>facteur moyen du réseau national</strong> (ex: France = 0,052 kgCO₂e/kWh).
                Simple à calculer, basé sur la consommation mesurée.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Usage : bilan carbone interne, reporting Bilan Carbone® ADEME</p>
            </div>
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 text-xs mb-2">🏷️ Méthode market-based</div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                Utilise le facteur lié aux <strong>contrats énergétiques et certificats</strong> (PPA, GO, RECs).
                Reflète les choix d'approvisionnement de l'entreprise.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Usage : GHG Protocol Scope 2 Guidance (2015), reporting CSRD obligatoire</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Pays / Source</th>
                  <th className="text-right p-2 border border-gray-200 dark:border-gray-700 font-semibold">Facteur (kgCO₂e/kWh)</th>
                  <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['🇫🇷 France (réseau)',    '0,052',  'Mix très bas-carbone (nucléaire + hydraulique)'],
                  ['🇩🇪 Allemagne',          '0,434',  'Mix encore très carboné (charbon + gaz)'],
                  ['🇪🇸 Espagne',            '0,195',  'Mix mixte (renouvelable + gaz)'],
                  ['🇮🇹 Italie',             '0,233',  'Mix gaz dominant'],
                  ['🌍 Monde (moyenne)',      '0,494',  'Référence pour activités internationales'],
                  ['🌿 Électricité verte FR', '0,024',  'Contrat garantie d\'origine (GO/RECs)'],
                ].map(([pays, facteur, note]) => (
                  <tr key={pays} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-2 border border-gray-200 dark:border-gray-700">{pays}</td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700 text-right font-mono font-semibold">{facteur}</td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InfoBox type="tip">
            <strong>Cas français :</strong> le réseau électrique français a l'un des facteurs d'émission les plus bas d'Europe
            grâce au nucléaire (70%) et à l'hydraulique. Migrer vers l'électricité (pompes à chaleur, véhicules électriques)
            est souvent la meilleure action de réduction pour une entreprise française.
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'scope3',
      icon: '🔵',
      title: 'Scope 3 — Chaîne de valeur (15 catégories)',
      badge: { text: 'Souvent > 70% des émissions', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
      content: (
        <div className="space-y-3">
          <p>
            Le <strong>Scope 3</strong> regroupe toutes les émissions <strong>indirectes hors énergie</strong>
            de la chaîne de valeur. C'est généralement la source majoritaire (70 à 95% pour les entreprises de services).
            Il est structuré en <strong>15 catégories</strong> selon le GHG Protocol.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">⬅️ Amont (Upstream) — cat. 1 à 8</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-50 dark:bg-blue-900/20">
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold w-12">Cat.</th>
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Libellé</th>
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Exemples concrets</th>
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Données clés</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['1', 'Achats de biens et services', 'Matières premières, IT, prestataires', '€ achats ou kg/unités'],
                    ['2', 'Biens d\'équipement', 'Machines, bâtiments, véhicules achetés', 'Valeur d\'achat (€ ou unités)'],
                    ['3', 'Combustibles & énergie (non S1/S2)', 'Extraction, raffinage, transport énergie', 'kWh consommés S1+S2'],
                    ['4', 'Transport & distribution amont', 'Fret fournisseurs vers l\'entreprise', 't.km par mode'],
                    ['5', 'Déchets générés', 'Ordures bureau, déchets industriels', 'tonnes par type de traitement'],
                    ['6', 'Déplacements professionnels', 'Avion, train, hôtel, voiture de mission', 'km ou nuits/passager'],
                    ['7', 'Pendularité des salariés', 'Domicile → travail de chaque employé', 'km × modal split'],
                    ['8', 'Actifs loués en amont', 'Immeubles, véhicules loués utilisés', 'kWh ou km parcourus'],
                  ].map(([cat, label, ex, data]) => (
                    <tr key={cat} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-2 border border-gray-200 dark:border-gray-700 font-mono font-bold text-blue-600 dark:text-blue-400">C{cat}</td>
                      <td className="p-2 border border-gray-200 dark:border-gray-700 font-medium">{label}</td>
                      <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">{ex}</td>
                      <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 italic">{data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-2">➡️ Aval (Downstream) — cat. 9 à 15</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold w-12">Cat.</th>
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Libellé</th>
                    <th className="text-left p-2 border border-gray-200 dark:border-gray-700 font-semibold">Exemples concrets</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['9', 'Transport & distribution aval', 'Livraisons clients, entrepôts tiers'],
                    ['10', 'Transformation des produits vendus', 'Produits semi-finis transformés par clients'],
                    ['11', 'Utilisation des produits vendus', 'Énergie consommée par les produits en usage'],
                    ['12', 'Fin de vie des produits', 'Recyclage, mise en décharge des produits vendus'],
                    ['13', 'Actifs loués en aval', 'Biens loués à des clients (leasing)'],
                    ['14', 'Franchises', 'Émissions des franchisés'],
                    ['15', 'Investissements', 'Financement de projets ou participations'],
                  ].map(([cat, label, ex]) => (
                    <tr key={cat} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-2 border border-gray-200 dark:border-gray-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">C{cat}</td>
                      <td className="p-2 border border-gray-200 dark:border-gray-700 font-medium">{label}</td>
                      <td className="p-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <InfoBox type="tip">
            <strong>Comment identifier les catégories pertinentes ?</strong> Une catégorie est pertinente si elle
            peut représenter ≥ 1% du total ou si elle est significative pour votre secteur.
            Pour un cabinet de conseil : cat. 6 (voyages) et cat. 7 (pendularité) dominent.
            Pour un industriel : cat. 1 (achats matières) et cat. 4 (transport) sont critiques.
          </InfoBox>
          <InfoBox type="warning">
            <strong>Obligation CSRD :</strong> pour le reporting ESRS E1-6, toutes les catégories Scope 3
            doivent être évaluées, avec justification documentée pour chaque catégorie non pertinente.
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'methodes',
      icon: '📐',
      title: 'Les 3 méthodes — différences et cas d\'usage',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                label: 'GHG Protocol',
                color: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
                header: 'text-blue-800 dark:text-blue-300',
                tag: '🌐 Standard international',
                who: 'Toute organisation, volontaire ou obligatoire',
                when: 'Reporting ESG, engagement SBTi, CDP, communication investisseurs',
                key: 'Structure Scope 1/2/3 en 15 catégories · Deux méthodes Scope 2 · Référence mondiale (186 pays)',
                limit: 'Moins prescriptif sur la collecte des données, large latitude d\'interprétation',
              },
              {
                label: 'Bilan Carbone® ADEME/ABC',
                color: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
                header: 'text-emerald-800 dark:text-emerald-300',
                tag: '🇫🇷 Standard français (loi LRE)',
                who: 'Entreprises françaises, associations, collectivités',
                when: 'Obligation légale (art. L229-25 Code env.) pour > 500 salariés · BEGES · Plan d\'action requis',
                key: 'Facteurs ADEME Base Carbone · Nomenclature adaptée au contexte français · Approche par "postes"',
                limit: 'Spécifique à la France, moins utilisé à l\'international',
              },
              {
                label: 'CSRD / ESRS E1',
                color: 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20',
                header: 'text-purple-800 dark:text-purple-300',
                tag: '🇪🇺 Obligation réglementaire UE',
                who: 'Grandes entreprises EU (> 250 sal. ou > 40M€ CA) dès exercice 2024',
                when: 'Rapport de durabilité CSRD · Audit externe obligatoire · Taxonomie UE',
                key: 'E1-4 Objectifs · E1-5 Énergie · E1-6 GES (S1+2+3) · E1-7 Absorptions · Double matérialité',
                limit: 'Cadre le plus exigeant : données vérifiées par tiers, analyse de double matérialité préalable',
              },
            ].map(m => (
              <div key={m.label} className={`rounded-xl border-2 ${m.color} p-4`}>
                <div className={`font-bold ${m.header} mb-1`}>{m.label} <span className="font-normal text-xs">{m.tag}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mt-2">
                  <div><span className="font-semibold text-gray-700 dark:text-gray-300">Pour qui :</span> <span className="text-gray-600 dark:text-gray-400">{m.who}</span></div>
                  <div><span className="font-semibold text-gray-700 dark:text-gray-300">Quand :</span> <span className="text-gray-600 dark:text-gray-400">{m.when}</span></div>
                  <div><span className="font-semibold text-gray-700 dark:text-gray-300">Points clés :</span> <span className="text-gray-600 dark:text-gray-400">{m.key}</span></div>
                </div>
                <div className="text-xs mt-2 text-gray-500 dark:text-gray-400 italic">⚡ {m.limit}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'facteurs',
      icon: '🧮',
      title: 'Base Carbone® ADEME — Comprendre les facteurs d\'émission',
      content: (
        <div className="space-y-3">
          <p>
            Un <strong>facteur d'émission</strong> est un coefficient qui permet de convertir une donnée d'activité
            (kWh consommés, litres de carburant, km parcourus, € d'achats) en émissions de GES (tCO₂e).
            Ces facteurs sont publiés et régulièrement mis à jour par l'ADEME dans la <strong>Base Carbone®</strong>.
          </p>
          <InfoBox type="info">
            <strong>Base Carbone® ADEME</strong> — base de données publique et gratuite disponible sur
            base-empreinte.ademe.fr. Elle contient plus de <strong>4 000 facteurs d'émission</strong> couvrant
            l'énergie, les transports, les matériaux, les aliments, les déchets et plus encore.
            Version utilisée dans cette application : <strong>2023</strong>.
          </InfoBox>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Composition d'un facteur d'émission</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                { type: 'CO₂ fossile', desc: 'Combustion de carbone fossile. Principal gaz, bien maîtrisé.' },
                { type: 'CO₂ biogénique', desc: 'Émis par combustion de biomasse. Comptabilisé séparément dans certains standards.' },
                { type: 'Méthane (CH₄)', desc: 'Fuites gaz naturel, décharges, élevage. PRG élevé (28).' },
                { type: 'N₂O', desc: 'Agriculture, combustion à haute température. PRG très élevé (265).' },
                { type: 'HFC/PFC/SF₆', desc: 'Fluides frigorigènes, procédés industriels. PRG extrêmement élevé.' },
                { type: 'CO₂ amont', desc: 'Émissions de l\'extraction et du transport du combustible (upstream).' },
              ].map(item => (
                <div key={item.type} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white mb-0.5">{item.type}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <InfoBox type="tip">
            <strong>Facteur personnalisé :</strong> vous pouvez modifier le facteur d'une ligne (il apparaît en amber)
            si vous disposez d'un facteur spécifique à votre fournisseur, certifié par un tiers.
            Dans ce cas, documentez la source dans le champ Notes de la session.
          </InfoBox>
          <InfoBox type="warning">
            <strong>Attention aux doubles comptages Scope 1/2 :</strong> le gaz consommé dans votre chaudière → Scope 1.
            L'énergie achetée (électricité, chaleur réseau) → Scope 2 uniquement. Ne comptez pas la même
            consommation dans les deux scopes.
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'csrd',
      icon: '📋',
      title: 'CSRD / ESRS E1 — Reporting obligatoire européen',
      badge: { text: 'EU 2022/2464', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
      content: (
        <div className="space-y-3">
          <p>
            La <strong>Corporate Sustainability Reporting Directive (CSRD)</strong> oblige les grandes entreprises
            européennes à publier un rapport de durabilité détaillé, audité par un tiers.
            Le standard <strong>ESRS E1 "Changement climatique"</strong> définit précisément ce qui doit être déclaré.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Calendrier d'entrée en vigueur</div>
            <div className="space-y-1.5">
              {[
                { year: '2025', scope: 'Grandes entreprises EU (> 500 sal. ou cotées + > 250 sal. / 40M€ CA)', ref: 'Exercice 2024' },
                { year: '2026', scope: 'Autres grandes entreprises (> 250 sal. ou 40M€ CA / 20M€ bilan)', ref: 'Exercice 2025' },
                { year: '2027', scope: 'PME cotées (normes simplifiées), filiales de grands groupes', ref: 'Exercice 2026' },
              ].map(r => (
                <div key={r.year} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900">
                  <span className="font-bold text-purple-700 dark:text-purple-300 text-sm w-10">{r.year}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{r.scope}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">{r.ref}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Disclosures ESRS E1 à déclarer</div>
            <div className="space-y-1.5">
              {[
                { id: 'E1-1', label: 'Plan de transition climatique', desc: 'Stratégie, gouvernance, jalons vers la neutralité carbone' },
                { id: 'E1-2', label: 'Politiques liées au changement climatique', desc: 'Politiques internes de gestion du risque climatique' },
                { id: 'E1-3', label: 'Actions et ressources', desc: 'Plans d\'action concrets et budgets alloués' },
                { id: 'E1-4', label: 'Objectifs de réduction', desc: 'Cibles chiffrées (SBTi recommandé), horizon temporel, périmètre' },
                { id: 'E1-5', label: 'Consommation énergétique', desc: 'MWh renouvelable vs non renouvelable, intensité énergétique' },
                { id: 'E1-6', label: 'Émissions GES brutes S1+S2+S3', desc: 'Calculées selon GHG Protocol, vérifiées par tiers' },
                { id: 'E1-7', label: 'Absorptions et séquestration', desc: 'Projets nature (reforestation) et technologie (BECCS, CCS)' },
                { id: 'E1-8', label: 'Tarification interne du carbone', desc: 'Prix interne du CO₂ si appliqué dans les décisions d\'investissement' },
                { id: 'E1-9', label: 'Risques et opportunités climatiques', desc: 'Impacts physiques (chaud, inondations) et de transition (réglementations)' },
              ].map(d => (
                <div key={d.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs w-10 flex-shrink-0 mt-0.5">{d.id}</span>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{d.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <InfoBox type="info">
            <strong>Double matérialité</strong> — avant de remplir ESRS E1, l'entreprise doit réaliser une analyse
            de double matérialité : (1) impact de l'entreprise sur le climat <em>(matérialité d'impact)</em> et
            (2) risques climatiques sur l'entreprise <em>(matérialité financière)</em>. Cette analyse détermine
            quels disclosures sont obligatoires pour votre entité.
          </InfoBox>
        </div>
      ),
    },
    {
      id: 'references',
      icon: '📚',
      title: 'Références officielles et ressources',
      content: (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Standards et protocoles</div>
            <div className="space-y-2">
              <RefLink href="https://ghgprotocol.org/corporate-standard" label="GHG Protocol Corporate Standard" source="WRI / WBCSD — Standard international de référence" />
              <RefLink href="https://ghgprotocol.org/scope-2-guidance" label="GHG Protocol Scope 2 Guidance (2015)" source="WRI — Location-based vs Market-based" />
              <RefLink href="https://ghgprotocol.org/scope3-technical-calculation-guidance" label="GHG Protocol Scope 3 Technical Guidance" source="WRI — Calcul des 15 catégories Scope 3" />
              <RefLink href="https://www.associationbilancarbone.fr/" label="Association Bilan Carbone® (ABC)" source="ABC — Bilan Carbone® v8, formations, labels" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Bases de données facteurs d'émission</div>
            <div className="space-y-2">
              <RefLink href="https://base-empreinte.ademe.fr/" label="Base Carbone® ADEME" source="ADEME — Base française officielle (4 000+ facteurs, accès libre)" />
              <RefLink href="https://www.ipcc.ch/report/ar6-wg1/" label="GIEC 6ᵉ rapport (AR6, 2021)" source="IPCC — PRG des GES et trajectoires climatiques" />
              <RefLink href="https://efrag.org/sustainability-reporting/esrs-standards" label="ESRS — Standards EFRAG" source="EFRAG — Textes officiels ESRS E1 à G1" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Outils et cadres complémentaires</div>
            <div className="space-y-2">
              <RefLink href="https://sciencebasedtargets.org/" label="Science Based Targets initiative (SBTi)" source="SBTi — Validation des objectifs de réduction (+1,5°C)" />
              <RefLink href="https://www.cdp.net/fr" label="CDP (ex Carbon Disclosure Project)" source="CDP — Reporting carbone pour investisseurs et clients" />
              <RefLink href="https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets_fr" label="EU ETS — Système d'échange de quotas UE" source="Commission européenne — Marché carbone obligatoire EU" />
              <RefLink href="https://www.ademe.fr/nos-missions/transition-ecologique/decarbonation-de-leconomie/" label="ADEME — Décarbonation de l'économie" source="ADEME — Guides et outils pratiques (bilans sectoriels, REX)" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Réglementation française</div>
            <div className="space-y-2">
              <RefLink href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043977611" label="Article L229-25 Code de l'environnement" source="Légifrance — Obligation BEGES France (> 500 sal.)" />
              <RefLink href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022L2464" label="Directive CSRD — 2022/2464/UE" source="EUR-Lex — Texte officiel CSRD" />
              <RefLink href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32023R2772" label="Règlement ESRS — Acte délégué 2023/2772" source="EUR-Lex — ESRS complets (E1 à G1)" />
            </div>
          </div>
        </div>
      ),
    },
  ]

  const QUIZ_BASES = [
    {
      q: 'Que signifie "tCO₂e" ?',
      options: [
        'Tonne de CO₂ exportée',
        'Tonne de CO₂ équivalent (tous GES convertis en CO₂)',
        'Taux de CO₂ dans l\'atmosphère exprimé en %',
        'Total carbone organisationnel estimé',
      ],
      correct: 1,
      explanation: 'Le "e" signifie "équivalent" : tous les gaz à effet de serre (CO₂, CH₄, N₂O, HFC...) sont convertis en CO₂ équivalent via leur Potentiel de Réchauffement Global (PRG sur 100 ans).',
    },
    {
      q: 'Un litre de gazole génère environ :',
      options: ['0,27 kgCO₂e', '2,67 kgCO₂e', '26,7 kgCO₂e', '267 gCO₂e'],
      correct: 1,
      explanation: 'Le facteur d\'émission du gazole est 0,00267 tCO₂e/L = 2,67 kgCO₂e/L (Base Carbone® ADEME 2023). Pour 10 000 L de gazole : 26,7 tCO₂e.',
    },
    {
      q: 'Le Scope 2 couvre :',
      options: [
        'Les émissions des voitures de société',
        'Les émissions liées à l\'énergie achetée (électricité, chaleur)',
        'Les déplacements domicile-travail des salariés',
        'Les émissions des fournisseurs de matières premières',
      ],
      correct: 1,
      explanation: 'Le Scope 2 = énergie indirecte achetée (électricité, chaleur, vapeur, froid). Les voitures de société = Scope 1. Les déplacements domicile-travail = Scope 3 cat. 7. Les fournisseurs = Scope 3 cat. 1.',
    },
    {
      q: 'Le Scope 3 représente typiquement quelle part des émissions d\'une entreprise de services ?',
      options: ['10 à 20%', '30 à 50%', '70 à 95%', 'Moins de 10%'],
      correct: 2,
      explanation: 'Pour les entreprises de services (conseil, finance, tertiaire), le Scope 3 représente souvent 70 à 95% du total — principalement via les achats (cat.1), les déplacements professionnels (cat.6) et la pendularité (cat.7).',
    },
    {
      q: 'Quelle méthode est obligatoire pour les grandes entreprises européennes à partir de l\'exercice 2024 ?',
      options: ['GHG Protocol uniquement', 'Bilan Carbone® ADEME', 'CSRD / ESRS E1', 'ISO 14064-1'],
      correct: 2,
      explanation: 'La directive CSRD (2022/2464/UE) impose le standard ESRS E1 pour les grandes entreprises EU dès l\'exercice 2024 (rapport publié en 2025). Elle intègre le calcul GHG Protocol mais impose des disclosures supplémentaires (E1-4 à E1-9).',
    },
  ]

  const QUIZ_AVANCE = [
    {
      q: 'Quelle est la différence entre méthode "location-based" et "market-based" pour le Scope 2 ?',
      options: [
        'Location-based = émissions sur site · Market-based = émissions hors site',
        'Location-based = facteur réseau national · Market-based = facteur lié aux contrats (PPA, GO)',
        'Location-based = calcul estimatif · Market-based = mesure directe',
        'Location-based = obligatoire · Market-based = optionnel',
      ],
      correct: 1,
      explanation: 'Location-based utilise le facteur moyen du réseau (ex: France 52 gCO₂e/kWh). Market-based utilise le facteur du contrat d\'approvisionnement (PPA éolien ≈ 4 gCO₂e/kWh). La CSRD exige les deux méthodes pour ESRS E1-6.',
    },
    {
      q: 'Le PRG du R410A (fluide frigorigène courant) est de 2 088. Cela signifie que :',
      options: [
        '1 kg de R410A coûte 2 088 € à compenser',
        '1 kg de R410A provoque le même réchauffement que 2 088 kg de CO₂',
        'Le R410A représente 2 088 grammes de CO₂ par litre',
        'Il faut 2 088 ans pour que le R410A se dégrade dans l\'atmosphère',
      ],
      correct: 1,
      explanation: 'Le PRG (Potentiel de Réchauffement Global sur 100 ans) mesure l\'impact d\'un gaz relativement au CO₂. Avec PRG = 2 088, fuite de 1 kg de R410A = 2,088 tCO₂e. Une simple recharge de 5 kg de clim = 10,44 tCO₂e, équivalent à ~4 000 km en voiture essence.',
    },
    {
      q: 'La "double matérialité" dans le contexte CSRD désigne :',
      options: [
        'Le fait que les émissions Scope 1 et Scope 2 sont toutes les deux obligatoires',
        'L\'analyse combinée de l\'impact de l\'entreprise sur le climat ET des risques climatiques sur l\'entreprise',
        'La double vérification des données par deux auditeurs indépendants',
        'Le fait de déclarer les émissions en tCO₂e ET en kgCO₂e',
      ],
      correct: 1,
      explanation: 'La double matérialité CSRD combine : (1) matérialité d\'impact = comment l\'entreprise affecte le climat, et (2) matérialité financière = comment le changement climatique affecte l\'entreprise (risques physiques, transition). Cette analyse détermine quels ESRS sont applicables.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎓</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Guide & Formation Bilan GES</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tout ce qu'il faut savoir pour réaliser un bilan GES rigoureux — concepts fondamentaux,
          méthodes, facteurs d'émission, obligations CSRD, et quiz d'auto-évaluation.
        </p>
      </div>

      {/* Chapitres */}
      <Accordion sections={GUIDE_SECTIONS} />

      {/* Formation / Quiz */}
      <div className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧩</span>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Formation — Quiz d'auto-évaluation</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Testez vos connaissances sur le bilan GES</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setQuizSection(quizSection === 'bases' ? null : 'bases')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              quizSection === 'bases'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600'
            }`}
          >
            📗 Niveau 1 — Les bases ({QUIZ_BASES.length} questions)
          </button>
          <button
            onClick={() => setQuizSection(quizSection === 'avance' ? null : 'avance')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              quizSection === 'avance'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600'
            }`}
          >
            📘 Niveau 2 — Avancé ({QUIZ_AVANCE.length} questions)
          </button>
        </div>
        {quizSection === 'bases' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Cliquez sur une réponse pour voir la correction :</div>
            {QUIZ_BASES.map((q, i) => <QuizQuestion key={i} {...q} />)}
          </div>
        )}
        {quizSection === 'avance' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Cliquez sur une réponse pour voir la correction :</div>
            {QUIZ_AVANCE.map((q, i) => <QuizQuestion key={i} {...q} />)}
          </div>
        )}
      </div>

      {/* Checklist démarrage */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">✅</span>
          <h3 className="font-bold text-gray-900 dark:text-white">Checklist — Démarrer un bilan GES</h3>
        </div>
        <div className="space-y-1.5">
          {[
            { step: '1', text: 'Définir le périmètre organisationnel (quelles entités inclure — consolidation financière ou contrôle opérationnel ?)' },
            { step: '2', text: 'Définir l\'année de référence (exercice N) et l\'année baseline (référence pour les objectifs)' },
            { step: '3', text: 'Choisir la méthode : GHG Protocol (international), Bilan Carbone® (France), CSRD/ESRS E1 (obligation UE)' },
            { step: '4', text: 'Collecter les données Scope 1 : factures énergie, carnets maintenance véhicules et frigorigènes' },
            { step: '5', text: 'Collecter les données Scope 2 : factures électricité, contrats énergie (PPA, GO pour market-based)' },
            { step: '6', text: 'Identifier les catégories Scope 3 pertinentes pour votre secteur (au moins cat. 1, 6, 7 pour les services)' },
            { step: '7', text: 'Collecter les données Scope 3 : notes de frais, données RH (effectifs, modes de transport), achats (€ HT par catégorie)' },
            { step: '8', text: 'Vérifier la cohérence des résultats (ratio tCO₂e/employé, comparaison benchmarks sectoriels)' },
            { step: '9', text: 'Définir des objectifs de réduction (SBTi recommandé : -42% S1+2 / -25% S3 d\'ici 2030 vs 2019)' },
            { step: '10', text: 'Elaborer un plan d\'action priorisé sur les postes les plus importants' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3 py-1.5">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Vue session ──────────────────────────────────────────────────────────────

function SessionView({
  session: initial,
  onBack,
}: {
  session: GESSessionData
  onBack: () => void
}) {
  const [session, setSession] = useState<GESSessionData>(initial)
  const [tab, setTab] = useState<Tab>('synthese')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback((updated: GESSessionData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bilan-ges/sessions/${updated.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope1: updated.scope1,
            scope2: updated.scope2,
            scope3: updated.scope3,
            esrs_e1: updated.esrs_e1,
            objectif: updated.objectif,
            total_scope1: updated.total_scope1,
            total_scope2: updated.total_scope2,
            total_scope3: updated.total_scope3,
            total_global:  updated.total_global,
            notes: updated.notes,
          }),
        })
        setSaveState(res.ok ? 'saved' : 'error')
        setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('error')
      }
    }, 1500)
  }, [])

  function updateSession(patch: Partial<GESSessionData>) {
    setSession(prev => {
      const next = computeSessionTotals({ ...prev, ...patch })
      scheduleSave(next)
      return next
    })
  }

  // ── Scope 1 ──
  function addScope1Entry() {
    const e = newEntry('scope1')
    updateSession({ scope1: { ...session.scope1, entries: [...session.scope1.entries, e] } })
  }
  function updateScope1Entry(updated: GESEntry) {
    updateSession({ scope1: { ...session.scope1, entries: session.scope1.entries.map(e => e.id === updated.id ? updated : e) } })
  }
  function deleteScope1Entry(id: string) {
    updateSession({ scope1: { ...session.scope1, entries: session.scope1.entries.filter(e => e.id !== id) } })
  }

  // ── Scope 2 ──
  function addScope2Entry() {
    const e = newEntry('scope2')
    updateSession({ scope2: { ...session.scope2, entries: [...session.scope2.entries, e] } })
  }
  function updateScope2Entry(updated: GESEntry) {
    updateSession({ scope2: { ...session.scope2, entries: session.scope2.entries.map(e => e.id === updated.id ? updated : e) } })
  }
  function deleteScope2Entry(id: string) {
    updateSession({ scope2: { ...session.scope2, entries: session.scope2.entries.filter(e => e.id !== id) } })
  }

  // ── Scope 3 ──
  function addScope3Entry(cat: S3CatId) {
    const sources = getSourcesByS3Cat(cat)
    const first = sources[0]
    const e: GESEntry = {
      id: makeid(),
      source_id: first?.id ?? null,
      source_label: first?.label ?? '',
      subcategory: first?.subcategory ?? '',
      s3_cat: cat,
      quantity: 0,
      unit: first?.unit ?? '',
      factor: first?.factor ?? 0,
      factor_custom: false,
      total_tco2e: 0,
      lieu: '',
      notes: '',
    }
    updateSession({ scope3: { ...session.scope3, entries: [...session.scope3.entries, e] } })
  }
  function updateScope3Entry(updated: GESEntry) {
    updateSession({ scope3: { ...session.scope3, entries: session.scope3.entries.map(e => e.id === updated.id ? updated : e) } })
  }
  function deleteScope3Entry(id: string) {
    updateSession({ scope3: { ...session.scope3, entries: session.scope3.entries.filter(e => e.id !== id) } })
  }
  function toggleCat(cat: S3CatId, pertinent: boolean) {
    const cp = { ...session.scope3.categories_pertinentes }
    if (!pertinent) cp[cat] = false
    else delete cp[cat]
    updateSession({ scope3: { ...session.scope3, categories_pertinentes: cp } })
  }

  const TABS: { id: Tab; label: string; color?: string }[] = [
    { id: 'synthese', label: '📊 Synthèse' },
    { id: 'scope1',   label: '🔴 Scope 1' },
    { id: 'scope2',   label: '🟡 Scope 2' },
    { id: 'scope3',   label: '🔵 Scope 3' },
    ...(session.methode === 'csrd_esrs' ? [{ id: 'esrs' as Tab, label: '📋 ESRS E1' }] : []),
    { id: 'guide',    label: '📚 Guide' },
  ]

  const methode = GES_METHODES[session.methode]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
            ← Retour
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{session.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{session.organisation} · {session.exercice}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${
            session.methode === 'csrd_esrs' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
            : session.methode === 'bilan_carbone' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
          }`}>
            {methode.label}
          </span>
          <span className={`text-xs ${saveState === 'saving' ? 'text-amber-500' : saveState === 'saved' ? 'text-emerald-500' : saveState === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
            {saveState === 'saving' ? '⏳ Sauvegarde...' : saveState === 'saved' ? '✓ Sauvegardé' : saveState === 'error' ? '✗ Erreur' : ''}
          </span>
        </div>
      </div>

      {/* Total rapide */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap gap-4 items-center">
        {[
          { label: 'Scope 1', val: session.total_scope1, color: 'text-red-600 dark:text-red-400' },
          { label: 'Scope 2', val: session.total_scope2, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Scope 3', val: session.total_scope3, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'TOTAL',   val: session.total_global,  color: 'text-gray-900 dark:text-white font-bold text-base' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            <span className={`text-sm tabular-nums ${color}`}>{formatTCO2e(val)}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="min-h-64">
        {tab === 'synthese' && (
          <SyntheseTab
            session={session}
            onUpdateObjectif={o => updateSession({ objectif: o })}
          />
        )}

        {tab === 'scope1' && (
          <ScopeTab
            scopeId="scope1"
            entries={session.scope1.entries}
            total={session.total_scope1}
            sessionId={session.id}
            onAdd={addScope1Entry}
            onUpdate={updateScope1Entry}
            onDelete={deleteScope1Entry}
          />
        )}

        {tab === 'scope2' && (
          <ScopeTab
            scopeId="scope2"
            entries={session.scope2.entries}
            total={session.total_scope2}
            sessionId={session.id}
            onAdd={addScope2Entry}
            onUpdate={updateScope2Entry}
            onDelete={deleteScope2Entry}
            extra={
              <div className="flex items-center gap-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900 px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Méthode Scope 2 :</span>
                {(['location', 'market'] as const).map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="methode_s2"
                      value={m}
                      checked={session.scope2.methode_s2 === m}
                      onChange={() => updateSession({ scope2: { ...session.scope2, methode_s2: m } })}
                      className="accent-orange-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {m === 'location' ? '📍 Localisation (réseau)' : '🏷️ Marché (contrats)'}
                    </span>
                  </label>
                ))}
              </div>
            }
          />
        )}

        {tab === 'scope3' && (
          <Scope3Tab
            scope3={session.scope3}
            total={session.total_scope3}
            sessionId={session.id}
            onAddEntry={addScope3Entry}
            onUpdateEntry={updateScope3Entry}
            onDeleteEntry={deleteScope3Entry}
            onToggleCat={toggleCat}
          />
        )}

        {tab === 'esrs' && session.methode === 'csrd_esrs' && session.esrs_e1 && (
          <ESRSE1Tab
            esrs={session.esrs_e1}
            total1={session.total_scope1}
            total2={session.total_scope2}
            total3={session.total_scope3}
            onChange={esrs => updateSession({ esrs_e1: esrs })}
          />
        )}

        {tab === 'guide' && <GuideFormationTab />}
      </div>
    </div>
  )
}

// ─── Modal nouvelle session ───────────────────────────────────────────────────

function NewSessionModal({
  onClose, onCreate, defaultOrganisation, defaultExercice,
}: {
  onClose: () => void
  onCreate: (data: { name: string; organisation: string; secteur: string; exercice: string; methode: GESMethode }) => void
  defaultOrganisation?: string
  defaultExercice?: string
}) {
  const [form, setForm] = useState({
    name: '',
    organisation: defaultOrganisation ?? '',
    secteur: '',
    exercice: defaultExercice ?? new Date().getFullYear().toString(),
    methode: 'ghg_protocol' as GESMethode,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.organisation.trim()) return
    onCreate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nouvelle session Bilan GES</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de la session *</label>
            <input
              autoFocus type="text" required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Bilan GES 2024 — Siège"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organisation *</label>
            <input
              type="text" required
              value={form.organisation}
              onChange={e => setForm({ ...form, organisation: e.target.value })}
              placeholder="Nom de votre entreprise"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secteur</label>
              <input
                type="text"
                value={form.secteur}
                onChange={e => setForm({ ...form, secteur: e.target.value })}
                placeholder="ex: Services, Industrie..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercice</label>
              <input
                type="text"
                value={form.exercice}
                onChange={e => setForm({ ...form, exercice: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Méthode *</label>
            <div className="space-y-2">
              {(Object.keys(GES_METHODES) as GESMethode[]).map(m => (
                <label key={m} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  form.methode === m
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}>
                  <input
                    type="radio" name="methode" value={m}
                    checked={form.methode === m}
                    onChange={() => setForm({ ...form, methode: m })}
                    className="accent-emerald-600 mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{GES_METHODES[m].label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{GES_METHODES[m].description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={!form.name.trim() || !form.organisation.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              Créer la session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function BilanGesCalculateur({ org, year }: { org: Organisation | null; year: number }) {
  const [sessions, setSessions] = useState<GESSessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState<GESSessionData | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    fetch('/api/bilan-ges/sessions')
      .then(r => r.json())
      .then(d => setSessions(d.data ?? []))
      .catch(() => setError('Impossible de charger les sessions'))
      .finally(() => setLoading(false))
  }, [])

  async function createSession(form: { name: string; organisation: string; secteur: string; exercice: string; methode: GESMethode }) {
    setCreating(true)
    try {
      const res = await fetch('/api/bilan-ges/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, organisation_id: org?.id ?? null }),
      })
      const { data, error: err } = await res.json()
      if (err) throw new Error(err)
      setSessions(prev => [data, ...prev])
      setActiveSession(data)
      setShowNew(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création')
    } finally {
      setCreating(false)
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('Supprimer cette session ?')) return
    await fetch(`/api/bilan-ges/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSession?.id === id) setActiveSession(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 dark:text-gray-600">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-pulse">🌍</div>
          <div className="text-sm">Chargement des sessions...</div>
        </div>
      </div>
    )
  }

  if (showGuide) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowGuide(false)}
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          ← Retour aux sessions
        </button>
        <GuideFormationTab />
      </div>
    )
  }

  if (activeSession) {
    return (
      <SessionView
        session={activeSession}
        onBack={() => {
          // Rafraîchit la liste à la sortie
          fetch('/api/bilan-ges/sessions')
            .then(r => r.json())
            .then(d => setSessions(d.data ?? []))
          setActiveSession(null)
        }}
      />
    )
  }

  return (
    <>
      {showNew && (
        <NewSessionModal
          onClose={() => setShowNew(false)}
          onCreate={createSession}
          defaultOrganisation={org?.denomination ?? ''}
          defaultExercice={String(year)}
        />
      )}

      <div className="space-y-6">
        {/* Hero */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🌍</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">🧮 Calculateur Bilan GES</h2>
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-0.5">
                Calculez vos émissions de gaz à effet de serre — Scopes 1, 2 et 3 — selon le GHG Protocol, le Bilan Carbone® ADEME ou les exigences CSRD/ESRS E1.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400 font-medium">
              🔵 GHG Protocol · Bilan Carbone® · CSRD
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              🌿 Facteurs ADEME Base Carbone 2023
            </span>
          </div>
        </div>

        {/* Info méthodes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(GES_METHODES) as [GESMethode, typeof GES_METHODES[GESMethode]][]).map(([key, m]) => (
            <div key={key} className={`rounded-xl border p-4 ${
              key === 'csrd_esrs' ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'
              : key === 'bilan_carbone' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
              : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
            }`}>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">{m.label}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{m.description}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">{sessions.length}</span> session{sessions.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 text-sm font-medium transition-colors"
            >
              📚 Guide & Formation
            </button>
            <button
              onClick={() => setShowNew(true)}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              + Nouveau bilan GES
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Liste sessions */}
        {sessions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <div className="text-5xl mb-4">🌍</div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Aucune session Bilan GES</h3>
            <p className="text-sm mb-6">Créez votre premier bilan carbone en cliquant sur "+ Nouveau bilan GES"</p>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
            >
              + Créer mon premier bilan GES
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map(s => {
              const methode = GES_METHODES[s.methode as GESMethode] ?? GES_METHODES.ghg_protocol
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSession(s)}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{s.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.organisation} · {s.exercice}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        s.methode === 'csrd_esrs' ? 'border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                        : s.methode === 'bilan_carbone' ? 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      }`}>
                        {methode.label}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Totaux */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'S1', val: s.total_scope1, color: 'text-red-600 dark:text-red-400' },
                      { label: 'S2', val: s.total_scope2, color: 'text-orange-600 dark:text-orange-400' },
                      { label: 'S3', val: s.total_scope3, color: 'text-blue-600 dark:text-blue-400' },
                      { label: 'Total', val: s.total_global, color: 'text-gray-900 dark:text-white font-semibold' },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <div className="text-xs text-gray-400 dark:text-gray-600">{label}</div>
                        <div className={`text-xs ${color} tabular-nums`}>{formatTCO2e(val)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bar totale */}
                  {s.total_global > 0 && (
                    <div className="mt-3">
                      <div className="h-2 flex rounded-full overflow-hidden gap-0.5">
                        {s.total_scope1 > 0 && <div className="bg-red-500"    style={{ flex: s.total_scope1 }} />}
                        {s.total_scope2 > 0 && <div className="bg-orange-500" style={{ flex: s.total_scope2 }} />}
                        {s.total_scope3 > 0 && <div className="bg-blue-500"   style={{ flex: s.total_scope3 }} />}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
