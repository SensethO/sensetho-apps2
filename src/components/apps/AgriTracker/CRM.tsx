'use client'

/**
 * AgriCRM — Module CRM intégré à AgriTracker.
 * Tabs : 💬 Messages · 📅 Rendez-vous · 📄 Notes & Docs · [🔒 Confiance — acheteur seulement]
 *
 * Messages — Architecture :
 *   Acheteur : sidebar = toutes ses plantations accessibles (organisé par culture / pays)
 *              → sélection → conversation avec le planteur
 *   Planteur : sidebar = liste des acheteurs qui lui ont écrit
 *              → sélection → lecture + réponse (avec PJ)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CRMMessage, CRMRdv, CRMRdvType, CRMRdvStatut, CRMNote, CRMConfianceEntry } from './types'

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function inputCls(extra = '') {
  return `w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm ${extra}`
}
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function cardCls(extra = '') { return `bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${extra}` }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

type CRMTab = 'messages' | 'rdv' | 'notes' | 'confiance'

const RDV_TYPE_LABELS: Record<CRMRdvType, string> = {
  sur_place: '🏡 Sur place',
  en_ligne: '💻 En ligne',
  autre: '📍 Autre',
}
const RDV_STATUT_LABELS: Record<CRMRdvStatut, { label: string; cls: string }> = {
  planifie:  { label: 'Planifié',  cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  confirme:  { label: 'Confirmé',  cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  annule:    { label: 'Annulé',    cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  termine:   { label: 'Terminé',   cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
}

function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => !readOnly && onChange?.(s)}
          className={`text-xl transition-transform ${readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'} ${s <= value ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>★</button>
      ))}
    </div>
  )
}

// ─── Types conversations ──────────────────────────────────────────────────────

interface ConvAcheteur {
  plantation_id: string
  plantation_nom: string
  pays_nom: string
  main_culture: string | null
  planteur_nom: string
  planteur_email: string
  acheteur_user_id?: string  // présent pour admin — id réel de l'acheteur
  acheteur_nom?: string      // nom de l'acheteur (pour admin)
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

interface ConvPlanteur {
  plantation_id: string
  plantation_nom: string
  acheteur_user_id: string
  acheteur_nom: string
  acheteur_email: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

interface Attachment { name: string; path: string; mime: string; size: number }

// ─── Attachment helpers ───────────────────────────────────────────────────────

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.startsWith('video/')) return '🎬'
  return '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

// ─── Media Lightbox ───────────────────────────────────────────────────────────

function MediaLightbox({ url, name, type, onClose }: {
  url: string; name: string; type: 'image' | 'video'; onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/92 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Conteneur media avec croix collée en haut à droite */}
      <div className="relative inline-flex" onClick={e => e.stopPropagation()}>
        {type === 'image' && (
          <img
            src={url}
            alt={name}
            className="max-w-[90vw] max-h-[88vh] object-contain rounded-xl shadow-2xl block"
          />
        )}
        {type === 'video' && (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-w-[90vw] max-h-[88vh] rounded-xl shadow-2xl block"
          />
        )}
        {/* Croix positionnée sur le coin supérieur droit du média */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-900 border-2 border-white/30 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-red-600 hover:border-red-400 transition-colors z-10"
          title="Fermer (Échap)"
        >✕</button>
        {/* Nom du fichier en bas */}
        <div className="absolute -bottom-7 left-0 right-0 text-center text-white/50 text-xs truncate px-2">
          {name}
        </div>
      </div>
    </div>
  )
}

// ─── Attachment Preview ───────────────────────────────────────────────────────
// Affiche les images en vignette, les vidéos en player inline, les autres en pill.

function AttachmentPreview({ att, isMe }: { att: Attachment; isMe: boolean }) {
  const isImage = att.mime.startsWith('image/')
  const isVideo = att.mime.startsWith('video/')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [fetching, setFetching] = useState(false)

  // Pré-charger l'URL signée pour les images (juste l'URL, pas le fichier)
  useEffect(() => {
    if (!isImage) return
    fetch(`/api/agri/crm/download?path=${encodeURIComponent(att.path)}`)
      .then(r => r.json())
      .then(j => { if (j.url) setSignedUrl(j.url) })
      .catch(() => {})
  }, [att.path, isImage])

  async function fetchUrl(): Promise<string | null> {
    if (signedUrl) return signedUrl
    setFetching(true)
    try {
      const res = await fetch(`/api/agri/crm/download?path=${encodeURIComponent(att.path)}`)
      const j = await res.json()
      if (j.url) { setSignedUrl(j.url); return j.url as string }
    } finally { setFetching(false) }
    return null
  }

  const bgMe = 'bg-white/20 hover:bg-white/30 border-white/30 dark:border-white/10'
  const bgOther = 'bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 border-gray-300 dark:border-gray-600'

  // ── Image : vignette cliquable ──
  if (isImage) {
    return (
      <>
        <button
          onClick={() => signedUrl && setLightboxOpen(true)}
          disabled={!signedUrl}
          className="block text-left group"
        >
          {signedUrl ? (
            <img
              src={signedUrl}
              alt={att.name}
              className="max-w-[200px] max-h-[150px] w-auto h-auto object-cover rounded-xl shadow-sm group-hover:opacity-90 transition"
            />
          ) : (
            <div className={`w-[120px] h-[80px] rounded-xl flex items-center justify-center text-2xl animate-pulse ${isMe ? 'bg-white/20' : 'bg-black/10 dark:bg-white/10'}`}>
              🖼️
            </div>
          )}
          <div className={`text-[10px] mt-0.5 truncate max-w-[200px] ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
            {att.name} · {formatSize(att.size)}
          </div>
        </button>
        {lightboxOpen && signedUrl && (
          <MediaLightbox url={signedUrl} name={att.name} type="image" onClose={() => setLightboxOpen(false)} />
        )}
      </>
    )
  }

  // ── Vidéo : player inline ──
  if (isVideo) {
    return (
      <>
        {videoOpen && signedUrl ? (
          <div className="rounded-xl overflow-hidden shadow-sm max-w-[300px]">
            <video
              src={signedUrl}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[200px] object-cover"
            />
            <div className="flex items-center justify-between px-2 py-1 bg-black/20">
              <span className={`text-[10px] truncate max-w-[200px] ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>{att.name}</span>
              <button
                onClick={() => { setVideoOpen(false); setSignedUrl(null) }}
                className="text-[10px] text-white/50 hover:text-white/80 ml-2"
              >✕</button>
            </div>
          </div>
        ) : (
          <button
            onClick={async () => {
              const url = await fetchUrl()
              if (url) setVideoOpen(true)
            }}
            disabled={fetching}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition ${isMe ? bgMe : bgOther}`}
          >
            {fetching
              ? <span className="animate-spin text-base">⟳</span>
              : <span className="text-xl">▶️</span>
            }
            <div className="min-w-0 text-left">
              <div className={`font-medium truncate max-w-[130px] ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{att.name}</div>
              <div className={`text-[10px] ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>{formatSize(att.size)}</div>
            </div>
          </button>
        )}
        {/* Lightbox plein écran au clic sur la vignette inline */}
        {videoOpen && signedUrl && lightboxOpen && (
          <MediaLightbox url={signedUrl} name={att.name} type="video" onClose={() => setLightboxOpen(false)} />
        )}
      </>
    )
  }

  // ── Autres fichiers : pill ──
  return (
    <button
      onClick={async () => { const url = await fetchUrl(); if (url) window.open(url, '_blank') }}
      disabled={fetching}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition border ${isMe ? bgMe : bgOther}`}
      title={att.name}
    >
      <span>{fileIcon(att.mime)}</span>
      <span className={`max-w-[120px] truncate font-medium ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{att.name}</span>
      <span className={`${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>{formatSize(att.size)}</span>
      {fetching && <span className="animate-spin text-[10px]">⟳</span>}
    </button>
  )
}

// ─── Thread (zone de messages) ────────────────────────────────────────────────

interface ThreadProps {
  plantationId: string
  acheteurUserId: string
  currentUserId: string
  isAcheteur: boolean
  isAdmin?: boolean
  headerLabel: string
  onMessageSent?: () => void  // callback pour rafraîchir la liste conversations
}

function Thread({ plantationId, acheteurUserId, currentUserId, isAcheteur, isAdmin, headerLabel, onMessageSent }: ThreadProps) {
  const [messages, setMessages] = useState<(CRMMessage & { attachments?: Attachment[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/agri/crm/messages?plantation_id=${plantationId}&acheteur_user_id=${acheteurUserId}`
    )
    if (res.ok) {
      const j = await res.json()
      setMessages(j.messages ?? [])
    }
    setLoading(false)
  }, [plantationId, acheteurUserId])

  useEffect(() => { load() }, [load])
  // Polling 4s — synchronisation live sans WebSocket
  useEffect(() => { const t = setInterval(load, 4000); return () => clearInterval(t) }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!content.trim() && pendingFiles.length === 0) return
    setSending(true)
    const attachments: Attachment[] = []
    for (const file of pendingFiles) {
      try {
        const mime = file.type || 'application/octet-stream'

        // Étape 1 : obtenir l'URL d'upload pré-authentifiée (requête JSON légère → Vercel OK)
        const sessionRes = await fetch('/api/agri/crm/upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plantation_id: plantationId,
            filename: file.name,
            mime,
            size: file.size,
          }),
        })
        if (!sessionRes.ok) {
          console.error('upload-session error', await sessionRes.json().catch(() => ({})))
          continue
        }
        const { uploadUrl, originalName } = await sessionRes.json() as { uploadUrl: string; originalName: string }

        // Étape 2 : upload direct navigateur → SharePoint (aucun transit Vercel, aucune limite)
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mime,
            'Content-Range': `bytes 0-${file.size - 1}/${file.size}`,
          },
          body: file,
        })
        if (!uploadRes.ok) {
          console.error('sharepoint upload error', uploadRes.status, await uploadRes.text().catch(() => ''))
          continue
        }
        const spItem = await uploadRes.json() as { id: string }
        attachments.push({ name: originalName ?? file.name, path: spItem.id, mime, size: file.size })
      } catch (e) {
        console.error('upload error', e)
      }
    }
    const msgContent = content.trim() || (attachments.length > 0 ? `📎 ${attachments.map(a => a.name).join(', ')}` : '')
    const res = await fetch('/api/agri/crm/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantation_id: plantationId, acheteur_user_id: acheteurUserId, content: msgContent, attachments }),
    })
    if (res.ok) {
      const j = await res.json()
      setMessages(prev => [...prev, j.message])
      setContent('')
      setPendingFiles([])
      onMessageSent?.()  // rafraîchir la liste des conversations immédiatement
    }
    setSending(false)
  }

  async function archiveConversation() {
    setArchiving(true)
    const res = await fetch('/api/agri/crm/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantation_id: plantationId, acheteur_user_id: acheteurUserId }),
    })
    if (res.ok) {
      setArchiveMsg('✓ Archivé dans Notes & Docs')
      // Vider les messages — ils sont maintenant dans Notes & Docs
      setMessages([])
      // Rafraîchir la liste des conversations (la conv disparaît si plus de messages)
      onMessageSent?.()
    } else {
      const j = await res.json().catch(() => ({}))
      setArchiveMsg(`⚠️ ${j.error ?? 'Erreur'}`)
    }
    setArchiving(false)
    setTimeout(() => setArchiveMsg(''), 4000)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{headerLabel}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {archiveMsg && (
            <span className={`text-xs px-2 py-1 rounded-lg ${archiveMsg.startsWith('✓') ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
              {archiveMsg}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={archiveConversation}
              disabled={archiving}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition disabled:opacity-50"
              title="Archiver la conversation complète dans Notes & Docs"
            >
              {archiving ? <span className="animate-spin">⟳</span> : '📥'}
              <span>Archiver</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            {isAcheteur ? 'Aucun message — envoyez le premier message au planteur' : 'Aucun message dans cette conversation'}
          </p>
        )}
        {messages.map(m => {
          const isMe = m.sender_user_id === currentUserId
          const time = new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          const atts = (m.attachments ?? []) as Attachment[]
          // Filtrer le contenu auto-généré si c'est uniquement une liste de PJ
          const displayContent = m.content && !m.content.startsWith('📎 ') ? m.content : null
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm space-y-2 ${
                isMe
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-sm'
              }`}>
                {!isMe && (
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {m.sender_nom ?? 'Inconnu'}
                  </div>
                )}
                {displayContent && <p className="whitespace-pre-wrap">{displayContent}</p>}
                {atts.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {atts.map((a, i) => <AttachmentPreview key={i} att={a} isMe={isMe} />)}
                  </div>
                )}
                <div className={`text-[10px] ${isMe ? 'text-emerald-200' : 'text-gray-400'} text-right`}>{time}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Fichiers en attente */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-gray-100 dark:border-gray-700">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs rounded-full px-3 py-1">
              <span>{fileIcon(f.type)}</span>
              <span className="max-w-[100px] truncate">{f.name}</span>
              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 transition font-bold">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Saisie */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2 items-end">
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={e => {
          const files = Array.from(e.target.files ?? [])
          setPendingFiles(prev => [...prev, ...files])
          if (fileRef.current) fileRef.current.value = ''
        }} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-emerald-600 hover:border-emerald-400 transition flex items-center justify-center text-lg"
          title="Joindre un fichier (image, vidéo, document)"
        >📎</button>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
          rows={2}
          className={inputCls('resize-none flex-1')}
        />
        <button
          onClick={send}
          disabled={sending || (!content.trim() && pendingFiles.length === 0)}
          className={btnP('self-end flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center rounded-xl')}
        >
          {sending ? <span className="animate-spin text-sm">⟳</span> : <span>➤</span>}
        </button>
      </div>
    </div>
  )
}

// ─── Messages Tab — Acheteur ──────────────────────────────────────────────────

function convKey(c: ConvAcheteur): string {
  return `${c.plantation_id}__${c.acheteur_user_id ?? ''}`
}

export function MessagesTabAcheteur({ plantationId, currentUserId, isAdmin, onUnreadChange }: {
  plantationId: string; currentUserId: string; isAdmin?: boolean; onUnreadChange?: (n: number) => void
}) {
  const [conversations, setConversations] = useState<ConvAcheteur[]>([])
  const [selectedKey, setSelectedKey] = useState<string>(plantationId + '__')
  const [loading, setLoading] = useState(true)
  const [mobilePage, setMobilePage] = useState<'list' | 'thread'>('list')

  const loadConversations = useCallback(() => {
    fetch('/api/agri/crm/conversations?mode=acheteur')
      .then(r => r.json())
      .then(j => {
        const convs: ConvAcheteur[] = j.conversations ?? []
        setConversations(convs)
        // Si la sélection actuelle n'existe plus, sélectionner la première conversation
        const currentExists = convs.find(c => convKey(c) === selectedKey)
        if (!currentExists && convs.length > 0) {
          setSelectedKey(convKey(convs[0]))
        }
        onUnreadChange?.(convs.reduce((s, c) => s + c.unread_count, 0))
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnreadChange])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const t = setInterval(loadConversations, 30000)
    return () => clearInterval(t)
  }, [loadConversations])

  const grouped = conversations.reduce<Record<string, Record<string, ConvAcheteur[]>>>((acc, c) => {
    const culture = c.main_culture ?? 'Autre'
    const pays = c.pays_nom ?? 'Inconnu'
    if (!acc[culture]) acc[culture] = {}
    if (!acc[culture][pays]) acc[culture][pays] = []
    acc[culture][pays].push(c)
    return acc
  }, {})

  const selected = conversations.find(c => convKey(c) === selectedKey)

  const timeStr = (dt: string | null) => {
    if (!dt) return ''
    const d = new Date(dt)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)} min`
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="flex h-[540px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className={`${mobilePage === 'thread' ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0`}>
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plantations</p>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 px-3">Aucune plantation accessible</p>
          )}
          {Object.entries(grouped).map(([culture, pays]) => (
            <div key={culture}>
              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-100/80 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                🌿 {culture}
              </div>
              {Object.entries(pays).map(([paysNom, convList]) => (
                <div key={paysNom}>
                  <div className="px-3 py-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">📍 {paysNom}</div>
                  {convList.map(c => (
                    <button
                      key={convKey(c)}
                      onClick={() => { setSelectedKey(convKey(c)); setMobilePage('thread') }}
                      className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 transition ${
                        selectedKey === convKey(c)
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-l-emerald-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white leading-tight line-clamp-1">
                          {c.plantation_nom}{c.acheteur_nom ? ` — ${c.acheteur_nom}` : ''}
                        </span>
                        {c.last_message_at && <span className="text-[10px] text-gray-400 flex-shrink-0">{timeStr(c.last_message_at)}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">{c.planteur_nom}</span>
                        {c.unread_count > 0 && (
                          <span className="text-[10px] bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{c.unread_count}</span>
                        )}
                      </div>
                      {c.last_message && <p className="text-[10px] text-gray-400 truncate mt-0.5">{c.last_message}</p>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={`${mobilePage === 'list' ? 'hidden' : 'flex'} sm:flex flex-col flex-1 min-w-0`}>
        <div className="sm:hidden">
          <button onClick={() => setMobilePage('list')} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 px-3 pt-2">← Retour</button>
        </div>
        {selected ? (
          <Thread
            plantationId={selected.plantation_id}
            acheteurUserId={selected.acheteur_user_id ?? currentUserId}
            currentUserId={currentUserId}
            isAcheteur
            isAdmin={isAdmin}
            headerLabel={selected.acheteur_nom
              ? `${selected.plantation_nom} — ${selected.acheteur_nom}`
              : `${selected.plantation_nom} — ${selected.planteur_nom}`}
            onMessageSent={loadConversations}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <div className="text-4xl">💬</div>
            <p className="text-sm">Sélectionnez une plantation pour démarrer la conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Messages Tab — Planteur ──────────────────────────────────────────────────

function MessagesTabPlanteur({ plantationId, currentUserId, isAdmin, onUnreadChange }: {
  plantationId: string; currentUserId: string; isAdmin?: boolean; onUnreadChange?: (n: number) => void
}) {
  const [conversations, setConversations] = useState<ConvPlanteur[]>([])
  const [selected, setSelected] = useState<ConvPlanteur | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobilePage, setMobilePage] = useState<'list' | 'thread'>('list')

  const loadConversations = useCallback(() => {
    fetch(`/api/agri/crm/conversations?mode=planteur&plantation_id=${plantationId}`)
      .then(r => r.json())
      .then(j => {
        const convs: ConvPlanteur[] = j.conversations ?? []
        setConversations(convs)
        // Mettre à jour la sélection si elle existe toujours
        setSelected(prev => prev
          ? convs.find(c => c.plantation_id === prev.plantation_id && c.acheteur_user_id === prev.acheteur_user_id) ?? prev
          : null
        )
        onUnreadChange?.(convs.reduce((s, c) => s + c.unread_count, 0))
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantationId, onUnreadChange])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => {
    const t = setInterval(loadConversations, 30000)
    return () => clearInterval(t)
  }, [loadConversations])

  const timeStr = (dt: string | null) => {
    if (!dt) return ''
    const d = new Date(dt)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 3600) return `${Math.floor(diff / 60)} min`
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="flex h-[540px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className={`${mobilePage === 'thread' ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0`}>
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {conversations.length === 0 && (
            <div className="px-3 py-6 text-center space-y-2">
              <div className="text-3xl">📭</div>
              <p className="text-xs text-gray-400">Aucun acheteur ne vous a encore contacté</p>
            </div>
          )}
          {conversations.map(c => (
            <button
              key={`${c.plantation_id}_${c.acheteur_user_id}`}
              onClick={() => { setSelected(c); setMobilePage('thread') }}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 dark:border-gray-700/50 transition ${
                selected?.acheteur_user_id === c.acheteur_user_id && selected?.plantation_id === c.plantation_id
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-l-emerald-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {c.acheteur_nom[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{c.acheteur_nom}</div>
                    <div className="text-[10px] text-gray-400 truncate">{c.plantation_nom}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {c.last_message_at && <span className="text-[10px] text-gray-400">{timeStr(c.last_message_at)}</span>}
                  {c.unread_count > 0 && (
                    <span className="text-[10px] bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{c.unread_count}</span>
                  )}
                </div>
              </div>
              {c.last_message && <p className="text-[10px] text-gray-400 truncate mt-1 ml-10">{c.last_message}</p>}
            </button>
          ))}
        </div>
      </div>

      <div className={`${mobilePage === 'list' ? 'hidden' : 'flex'} sm:flex flex-col flex-1 min-w-0`}>
        <div className="sm:hidden">
          <button onClick={() => setMobilePage('list')} className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 px-3 pt-2">← Retour</button>
        </div>
        {selected ? (
          <Thread
            plantationId={selected.plantation_id}
            acheteurUserId={selected.acheteur_user_id}
            currentUserId={currentUserId}
            isAcheteur={false}
            isAdmin={isAdmin}
            headerLabel={`${selected.acheteur_nom} — ${selected.plantation_nom}`}
            onMessageSent={loadConversations}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <div className="text-4xl">💬</div>
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── RDV Tab ──────────────────────────────────────────────────────────────────

function RdvTab({ plantationId }: { plantationId: string }) {
  const [rdvs, setRdvs] = useState<CRMRdv[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingCR, setEditingCR] = useState<string | null>(null)
  const [crText, setCrText] = useState('')
  const [savingCR, setSavingCR] = useState(false)
  const [form, setForm] = useState({ titre: '', date_rdv: '', heure: '', duree_min: '', type: 'sur_place' as CRMRdvType, lieu: '', lien: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/agri/crm/rdv?plantation_id=${plantationId}`)
      .then(r => r.json()).then(j => setRdvs(j.rdvs ?? [])).finally(() => setLoading(false))
  }, [plantationId])

  async function createRdv() {
    if (!form.titre || !form.date_rdv) return
    setSaving(true)
    const res = await fetch('/api/agri/crm/rdv', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantation_id: plantationId, ...form, duree_min: form.duree_min ? parseInt(form.duree_min) : null }) })
    if (res.ok) { const j = await res.json(); setRdvs(prev => [j.rdv, ...prev]); setShowForm(false); setForm({ titre: '', date_rdv: '', heure: '', duree_min: '', type: 'sur_place', lieu: '', lien: '' }) }
    setSaving(false)
  }

  async function updateStatut(id: string, statut: CRMRdvStatut) {
    const res = await fetch(`/api/agri/crm/rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) })
    if (res.ok) { const j = await res.json(); setRdvs(prev => prev.map(r => r.id === id ? j.rdv : r)) }
  }

  async function saveCR(id: string) {
    setSavingCR(true)
    const res = await fetch(`/api/agri/crm/rdv/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compte_rendu: crText }) })
    if (res.ok) { const j = await res.json(); setRdvs(prev => prev.map(r => r.id === id ? j.rdv : r)); setEditingCR(null) }
    setSavingCR(false)
  }

  async function deleteRdv(id: string) {
    if (!confirm('Supprimer ce rendez-vous ?')) return
    await fetch(`/api/agri/crm/rdv/${id}`, { method: 'DELETE' })
    setRdvs(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Rendez-vous ({rdvs.length})</h3>
        <button className={btnP()} onClick={() => setShowForm(v => !v)}>+ Nouveau RDV</button>
      </div>
      {showForm && (
        <div className={cardCls('p-4 space-y-3')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls()}>Titre *</label><input className={inputCls()} value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Visite de terrain" /></div>
            <div><label className={labelCls()}>Date *</label><input type="date" className={inputCls()} value={form.date_rdv} onChange={e => setForm(f => ({ ...f, date_rdv: e.target.value }))} /></div>
            <div><label className={labelCls()}>Heure</label><input type="time" className={inputCls()} value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} /></div>
            <div><label className={labelCls()}>Durée (min)</label><input type="number" className={inputCls()} value={form.duree_min} onChange={e => setForm(f => ({ ...f, duree_min: e.target.value }))} placeholder="60" min={0} /></div>
            <div><label className={labelCls()}>Type</label>
              <select className={inputCls()} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CRMRdvType }))}>
                <option value="sur_place">🏡 Sur place</option><option value="en_ligne">💻 En ligne</option><option value="autre">📍 Autre</option>
              </select>
            </div>
            {form.type !== 'en_ligne' ? (
              <div className="sm:col-span-2"><label className={labelCls()}>Lieu</label><input className={inputCls()} value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Adresse ou description" /></div>
            ) : (
              <div className="sm:col-span-2"><label className={labelCls()}>Lien</label><input className={inputCls()} value={form.lien} onChange={e => setForm(f => ({ ...f, lien: e.target.value }))} placeholder="https://…" /></div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button className={btnS()} onClick={() => setShowForm(false)}>Annuler</button>
            <button className={btnP()} onClick={createRdv} disabled={saving || !form.titre || !form.date_rdv}>{saving ? 'Enregistrement…' : '✓ Créer'}</button>
          </div>
        </div>
      )}
      {rdvs.length === 0 && !showForm && <p className="text-sm text-gray-400 text-center py-8">Aucun rendez-vous planifié</p>}
      {rdvs.map(r => {
        const statut = RDV_STATUT_LABELS[r.statut] ?? RDV_STATUT_LABELS.planifie
        const isExpanded = expandedId === r.id
        const dateStr = new Date(r.date_rdv + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        return (
          <div key={r.id} className={cardCls('overflow-hidden')}>
            <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{r.titre}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statut.cls}`}>{statut.label}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-3">
                  <span>📅 {dateStr}{r.heure ? ` à ${r.heure}` : ''}</span>
                  <span>{RDV_TYPE_LABELS[r.type]}</span>
                  {r.duree_min && <span>⏱ {r.duree_min} min</span>}
                </div>
                {r.lieu && <div className="text-xs text-gray-400 mt-0.5">📍 {r.lieu}</div>}
                {r.lien && <a href={r.lien} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:underline block mt-0.5 truncate">🔗 {r.lien}</a>}
              </div>
              <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
            </div>
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                <div>
                  <label className={labelCls()}>Statut</label>
                  <div className="flex flex-wrap gap-2">
                    {(['planifie','confirme','annule','termine'] as CRMRdvStatut[]).map(s => (
                      <button key={s} onClick={() => updateStatut(r.id, s)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${r.statut === s ? RDV_STATUT_LABELS[s].cls + ' ring-2 ring-offset-1 ring-emerald-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{RDV_STATUT_LABELS[s].label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls()}>Compte rendu partagé</label>
                    {editingCR !== r.id && <button className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline" onClick={() => { setEditingCR(r.id); setCrText(r.compte_rendu ?? '') }}>{r.compte_rendu ? '✏️ Modifier' : '+ Ajouter'}</button>}
                  </div>
                  {editingCR === r.id ? (
                    <div className="space-y-2">
                      <textarea rows={5} className={inputCls('resize-y')} value={crText} onChange={e => setCrText(e.target.value)} placeholder="Résumé, décisions, points à suivre…" />
                      <div className="flex gap-2 justify-end">
                        <button className={btnS()} onClick={() => setEditingCR(null)}>Annuler</button>
                        <button className={btnP()} onClick={() => saveCR(r.id)} disabled={savingCR}>{savingCR ? 'Enregistrement…' : '✓ Enregistrer'}</button>
                      </div>
                    </div>
                  ) : r.compte_rendu ? (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{r.compte_rendu}{r.compte_rendu_updated_at && <div className="text-[10px] text-gray-400 mt-2">Mis à jour le {new Date(r.compte_rendu_updated_at).toLocaleDateString('fr-FR')}</div>}</div>
                  ) : <p className="text-xs text-gray-400 italic">Aucun compte rendu</p>}
                </div>
                <div className="flex justify-end"><button onClick={() => deleteRdv(r.id)} className="text-xs text-red-500 hover:text-red-600 transition">🗑️ Supprimer ce RDV</button></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ plantationId, isAdmin }: { plantationId: string; isAdmin?: boolean }) {
  const [notes, setNotes] = useState<CRMNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ titre: '', contenu: '' })
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/agri/crm/notes?plantation_id=${plantationId}`)
      .then(r => r.json()).then(j => setNotes(j.notes ?? [])).finally(() => setLoading(false))
  }, [plantationId])

  async function saveNote() {
    if (!form.titre) return
    setSaving(true)
    if (editingId) {
      const res = await fetch(`/api/agri/crm/notes/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titre: form.titre, contenu: form.contenu }) })
      if (res.ok) { const j = await res.json(); setNotes(prev => prev.map(n => n.id === editingId ? j.note : n)); setEditingId(null); setShowForm(false) }
    } else {
      const res = await fetch('/api/agri/crm/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plantation_id: plantationId, ...form }) })
      if (res.ok) { const j = await res.json(); setNotes(prev => [j.note, ...prev]); setShowForm(false); setForm({ titre: '', contenu: '' }) }
    }
    setSaving(false)
  }

  async function deleteNote(id: string) {
    if (!confirm('Supprimer cette note ?')) return
    await fetch(`/api/agri/crm/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Notes & Documents ({notes.length})</h3>
        {isAdmin && (
          <button className={btnP()} onClick={() => { setShowForm(v => !v); setEditingId(null); setForm({ titre: '', contenu: '' }) }}>+ Nouvelle note</button>
        )}
      </div>
      {(showForm || editingId) && (
        <div className={cardCls('p-4 space-y-3')}>
          <div><label className={labelCls()}>Titre *</label><input className={inputCls()} value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Conditions de transport" /></div>
          <div><label className={labelCls()}>Contenu</label><textarea rows={5} className={inputCls('resize-y')} value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} placeholder="Détails partagés…" /></div>
          <div className="flex gap-2 justify-end">
            <button className={btnS()} onClick={() => { setShowForm(false); setEditingId(null) }}>Annuler</button>
            <button className={btnP()} onClick={saveNote} disabled={saving || !form.titre}>{saving ? 'Enregistrement…' : '✓ Enregistrer'}</button>
          </div>
        </div>
      )}
      {notes.length === 0 && !showForm && <p className="text-sm text-gray-400 text-center py-8">Aucune note partagée — créez la première</p>}
      {notes.map(n => {
        const isExpanded = expandedId === n.id
        const date = new Date(n.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        return (
          <div key={n.id} className={cardCls('overflow-hidden')}>
            <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition" onClick={() => setExpandedId(isExpanded ? null : n.id)}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white text-sm">{n.titre}</div>
                {n.contenu && !isExpanded && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.contenu}</p>}
                <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                  <span>✍️ {n.created_by_nom ?? 'Inconnu'} · {date}</span>
                  {n.fichiers && n.fichiers.length > 0 && (
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">📎 {n.fichiers.length}</span>
                  )}
                </div>
              </div>
              <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
            </div>
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                {n.contenu && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{n.contenu}</p>}
                {/* Pièces jointes — item_id = chemin Supabase Storage (crm-docs) */}
                {n.fichiers && n.fichiers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">📎 Pièces jointes ({n.fichiers.length})</div>
                    <div className="flex flex-wrap gap-3">
                      {n.fichiers.map((f, i) => (
                        <AttachmentPreview
                          key={i}
                          att={{ name: f.name, path: f.item_id, mime: f.mime, size: f.size }}
                          isMe={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex justify-between items-center pt-2">
                    <button className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline" onClick={() => { setEditingId(n.id); setForm({ titre: n.titre, contenu: n.contenu }); setShowForm(false) }}>✏️ Modifier</button>
                    <button onClick={() => deleteNote(n.id)} className="text-xs text-red-500 hover:text-red-600 transition">🗑️ Supprimer</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Confiance Tab ────────────────────────────────────────────────────────────

function ConfianceTab({ plantationId }: { plantationId: string }) {
  const [entries, setEntries] = useState<CRMConfianceEntry[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ score: 3, note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/agri/crm/confiance?plantation_id=${plantationId}`)
      .then(r => r.json()).then(j => { setEntries(j.entries ?? []); setScore(j.score ?? null) }).finally(() => setLoading(false))
  }, [plantationId])

  async function addEntry() {
    setSaving(true)
    const res = await fetch('/api/agri/crm/confiance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plantation_id: plantationId, score: form.score, note: form.note || null }) })
    if (res.ok) {
      const j = await res.json()
      const newEntries = [j.entry, ...entries]
      setEntries(newEntries)
      setScore(Math.round(newEntries.reduce((s, e) => s + e.score, 0) / newEntries.length))
      setShowForm(false); setForm({ score: 3, note: '' })
    }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/agri/crm/confiance?id=${id}`, { method: 'DELETE' })
    const newEntries = entries.filter(e => e.id !== id)
    setEntries(newEntries)
    setScore(newEntries.length > 0 ? Math.round(newEntries.reduce((s, e) => s + e.score, 0) / newEntries.length) : null)
  }

  const SCORE_LABELS: Record<number, { label: string; cls: string }> = {
    1: { label: 'Très faible', cls: 'text-red-600' }, 2: { label: 'Faible', cls: 'text-orange-500' },
    3: { label: 'Moyen', cls: 'text-amber-500' }, 4: { label: 'Bon', cls: 'text-emerald-500' },
    5: { label: 'Excellent', cls: 'text-emerald-600 font-semibold' },
  }

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className={cardCls('p-5 flex items-center gap-5')}>
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Indice de confiance global</div>
          {score !== null ? (
            <>
              <StarRating value={score} readOnly />
              <div className={`text-sm mt-1 ${SCORE_LABELS[score]?.cls ?? ''}`}>{SCORE_LABELS[score]?.label ?? ''} — {score}/5</div>
              <div className="text-xs text-gray-400 mt-0.5">Basé sur {entries.length} évaluation{entries.length > 1 ? 's' : ''}</div>
            </>
          ) : <p className="text-sm text-gray-400">Aucune évaluation</p>}
        </div>
        <button className={btnP()} onClick={() => setShowForm(v => !v)}>+ Évaluation</button>
      </div>
      {showForm && (
        <div className={cardCls('p-4 space-y-3')}>
          <div><label className={labelCls()}>Note de confiance *</label><StarRating value={form.score} onChange={s => setForm(f => ({ ...f, score: s }))} /><div className={`text-xs mt-1 ${SCORE_LABELS[form.score]?.cls ?? ''}`}>{SCORE_LABELS[form.score]?.label}</div></div>
          <div><label className={labelCls()}>Commentaire (privé)</label><textarea rows={3} className={inputCls('resize-none')} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Observations, raisons de votre évaluation…" /></div>
          <div className="flex gap-2 justify-end">
            <button className={btnS()} onClick={() => setShowForm(false)}>Annuler</button>
            <button className={btnP()} onClick={addEntry} disabled={saving}>{saving ? 'Enregistrement…' : '✓ Enregistrer'}</button>
          </div>
        </div>
      )}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Historique</h4>
          {entries.map(e => {
            const date = new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={e.id} className={cardCls('p-3 flex items-start gap-3')}>
                <div className="flex-1"><StarRating value={e.score} readOnly />{e.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">{e.note}</p>}<div className="text-[11px] text-gray-400 mt-1">🔒 Note privée · {date}</div></div>
                <button onClick={() => deleteEntry(e.id)} className="text-gray-300 hover:text-red-400 text-xs transition flex-shrink-0">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── AgriCRM ──────────────────────────────────────────────────────────────────

interface AgriCRMProps {
  plantationId: string
  plantationNom: string
  isAcheteur: boolean
  isAdmin?: boolean
  currentUserId: string
  onUnreadChange?: (n: number) => void
}

export default function AgriCRM({ plantationId, plantationNom, isAcheteur, isAdmin, currentUserId, onUnreadChange }: AgriCRMProps) {
  const [tab, setTab] = useState<CRMTab>('messages')
  const [msgUnread, setMsgUnread] = useState(0)

  const tabs: { key: CRMTab; label: string; icon: string; hidden?: boolean }[] = [
    { key: 'messages',  label: 'Messages',    icon: '💬' },
    { key: 'rdv',       label: 'Rendez-vous', icon: '📅' },
    { key: 'notes',     label: 'Notes & Docs',icon: '📄' },
    { key: 'confiance', label: 'Confiance',   icon: '🔒', hidden: !isAcheteur },
  ]

  function handleUnread(n: number) {
    setMsgUnread(n)
    onUnreadChange?.(n)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🤝 CRM — {plantationNom}</h2>

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.filter(t => !t.hidden).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px relative ${
              tab === t.key ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <span>{t.icon}</span>{t.label}
            {t.key === 'messages' && msgUnread > 0 && (
              <span className="absolute -top-0.5 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{msgUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div>
        {tab === 'messages' && isAcheteur && (
          <MessagesTabAcheteur plantationId={plantationId} currentUserId={currentUserId} isAdmin={isAdmin} onUnreadChange={handleUnread} />
        )}
        {tab === 'messages' && !isAcheteur && (
          <MessagesTabPlanteur plantationId={plantationId} currentUserId={currentUserId} isAdmin={isAdmin} onUnreadChange={handleUnread} />
        )}
        {tab === 'rdv'       && <RdvTab plantationId={plantationId} />}
        {tab === 'notes'     && <NotesTab plantationId={plantationId} isAdmin={isAdmin} />}
        {tab === 'confiance' && isAcheteur && <ConfianceTab plantationId={plantationId} />}
      </div>
    </div>
  )
}
