'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import dynamic from 'next/dynamic'

const ShareBoardModal = dynamic(() => import('./ShareBoardModal'), { ssr: false })

interface BoardMeta {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  created_at: string
  updated_at: string
  permission?: string // pour les partagés
}

const TEMPLATES = [
  { id: 'blank',      label: 'Tableau vierge',    icon: '⬜', description: 'Commencez avec un canvas vide' },
  { id: 'brainstorm', label: 'Brainstorming',      icon: '💡', description: 'Post-its colorés pour générer des idées' },
  { id: 'kanban',     label: 'Kanban Board',       icon: '📋', description: 'Colonnes À faire / En cours / Terminé' },
  { id: 'mindmap',    label: 'Carte mentale',      icon: '🧠', description: 'Organisez vos idées en arbre' },
  { id: 'retro',      label: 'Rétrospective',      icon: '🔄', description: 'Keep / Stop / Start pour vos équipes' },
  { id: 'roadmap',    label: 'Roadmap',            icon: '🗺️',  description: 'Planifiez votre feuille de route' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  const h   = Math.floor(diff / 3600000)
  const d   = Math.floor(diff / 86400000)
  if (min < 1) return 'À l\'instant'
  if (min < 60) return `Il y a ${min} min`
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${d} j`
}

export default function BoardsApp() {
  const router  = useRouter()
  useAuth() // pour déclencher l'auth context
  const [owned,   setOwned]   = useState<BoardMeta[]>([])
  const [shared,  setShared]  = useState<BoardMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search,   setSearch]   = useState('')
  const [view,     setView]     = useState<'grid' | 'list'>('grid')
  const [showNew,  setShowNew]  = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameVal,  setRenameVal]      = useState('')
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [sharingBoard, setSharingBoard] = useState<BoardMeta | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/boards')
      .then(r => r.json())
      .then(d => { setOwned(d.owned ?? []); setShared(d.shared ?? []) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function createBoard(templateId = 'blank') {
    setCreating(true)
    try {
      const title = newTitle.trim() || TEMPLATES.find(t => t.id === templateId)?.label || 'Nouveau tableau'
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const { data } = await res.json()
      if (data?.id) router.push(`/business/board/${data.id}`)
    } finally {
      setCreating(false)
      setShowNew(false)
      setNewTitle('')
    }
  }

  async function deleteBoard(id: string) {
    if (!confirm('Supprimer ce tableau ?')) return
    setDeletingId(id)
    await fetch(`/api/boards/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  async function renameBoard(id: string) {
    if (!renameVal.trim()) return
    await fetch(`/api/boards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameVal.trim() }),
    })
    setRenamingId(null)
    load()
  }

  const filteredOwned  = owned.filter(b =>  b.title.toLowerCase().includes(search.toLowerCase()))
  const filteredShared = shared.filter(b => b.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>📌 Mes tableaux</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Vos espaces de travail visuels — brainstorm, kanban, mindmap…</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un tableau…"
            className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 text-sm transition ${view === 'grid' ? 'bg-indigo-600 text-white' : ''}`} style={view !== 'grid' ? { color: 'var(--text-muted)' } : {}}>⊞</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm transition ${view === 'list' ? 'bg-indigo-600 text-white' : ''}`} style={view !== 'list' ? { color: 'var(--text-muted)' } : {}}>≡</button>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nouveau tableau
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Modal partage */}
        {sharingBoard && (
          <ShareBoardModal
            boardId={sharingBoard.id}
            boardTitle={sharingBoard.title}
            onClose={() => setSharingBoard(null)}
          />
        )}

        {/* Modal nouveau tableau */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowNew(false)}>
            <div className="rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text)' }}>
              <h2 className="text-lg font-bold">Créer un nouveau tableau</h2>
              <input
                autoFocus value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createBoard() }}
                placeholder="Nom du tableau (optionnel)"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Choisir un modèle</p>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => createBoard(t.id)} disabled={creating}
                      className="text-left p-3 rounded-xl border hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group disabled:opacity-50"
                      style={{ borderColor: 'var(--border)' }}>
                      <div className="text-2xl mb-1">{t.icon}</div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{t.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Annuler</button>
                <button onClick={() => createBoard()} disabled={creating}
                  className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50">
                  {creating ? 'Création…' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Mes tableaux */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                Mes tableaux ({filteredOwned.length})
              </h2>
              {filteredOwned.length === 0 && (
                <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-5xl mb-4">🎨</div>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>Aucun tableau pour l&apos;instant</p>
                  <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Créez votre premier espace de travail visuel</p>
                  <button onClick={() => setShowNew(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
                    + Créer un tableau
                  </button>
                </div>
              )}
              <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-2'}>
                {filteredOwned.map(board => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    view={view}
                    isOwner
                    renamingId={renamingId}
                    renameVal={renameVal}
                    deletingId={deletingId}
                    onOpen={() => router.push(`/business/board/${board.id}`)}
                    onRename={() => { setRenamingId(board.id); setRenameVal(board.title) }}
                    onRenameConfirm={() => renameBoard(board.id)}
                    onRenameCancel={() => setRenamingId(null)}
                    onRenameChange={setRenameVal}
                    onDelete={() => deleteBoard(board.id)}
                    onShare={() => setSharingBoard(board)}
                  />
                ))}
              </div>
            </section>

            {/* Partagés avec moi */}
            {filteredShared.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                  Partagés avec moi ({filteredShared.length})
                </h2>
                <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-2'}>
                  {filteredShared.map(board => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      view={view}
                      isOwner={false}
                      renamingId={null}
                      renameVal=""
                      deletingId={null}
                      onOpen={() => router.push(`/business/board/${board.id}`)}
                      onRename={() => {}}
                      onRenameConfirm={() => {}}
                      onRenameCancel={() => {}}
                      onRenameChange={() => {}}
                      onDelete={() => {}}
                      onShare={() => setSharingBoard(board)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BoardCard({
  board, view, isOwner,
  renamingId, renameVal, deletingId,
  onOpen, onRename, onRenameConfirm, onRenameCancel, onRenameChange, onDelete, onShare,
}: {
  board: BoardMeta; view: 'grid' | 'list'; isOwner: boolean
  renamingId: string | null; renameVal: string; deletingId: string | null
  onOpen: () => void
  onRename: () => void; onRenameConfirm: () => void; onRenameCancel: () => void
  onRenameChange: (v: string) => void; onDelete: () => void; onShare: () => void
}) {
  const isRenaming = renamingId === board.id
  const isDeleting = deletingId === board.id

  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl border hover:border-indigo-300 transition-colors cursor-pointer group"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
        onClick={onOpen}>
        <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-2xl"
          style={{ backgroundColor: 'var(--bg)' }}>
          {board.thumbnail ? <img src={board.thumbnail} alt="" className="w-full h-full object-cover" /> : '🎨'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{board.title}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Modifié {timeAgo(board.updated_at)}</p>
        </div>
        {isOwner && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={onRename} className="text-xs p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Renommer">✏️</button>
            <button onClick={onDelete} disabled={isDeleting} className="text-xs p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Supprimer">🗑️</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="group relative rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
      {/* Preview */}
      <div className="aspect-[4/3] cursor-pointer overflow-hidden flex items-center justify-center text-5xl relative"
        style={{ backgroundColor: 'var(--bg)' }}
        onClick={onOpen}>
        {board.thumbnail
          ? <img src={board.thumbnail} alt="" className="w-full h-full object-cover" />
          : <span>🎨</span>
        }
        {board.permission && (
          <span className="absolute bottom-1 right-1 text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-medium">
            {board.permission === 'edit' ? 'Édition' : 'Lecture'}
          </span>
        )}
        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-sm bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg font-medium shadow" style={{ color: 'var(--text)' }}>Ouvrir</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {isRenaming ? (
          <div className="space-y-1.5">
            <input autoFocus value={renameVal} onChange={e => onRenameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onRenameConfirm(); if (e.key === 'Escape') onRenameCancel() }}
              className="w-full text-sm px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <div className="flex gap-1">
              <button onClick={onRenameConfirm} className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded">✓</button>
              <button onClick={onRenameCancel} className="text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>✕</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium truncate cursor-pointer" style={{ color: 'var(--text)' }} onClick={onOpen}>{board.title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{timeAgo(board.updated_at)}</p>
          </>
        )}
      </div>

      {/* Actions (hover) */}
      {!isRenaming && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwner && (
            <button onClick={e => { e.stopPropagation(); onRename() }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              style={{ backgroundColor: 'var(--bg-card)' }} title="Renommer">✏️</button>
          )}
          <button onClick={e => { e.stopPropagation(); onShare() }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            style={{ backgroundColor: 'var(--bg-card)' }} title="Partager">👥</button>
          {isOwner && (
            <button onClick={e => { e.stopPropagation(); onDelete() }} disabled={isDeleting}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"
              style={{ backgroundColor: 'var(--bg-card)' }} title="Supprimer">🗑️</button>
          )}
        </div>
      )}
    </div>
  )
}
