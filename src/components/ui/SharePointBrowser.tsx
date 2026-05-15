'use client'

import { useSharePointBrowser } from '@/hooks/useSharePointBrowser'
import type { SPItem } from '@/hooks/useSharePointBrowser'
import Icon from './Icon'
import { useCallback } from 'react'

function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileIcon(item: SPItem) {
  if (item.folder) return 'folder'
  const mime = item.file?.mimeType ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) return 'fileText'
  return 'file'
}

interface SharePointBrowserProps {
  /** Dossier de départ (ex: ID du dossier RSE). Si absent, commence à la racine. */
  rootFolderId?: string | null
  /** Nom du dossier racine protégé */
  rootFolderName?: string
  /** Hauteur max du tableau */
  maxHeight?: string
}

export default function SharePointBrowser({
  rootFolderId: _rootFolderId,
  rootFolderName = 'General',
  maxHeight = '400px',
}: SharePointBrowserProps) {
  const sp = useSharePointBrowser({ apiBase: '/api/sharepoint', rootFolderName })

  const handleDownload = useCallback((item: SPItem) => {
    const a = document.createElement('a')
    a.href = `/api/sharepoint/download?id=${item.id}`
    a.download = item.name
    a.click()
  }, [])

  return (
    <div className="flex flex-col rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>

      {/* ── Barre d'outils ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-1 flex-1 min-w-0 text-xs">
          <button
            onClick={() => sp.navTo(-1)}
            className="hover:opacity-80 font-medium transition-opacity shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            Racine
          </button>
          {sp.crumbs.map((c, i) => (
            <span key={c.id ?? 'root'} className="flex items-center gap-1">
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <button
                onClick={() => sp.navTo(i)}
                className={`hover:opacity-80 transition-opacity truncate max-w-[120px] ${i === sp.crumbs.length - 1 ? 'font-medium' : ''}`}
                style={{ color: i === sp.crumbs.length - 1 ? 'var(--text)' : 'var(--accent)' }}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Nouveau dossier */}
          {sp.newFolder ? (
            <form
              onSubmit={e => { e.preventDefault(); sp.createFolder() }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={sp.folderName}
                onChange={e => sp.setFolderName(e.target.value)}
                placeholder="Nom du dossier"
                className="px-2 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <button type="submit" className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: 'var(--accent)' }}>OK</button>
              <button type="button" onClick={() => sp.setNewFolder(false)} className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>✕</button>
            </form>
          ) : (
            <button
              onClick={() => sp.setNewFolder(true)}
              title="Nouveau dossier"
              className="p-1.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              <Icon name="folderPlus" size={15} />
            </button>
          )}

          {/* Upload fichier */}
          <button
            onClick={() => sp.fileRef.current?.click()}
            title="Envoyer des fichiers"
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon name="upload" size={15} />
          </button>
          <input ref={sp.fileRef} type="file" multiple className="hidden"
            onChange={e => e.target.files && sp.handleFiles(e.target.files)} />
        </div>
      </div>

      {/* ── Zone de dépôt + liste ── */}
      <div
        className={`relative transition-colors ${sp.dragging ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
        style={{ maxHeight, overflowY: 'auto' }}
        onDragEnter={sp.onDropZoneEnter}
        onDragLeave={sp.onDropZoneLeave}
        onDragOver={sp.onDropZoneOver}
        onDrop={sp.onDropZoneDrop}
      >
        {/* Uploads en cours */}
        {sp.uploads.length > 0 && (
          <div className="px-3 py-2 border-b space-y-1" style={{ borderColor: 'var(--border)' }}>
            {sp.uploads.map(u => (
              <div key={u.name} className="flex items-center gap-2">
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text)' }}>{u.name}</span>
                {u.error ? (
                  <span className="text-xs text-red-500">{u.error}</span>
                ) : u.done ? (
                  <Icon name="check" size={13} className="text-green-500" />
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-20 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${u.progress}%`, backgroundColor: 'var(--accent)' }} />
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{u.progress}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contenu */}
        {sp.loading ? (
          <div className="flex items-center justify-center py-10" style={{ color: 'var(--text-muted)' }}>
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : sp.error ? (
          <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--text-muted)' }}>
            <Icon name="alertTriangle" size={16} />
            <span className="text-xs">{sp.error}</span>
          </div>
        ) : sp.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--text-muted)' }}>
            <Icon name="folder" size={32} style={{ opacity: 0.3 }} />
            <span className="text-xs">Dossier vide — glissez des fichiers ici</span>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Nom</th>
                <th className="text-right px-3 py-1.5 font-medium hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Taille</th>
                <th className="text-right px-3 py-1.5 font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Modifié</th>
                <th className="w-16 px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {[...sp.folders, ...sp.files].map(item => (
                <tr
                  key={item.id}
                  draggable={!!item.file}
                  onDragStart={e => sp.onRowDragStart(e, item)}
                  onDragEnd={sp.onRowDragEnd}
                  onDragOver={item.folder ? e => sp.onFolderDragOver(e, item.id) : undefined}
                  onDrop={item.folder ? e => sp.onFolderDrop(e, item) : undefined}
                  className={`border-b last:border-0 transition-colors group ${sp.dragOverId === item.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-black/5 dark:hover:bg-white/5'} ${item.folder ? 'cursor-pointer' : ''}`}
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => item.folder && sp.openFolder(item)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name={fileIcon(item)} size={14} style={{ color: item.folder ? '#f59e0b' : 'var(--text-muted)', flexShrink: 0 }} />
                      {sp.renameTarget?.id === item.id ? (
                        <form onSubmit={e => { e.preventDefault(); sp.confirmRename() }} onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={sp.renameName}
                            onChange={e => sp.setRenameName(e.target.value)}
                            className="px-1 py-0.5 border rounded text-xs focus:outline-none"
                            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--accent)', color: 'var(--text)' }}
                          />
                        </form>
                      ) : (
                        <span className="truncate" style={{ color: 'var(--text)' }}>{item.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {item.folder ? `${item.folder.childCount} élément${item.folder.childCount !== 1 ? 's' : ''}` : formatSize(item.size)}
                  </td>
                  <td className="px-3 py-2 text-right hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(item.lastModifiedDateTime)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.file && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDownload(item) }}
                          title="Télécharger"
                          className="p-1 rounded hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Icon name="download" size={13} />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); sp.openRenameModal(item) }}
                        title="Renommer"
                        className="p-1 rounded hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Icon name="pencil" size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); sp.openMoveModal(item) }}
                        title="Déplacer"
                        className="p-1 rounded hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Icon name="move" size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); sp.setConfirmDel(item) }}
                        title="Supprimer"
                        className="p-1 rounded hover:opacity-70 hover:text-red-500"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Overlay drag */}
        {sp.dragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl bg-white/90 dark:bg-slate-800/90 shadow-lg border-2 border-indigo-400">
              <Icon name="upload" size={24} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Déposer pour envoyer</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal suppression ── */}
      {sp.confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center gap-3">
              <Icon name="alertTriangle" size={20} className="text-red-500 shrink-0" />
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                Supprimer <strong>{sp.confirmDel.name}</strong> ?
                {sp.confirmDel.folder && <span className="text-red-500"> Tout le contenu sera perdu.</span>}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => sp.setConfirmDel(null)} className="px-3 py-1.5 text-xs border rounded-lg" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annuler</button>
              <button onClick={() => sp.deleteItem(sp.confirmDel!)} className="px-3 py-1.5 text-xs rounded-lg text-white bg-red-500 hover:bg-red-600">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal déplacement ── */}
      {sp.moveTarget && sp.modalFolder !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Déplacer — {sp.moveTarget.name}</h3>
              <button onClick={sp.closeMoveModal} style={{ color: 'var(--text-muted)' }}><Icon name="x" size={16} /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Destination : <strong>{sp.modalFolder.name || 'Racine'}</strong></p>
            {sp.modalLoading ? (
              <div className="flex justify-center py-4"><svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
            ) : (
              <ul className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                {sp.modalItems.map(f => (
                  <li key={f.id}>
                    <button
                      onClick={() => sp.navigateModal(f)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:opacity-80 text-left"
                      style={{ color: 'var(--text)' }}
                    >
                      <Icon name="folder" size={14} style={{ color: '#f59e0b' }} />
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={sp.closeMoveModal} className="px-3 py-1.5 text-xs border rounded-lg" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annuler</button>
              <button onClick={sp.confirmMove} className="px-3 py-1.5 text-xs rounded-lg text-white" style={{ backgroundColor: 'var(--accent)' }}>Déplacer ici</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
