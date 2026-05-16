'use client'

import { useRef, useState } from 'react'

export interface Attachment {
  id: string
  name: string
  sharepoint_item_id: string
  mime: string | null
  size: number | null
}

interface Props {
  diagnosticId: string
  actionKey: string
  note: string
  readOnly: boolean
  onNoteChange: (v: string) => void
  attachments: Attachment[]
  onAttachmentAdded: (a: Attachment) => void
  onAttachmentRemoved: (id: string) => void
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function mimeIcon(mime: string | null): string {
  if (!mime) return '📎'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊'
  if (mime.startsWith('text/')) return '📃'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️'
  return '📎'
}

export default function GuidedActionNotePanel({
  diagnosticId,
  actionKey,
  note,
  readOnly,
  onNoteChange,
  attachments,
  onAttachmentAdded,
  onAttachmentRemoved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('action_key', actionKey)

      const res = await fetch(`/api/guided-diagnostic/${diagnosticId}/notes/upload`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'Erreur lors de l\'upload')
        return
      }
      onAttachmentAdded(json.data as Attachment)
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setUploading(false)
      // Reset input so same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(att: Attachment) {
    try {
      const res = await fetch(
        `/api/guided-diagnostic/${diagnosticId}/notes/signed-url?item_id=${encodeURIComponent(att.sharepoint_item_id)}`
      )
      const json = await res.json()
      if (!res.ok || !json.url) {
        console.error('[download] error', json.error)
        return
      }
      // Ouvrir dans un nouvel onglet — le navigateur déclenchera le téléchargement
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[download] exception', err)
    }
  }

  async function handleDelete(att: Attachment) {
    if (deletingId) return
    setDeletingId(att.id)
    try {
      const res = await fetch(
        `/api/guided-diagnostic/${diagnosticId}/notes/attachment?attachment_id=${encodeURIComponent(att.id)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const json = await res.json()
        console.error('[delete] error', json.error)
        return
      }
      onAttachmentRemoved(att.id)
    } catch (err) {
      console.error('[delete] exception', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="px-2 pb-2 flex flex-col gap-2">
      {/* Note texte */}
      <textarea
        readOnly={readOnly}
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Notes, observations, pièces justificatives…"
        rows={3}
        className="w-full text-xs p-2 rounded border resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />

      {/* Upload */}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}
          >
            {uploading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                📎 Joindre un fichier
              </>
            )}
          </button>
          {uploadError && (
            <span className="text-xs text-red-500 flex-1 truncate">{uploadError}</span>
          )}
        </div>
      )}

      {/* Liste des pièces jointes */}
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1">
          {attachments.map(att => (
            <li
              key={att.id}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <span className="shrink-0">{mimeIcon(att.mime)}</span>
              <span className="flex-1 truncate" style={{ color: 'var(--text)' }} title={att.name}>
                {att.name}
              </span>
              {att.size !== null && att.size > 0 && (
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {formatSize(att.size)}
                </span>
              )}
              {/* Télécharger */}
              <button
                type="button"
                onClick={() => handleDownload(att)}
                className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
                title="Télécharger"
                style={{ color: '#6366f1' }}
              >
                ⬇
              </button>
              {/* Supprimer */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  disabled={deletingId === att.id}
                  className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity disabled:opacity-40"
                  title="Supprimer"
                  style={{ color: '#ef4444' }}
                >
                  {deletingId === att.id ? '…' : '✕'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
