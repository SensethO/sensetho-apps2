'use client'

import { useEffect } from 'react'

interface FileViewerModalProps {
  url: string
  name: string
  mime: string
  onClose: () => void
}

export default function FileViewerModal({ url, name, mime, onClose }: FileViewerModalProps) {
  const isImage  = mime.startsWith('image/')
  const isPdf    = mime === 'application/pdf'
  const isWord   = mime.includes('word') || mime.includes('opendocument.text')
  const isExcel  = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet')
  const isOffice = isWord || isExcel

  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[80%]">{name}</p>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={name}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition"
            >
              ⬇ Télécharger
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg font-light"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto min-h-0">
          {isImage && (
            <div className="flex items-center justify-center p-4 min-h-[400px] bg-gray-50 dark:bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg" />
            </div>
          )}
          {isPdf && (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              className="w-full min-h-[75vh]"
              style={{ height: '75vh' }}
              title={name}
            />
          )}
          {isOffice && (
            <iframe
              src={officeUrl}
              className="w-full min-h-[75vh]"
              style={{ height: '75vh' }}
              title={name}
              allowFullScreen
            />
          )}
          {!isImage && !isPdf && !isOffice && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="text-6xl">📎</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{name}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                ↗ Ouvrir dans un nouvel onglet
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
