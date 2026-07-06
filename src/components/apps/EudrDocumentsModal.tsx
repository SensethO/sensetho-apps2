'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Documents d'une entité EUDR (fournisseur / contrat). Fichiers stockés DANS SharePoint
// (upload navigateur → SharePoint direct, zéro transit serveur) ; métadonnées en base.

interface Doc { id: string; name: string; doc_type: string; mime?: string | null; size?: number | null; created_at?: string }

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'geojson', label: 'Géolocalisation (GeoJSON)' },
  { value: 'questionnaire', label: 'Questionnaire fournisseur' },
  { value: 'certificate', label: 'Certificat' },
  { value: 'ddr', label: 'Diligence raisonnée (DDR)' },
  { value: 'dds', label: 'DDS / confirmation' },
  { value: 'other', label: 'Autre' },
]
const typeLabel = (v: string) => DOC_TYPES.find(t => t.value === v)?.label ?? v

const inputCls = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'

export default function EudrDocumentsModal({ orgId, entityType, entityId, entityLabel, canEdit, onClose }: {
  orgId: string
  entityType: 'supplier' | 'contract'
  entityId: string
  entityLabel: string
  canEdit: boolean
  onClose: () => void
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState('geojson')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/documents?org_id=${orgId}&entity_type=${entityType}&entity_id=${entityId}`)
      const j = await res.json()
      if (res.ok) setDocs(j.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [orgId, entityType, entityId])

  useEffect(() => { load() }, [load])

  async function handleFile(file: File) {
    setUploading(true); setError(null)
    try {
      // 1. Upload session SharePoint (serveur)
      const sRes = await fetch(`/api/eudr-fournisseurs/documents/upload-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, entity_type: entityType, entity_id: entityId, filename: file.name }),
      })
      const sJson = await sRes.json()
      if (!sRes.ok) throw new Error(sJson.error ?? 'Échec upload session')

      // 2. Envoi DIRECT du fichier navigateur → SharePoint (aucun transit serveur)
      const put = await fetch(sJson.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes 0-${file.size - 1}/${file.size}` },
        body: file,
      })
      if (!put.ok) throw new Error('Échec de l’envoi vers SharePoint')
      const item = await put.json() as { id?: string }
      if (!item.id) throw new Error('Réponse SharePoint invalide')

      // 3. Confirmation des métadonnées (serveur)
      const cRes = await fetch(`/api/eudr-fournisseurs/documents/upload-confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, entity_type: entityType, entity_id: entityId, spItemId: item.id, name: sJson.finalName, mime: file.type, size: file.size, doc_type: docType }),
      })
      const cJson = await cRes.json()
      if (!cRes.ok) throw new Error(cJson.error ?? 'Échec enregistrement')
      await load()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function download(id: string) {
    try {
      const res = await fetch(`/api/eudr-fournisseurs/documents/download?org_id=${orgId}&id=${id}`)
      const j = await res.json()
      if (res.ok && j.url) window.open(j.url, '_blank')
      else setError(j.error ?? 'Téléchargement impossible')
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/eudr-fournisseurs/documents?org_id=${orgId}&id=${id}`, { method: 'DELETE' })
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">📎 Documents — {entityLabel}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400">Fichiers stockés dans SharePoint (aucun stockage sur Vercel/Supabase). Un GeoJSON peut être réutilisé au dépôt de la DDS.</p>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">
                {uploading ? 'Envoi…' : '⬆ Ajouter un fichier'}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="space-y-1.5">
            {loading ? <p className="text-sm text-gray-400">Chargement…</p>
              : docs.length === 0 ? <p className="text-sm text-gray-400">Aucun document.</p>
              : docs.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm">
                  <span className="min-w-0">
                    <span className="truncate text-gray-800 dark:text-gray-100 block">{d.name}</span>
                    <span className="text-xs text-gray-400">{typeLabel(d.doc_type)}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button onClick={() => download(d.id)} title="Télécharger" className="text-gray-500 hover:text-green-600">⬇</button>
                    {canEdit && <button onClick={() => remove(d.id)} title="Supprimer" className="text-gray-400 hover:text-red-500">✕</button>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
