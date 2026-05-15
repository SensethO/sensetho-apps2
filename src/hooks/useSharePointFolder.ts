'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Navigue (ou crée) un chemin de dossiers dans SharePoint.
 * Retourne l'ID du dossier final.
 *
 * @example
 * const { folderId, loading } = useSharePointFolder(['General', 'SCDB Pro', '2025', 'diagnostic-initial'])
 */
export function useSharePointFolder(path: string[] | null) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const resolve = useCallback(async (segments: string[]) => {
    setLoading(true)
    setError(null)
    try {
      let currentId: string | null = null
      for (const name of segments) {
        // Liste le contenu du dossier courant
        const url = currentId
          ? `/api/sharepoint/files?folder=${currentId}`
          : '/api/sharepoint/files'
        const res  = await fetch(url)
        if (!res.ok) throw new Error(`Erreur liste SharePoint (${res.status})`)
        const items = await res.json() as Array<{ id: string; name: string; folder?: unknown }>
        const existing = items.find(i => i.folder && i.name === name)
        if (existing) {
          currentId = existing.id
        } else {
          // Créer le dossier
          const cr: Response = await fetch('/api/sharepoint/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: currentId, name }),
          })
          if (!cr.ok) throw new Error(`Impossible de créer le dossier "${name}"`)
          const created: { id: string } = await cr.json()
          currentId = created.id
        }
      }
      setFolderId(currentId)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (path && path.length > 0) resolve(path)
    else setFolderId(null)
  }, [path?.join('/') ?? '']) // eslint-disable-line react-hooks/exhaustive-deps

  return { folderId, loading, error }
}
