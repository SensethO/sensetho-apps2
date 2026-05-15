'use client'

import { useRef, useState, useCallback } from 'react'
import Icon from './Icon'

interface UploadedFile {
  id: string
  name: string
  size: number
  mimeType: string
  downloadUrl: string
}

interface FileUploadProps {
  /** ID du dossier SharePoint destination */
  folderId: string | null
  /** Fichiers déjà uploadés */
  value?: UploadedFile[]
  onChange?: (files: UploadedFile[]) => void
  /** Taille max en Mo */
  maxSizeMb?: number
  accept?: string
  label?: string
  readOnly?: boolean
}

const CHUNK = 10 * 1024 * 1024

async function uploadChunked(file: File, uploadUrl: string, onProgress: (p: number) => void) {
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
        'Content-Length': String(end - offset),
      },
      body: file.slice(offset, end),
    })
    if (res.status === 202) { offset = end; onProgress(Math.round((offset / file.size) * 100)) }
    else if (res.status === 201 || res.status === 200) { onProgress(100); return await res.json() }
    else throw new Error(`Upload échoué (${res.status})`)
  }
}

export default function FileUpload({
  folderId,
  value = [],
  onChange,
  maxSizeMb = 100,
  accept,
  label = 'Déposer des fichiers ou cliquer pour sélectionner',
  readOnly = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])
  const [dragging, setDragging]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const dragCount = useRef(0)

  const upload = useCallback(async (files: File[]) => {
    if (!folderId) { setError('Dossier destination non disponible'); return }
    setError(null)
    for (const file of files) {
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`${file.name} dépasse la limite de ${maxSizeMb} Mo`)
        continue
      }
      setUploading(prev => [...prev, { name: file.name, progress: 0 }])
      try {
        const sessRes = await fetch('/api/sharepoint/upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: folderId, filename: file.name, size: file.size }),
        })
        if (!sessRes.ok) throw new Error('Impossible de créer la session upload')
        const { uploadUrl } = await sessRes.json()
        const item = await uploadChunked(file, uploadUrl, progress => {
          setUploading(prev => prev.map(u => u.name === file.name ? { ...u, progress } : u))
        })
        if (item && onChange) {
          onChange([...value, {
            id: item.id,
            name: item.name,
            size: item.size,
            mimeType: item.file?.mimeType ?? 'application/octet-stream',
            downloadUrl: item['@microsoft.graph.downloadUrl'] ?? '',
          }])
        }
      } catch (e: unknown) {
        setError((e as Error).message)
      } finally {
        setUploading(prev => prev.filter(u => u.name !== file.name))
      }
    }
  }, [folderId, maxSizeMb, value, onChange])

  function onDragEnter(e: React.DragEvent) { e.preventDefault(); dragCount.current++; setDragging(true) }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); if (--dragCount.current === 0) setDragging(false) }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); dragCount.current = 0; setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) upload(files)
  }

  function removeFile(id: string) {
    if (onChange) onChange(value.filter(f => f.id !== id))
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Zone de dépôt */}
      {!readOnly && (
        <div
          onClick={() => folderId && inputRef.current?.click()}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors ${folderId ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${dragging ? 'border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10' : 'hover:border-indigo-300'}`}
          style={{ borderColor: dragging ? undefined : 'var(--border)' }}
        >
          <Icon name="upload" size={20} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {folderId ? label : 'Chargement du dossier…'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Max {maxSizeMb} Mo par fichier</p>
          <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
            onChange={e => e.target.files && upload(Array.from(e.target.files))} />
        </div>
      )}

      {/* Uploads en cours */}
      {uploading.map(u => (
        <div key={u.name} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
          <Icon name="upload" size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="flex-1 text-xs truncate" style={{ color: 'var(--text)' }}>{u.name}</span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${u.progress}%`, backgroundColor: 'var(--accent)' }} />
          </div>
          <span className="text-xs tabular-nums w-8" style={{ color: 'var(--text-muted)' }}>{u.progress}%</span>
        </div>
      ))}

      {/* Erreur */}
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}

      {/* Fichiers uploadés */}
      {value.length > 0 && (
        <ul className="flex flex-col gap-1">
          {value.map(f => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg group" style={{ backgroundColor: 'var(--bg)' }}>
              <Icon name={f.mimeType.startsWith('image/') ? 'image' : f.mimeType.startsWith('video/') ? 'video' : 'fileText'} size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="flex-1 text-xs truncate" style={{ color: 'var(--text)' }}>{f.name}</span>
              <a
                href={`/api/sharepoint/download?id=${f.id}`}
                download={f.name}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
                onClick={e => e.stopPropagation()}
              >
                <Icon name="download" size={13} />
              </a>
              {!readOnly && (
                <button
                  onClick={() => removeFile(f.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
