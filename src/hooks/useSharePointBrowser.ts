'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface SPItem {
  id: string
  name: string
  size?: number
  createdDateTime: string
  lastModifiedDateTime: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  parentReference?: { id: string; name: string }
  '@microsoft.graph.downloadUrl'?: string
}

interface Crumb {
  id: string | null
  name: string
}

interface UploadState {
  name: string
  progress: number
  done: boolean
  error?: string
}

interface UseSharePointBrowserOptions {
  apiBase?: string
  rootFolderName?: string
  rootFolderId?: string | null
}

const CHUNK = 10 * 1024 * 1024

async function uploadChunked(
  file: File,
  uploadUrl: string,
  onProgress: (p: number) => void
): Promise<SPItem> {
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
    if (res.status === 202) {
      offset = end
      onProgress(Math.round((offset / file.size) * 100))
    } else if (res.status === 201 || res.status === 200) {
      onProgress(100)
      return await res.json()
    } else {
      throw new Error(`Upload échoué (${res.status})`)
    }
  }
  throw new Error('Upload incomplet')
}

export function useSharePointBrowser({ apiBase = '/api/sharepoint', rootFolderName = 'General', rootFolderId }: UseSharePointBrowserOptions = {}) {
  // Navigation stack: array of { id, name } — null id = root
  const [stack, setStack] = useState<Crumb[]>(
    rootFolderId ? [{ id: rootFolderId, name: rootFolderName }] : []
  )
  const [items, setItems] = useState<SPItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploads, setUploads] = useState<UploadState[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Drag & drop
  const [dragging, setDragging] = useState(false)
  const dragCount = useRef(0)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragItem = useRef<SPItem | null>(null)

  // New folder
  const [newFolder, setNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  // Rename
  const [renameTarget, setRenameTarget] = useState<SPItem | null>(null)
  const [renameName, setRenameName] = useState('')

  // Delete confirm
  const [confirmDel, setConfirmDel] = useState<SPItem | null>(null)

  // Move modal
  const [moveTarget, setMoveTarget] = useState<SPItem | null>(null)
  const [modalFolder, setModalFolder] = useState<Crumb | null>(null)
  const [modalStack, setModalStack] = useState<Crumb[]>([])
  const [modalItems, setModalItems] = useState<SPItem[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  const currentId = stack.length > 0 ? stack[stack.length - 1].id : null

  // Fetch items for current folder
  const fetchItems = useCallback(async (folderId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = folderId
        ? `${apiBase}/files?folder=${folderId}`
        : `${apiBase}/files`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erreur liste (${res.status})`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  // Initial load and reload when stack changes
  useEffect(() => {
    fetchItems(currentId)
  }, [currentId, fetchItems])

  // Navigate into a folder
  const openFolder = useCallback((item: SPItem) => {
    setStack(prev => [...prev, { id: item.id, name: item.name }])
    setNewFolder(false)
    setFolderName('')
  }, [])

  // Navigate to a breadcrumb index (-1 = root)
  const navTo = useCallback((index: number) => {
    if (index < 0) {
      setStack([])
    } else {
      setStack(prev => prev.slice(0, index + 1))
    }
    setNewFolder(false)
  }, [])

  // Breadcrumbs
  const crumbs = stack

  // Create folder
  const createFolder = useCallback(async () => {
    if (!folderName.trim()) return
    try {
      const res = await fetch(`${apiBase}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: currentId, name: folderName.trim() }),
      })
      if (!res.ok) throw new Error('Création échouée')
      setNewFolder(false)
      setFolderName('')
      fetchItems(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }, [apiBase, currentId, folderName, fetchItems])

  // Upload files
  const handleFiles = useCallback(async (files: FileList) => {
    const fileArr = Array.from(files)
    for (const file of fileArr) {
      setUploads(prev => [...prev, { name: file.name, progress: 0, done: false }])
      try {
        const sessRes = await fetch(`${apiBase}/upload-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: currentId, filename: file.name, size: file.size }),
        })
        if (!sessRes.ok) throw new Error('Session upload échouée')
        const { uploadUrl } = await sessRes.json()
        await uploadChunked(file, uploadUrl, progress => {
          setUploads(prev => prev.map(u => u.name === file.name ? { ...u, progress } : u))
        })
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, done: true } : u))
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.name !== file.name))
        }, 2000)
        fetchItems(currentId)
      } catch (e: unknown) {
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, error: (e as Error).message } : u))
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.name !== file.name))
        }, 4000)
      }
    }
    // Reset input
    if (fileRef.current) fileRef.current.value = ''
  }, [apiBase, currentId, fetchItems])

  // Drag & drop on drop zone
  const onDropZoneEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCount.current++
    setDragging(true)
  }, [])

  const onDropZoneLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (--dragCount.current === 0) setDragging(false)
  }, [])

  const onDropZoneOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCount.current = 0
    setDragging(false)
    const files = e.dataTransfer.files
    if (files.length) handleFiles(files)
  }, [handleFiles])

  // Row drag (for moving files into folders)
  const onRowDragStart = useCallback((e: React.DragEvent, item: SPItem) => {
    dragItem.current = item
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onRowDragEnd = useCallback(() => {
    dragItem.current = null
    setDragOverId(null)
  }, [])

  const onFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(folderId)
  }, [])

  const onFolderDrop = useCallback(async (e: React.DragEvent, folder: SPItem) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    const item = dragItem.current
    if (!item || item.id === folder.id) return
    try {
      const res = await fetch(`${apiBase}/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, destinationFolderId: folder.id }),
      })
      if (!res.ok) throw new Error('Déplacement échoué')
      fetchItems(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }, [apiBase, currentId, fetchItems])

  // Rename
  const openRenameModal = useCallback((item: SPItem) => {
    setRenameTarget(item)
    setRenameName(item.name)
  }, [])

  const confirmRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) return
    try {
      const res = await fetch(`${apiBase}/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: renameTarget.id, name: renameName.trim() }),
      })
      if (!res.ok) throw new Error('Renommage échoué')
      setRenameTarget(null)
      fetchItems(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }, [apiBase, currentId, renameTarget, renameName, fetchItems])

  // Delete
  const deleteItem = useCallback(async (item: SPItem) => {
    try {
      const res = await fetch(`${apiBase}/files?id=${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Suppression échouée')
      }
      setConfirmDel(null)
      fetchItems(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
      setConfirmDel(null)
    }
  }, [apiBase, currentId, fetchItems])

  // Move modal — fetch modal folder contents
  const fetchModalItems = useCallback(async (folderId: string | null) => {
    setModalLoading(true)
    try {
      const url = folderId ? `${apiBase}/files?folder=${folderId}` : `${apiBase}/files`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json() as SPItem[]
      setModalItems(data.filter(i => i.folder))
    } catch {
      setModalItems([])
    } finally {
      setModalLoading(false)
    }
  }, [apiBase])

  const openMoveModal = useCallback((item: SPItem) => {
    setMoveTarget(item)
    const root: Crumb = { id: null, name: 'Racine' }
    setModalStack([])
    setModalFolder(root)
    fetchModalItems(null)
  }, [fetchModalItems])

  const navigateModal = useCallback((folder: SPItem) => {
    const crumb: Crumb = { id: folder.id, name: folder.name }
    setModalStack(prev => [...prev, crumb])
    setModalFolder(crumb)
    fetchModalItems(folder.id)
  }, [fetchModalItems])

  const closeMoveModal = useCallback(() => {
    setMoveTarget(null)
    setModalFolder(null)
    setModalStack([])
    setModalItems([])
  }, [])

  const confirmMove = useCallback(async () => {
    if (!moveTarget || !modalFolder) return
    const destId = modalFolder.id
    if (!destId) return // can't move to root via PATCH without parentReference driveId
    try {
      const res = await fetch(`${apiBase}/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: moveTarget.id, destinationFolderId: destId }),
      })
      if (!res.ok) throw new Error('Déplacement échoué')
      closeMoveModal()
      fetchItems(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }, [apiBase, currentId, moveTarget, modalFolder, fetchItems, closeMoveModal])

  // Separate folders and files
  const folders = items.filter(i => i.folder)
  const files = items.filter(i => !i.folder)

  return {
    // Navigation
    stack,
    crumbs,
    openFolder,
    navTo,
    currentId,
    // Items
    items,
    folders,
    files,
    loading,
    error,
    // Upload
    uploads,
    fileRef,
    handleFiles,
    // Drag zone
    dragging,
    dragOverId,
    onDropZoneEnter,
    onDropZoneLeave,
    onDropZoneOver,
    onDropZoneDrop,
    // Row drag
    onRowDragStart,
    onRowDragEnd,
    onFolderDragOver,
    onFolderDrop,
    // New folder
    newFolder,
    setNewFolder,
    folderName,
    setFolderName,
    createFolder,
    // Rename
    renameTarget,
    renameName,
    setRenameName,
    openRenameModal,
    confirmRename,
    // Delete
    confirmDel,
    setConfirmDel,
    deleteItem,
    // Move modal
    moveTarget,
    modalFolder,
    modalStack,
    modalItems,
    modalLoading,
    openMoveModal,
    navigateModal,
    closeMoveModal,
    confirmMove,
    // Config
    rootFolderName,
  }
}
