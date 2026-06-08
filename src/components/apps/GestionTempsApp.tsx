'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'

// ─── Types ────────────────────────────────────────────────────

type ProjectType   = 'strategic' | 'rse' | 'both'
type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
type ActionStatus  = 'todo' | 'in_progress' | 'done' | 'cancelled'
type Priority      = 'low' | 'medium' | 'high'
type MemberRole    = 'editor' | 'viewer'

interface GTMember {
  user_id: string
  email: string
  role: MemberRole
}

interface GTProject {
  id: string
  owner_id: string
  name: string
  description?: string
  type: ProjectType
  color: string
  status: ProjectStatus
  start_date?: string
  end_date?: string
  created_at: string
  is_owner: boolean
  members: GTMember[]
  planned_hours: number
  actual_hours: number
  action_count: number
}

interface GTAction {
  id: string
  project_id: string
  name: string
  description?: string
  planned_hours: number
  status: ActionStatus
  priority: Priority
  due_date?: string
  order_index: number
  created_at: string
  actual_hours: number
  actual_by_user: Record<string, number>
}

interface GTEntry {
  id: string
  action_id: string
  project_id: string
  user_id: string
  user_email: string
  date: string
  hours: number
  note?: string
  created_at: string
  action_name?: string
  project_name?: string
  project_color?: string
  project_type?: string
}

// ─── Constantes ───────────────────────────────────────────────

const TYPE_LABELS: Record<ProjectType, { label: string; color: string; bg: string }> = {
  strategic: { label: 'Stratégique', color: '#3b82f6', bg: '#eff6ff' },
  rse:       { label: 'RSE',         color: '#10b981', bg: '#ecfdf5' },
  both:      { label: 'Strat. & RSE', color: '#8b5cf6', bg: '#f5f3ff' },
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Actif', paused: 'En pause', completed: 'Terminé', archived: 'Archivé',
}

const ACTION_STATUS: Record<ActionStatus, { label: string; color: string }> = {
  todo:        { label: 'À faire',    color: 'gray' },
  in_progress: { label: 'En cours',   color: 'blue' },
  done:        { label: 'Terminé',    color: 'green' },
  cancelled:   { label: 'Annulé',     color: 'red' },
}

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  low:    { label: 'Basse',   color: 'gray' },
  medium: { label: 'Moyenne', color: 'amber' },
  high:   { label: 'Haute',   color: 'red' },
}

const PROJECT_COLORS = [
  '#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
]

// ─── Helpers UI ───────────────────────────────────────────────

function fmtH(h: number) {
  if (!h) return '0 h'
  const i = Math.floor(h), d = Math.round((h - i) * 60)
  return d > 0 ? `${i} h ${d} min` : `${i} h`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR')
}

function pct(actual: number, planned: number) {
  if (!planned) return null
  return Math.min(Math.round((actual / planned) * 100), 999)
}

function ProgressBar({ actual, planned, color = '#10b981' }: { actual: number; planned: number; color?: string }) {
  const p = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0
  const over = planned > 0 && actual > planned
  return (
    <div className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${p}%`, backgroundColor: over ? '#ef4444' : color }}
      />
    </div>
  )
}

function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: string }) {
  const cls: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cls[variant] ?? cls.gray}`}>
      {children}
    </span>
  )
}

// ─── Tab Tableau de bord ──────────────────────────────────────

function TabDashboard({ projects, recentEntries, onSelectProject, onTabChange }: {
  projects: GTProject[]
  recentEntries: GTEntry[]
  onSelectProject: (id: string) => void
  onTabChange: (tab: string) => void
}) {
  const totalPlanned = projects.reduce((s, p) => s + p.planned_hours, 0)
  const totalActual  = projects.reduce((s, p) => s + p.actual_hours, 0)
  const activeProjects = projects.filter(p => p.status === 'active').length
  const overBudget = projects.filter(p => p.planned_hours > 0 && p.actual_hours > p.planned_hours)

  // Saisies des 7 derniers jours
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekEntries = recentEntries.filter(e => new Date(e.date) >= weekAgo)
  const weekHours = weekEntries.reduce((s, e) => s + e.hours, 0)

  // Top projets par heures réalisées
  const topProjects = [...projects].sort((a, b) => b.actual_hours - a.actual_hours).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Projets actifs',    value: activeProjects, unit: '', color: '#10b981', icon: '📁' },
          { label: 'Heures planifiées', value: fmtH(totalPlanned), unit: '', color: '#3b82f6', icon: '📋' },
          { label: 'Heures réalisées',  value: fmtH(totalActual),  unit: '', color: '#8b5cf6', icon: '⏱️' },
          { label: 'Cette semaine',     value: fmtH(weekHours),    unit: '', color: '#f59e0b', icon: '📅' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{kpi.icon}</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Avancement global */}
      {totalPlanned > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Avancement global</h3>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{pct(totalActual, totalPlanned)} %</span>
          </div>
          <ProgressBar actual={totalActual} planned={totalPlanned} />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {fmtH(totalActual)} réalisés sur {fmtH(totalPlanned)} planifiés
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top projets */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Projets — temps passé</h3>
          {topProjects.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun projet. <button onClick={() => onTabChange('projects')} className="text-emerald-600 hover:underline">Créer un projet</button></p>
          ) : (
            <div className="space-y-3">
              {topProjects.map(p => {
                const t = TYPE_LABELS[p.type]
                return (
                  <div key={p.id} className="cursor-pointer group" onClick={() => { onSelectProject(p.id); onTabChange('actions') }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate flex-1">{p.name}</span>
                      <span className="text-xs text-gray-400">{fmtH(p.actual_hours)}</span>
                    </div>
                    <ProgressBar actual={p.actual_hours} planned={p.planned_hours} color={p.color} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Saisies récentes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Saisies récentes</h3>
            <button onClick={() => onTabChange('saisie')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">+ Nouvelle saisie</button>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune saisie. <button onClick={() => onTabChange('saisie')} className="text-emerald-600 hover:underline">Enregistrer du temps</button></p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentEntries.slice(0, 15).map(e => (
                <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: e.project_color ?? '#10b981' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{e.action_name}</p>
                    <p className="text-xs text-gray-400 truncate">{e.project_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmtH(e.hours)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(e.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertes dépassement */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-400 text-sm mb-2">⚠️ Projets hors budget ({overBudget.length})</h3>
          <div className="space-y-1">
            {overBudget.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-red-700 dark:text-red-400 font-medium">{p.name}</span>
                <span className="text-red-500">— {fmtH(p.actual_hours)} réalisés pour {fmtH(p.planned_hours)} planifiés (+{pct(p.actual_hours - p.planned_hours, p.planned_hours)} %)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Projets ──────────────────────────────────────────────

function TabProjects({ projects, loading, onSelect, selectedId, onRefresh }: {
  projects: GTProject[]
  loading: boolean
  onSelect: (id: string) => void
  selectedId: string | null
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editProject, setEditProject] = useState<GTProject | null>(null)
  const [sharePanel, setSharePanel] = useState<string | null>(null)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<MemberRole>('editor')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')

  const [form, setForm] = useState({
    name: '', description: '', type: 'strategic' as ProjectType,
    color: '#10b981', status: 'active' as ProjectStatus,
    start_date: '', end_date: '',
  })

  function openEdit(p: GTProject) {
    setForm({
      name: p.name, description: p.description ?? '', type: p.type,
      color: p.color, status: p.status,
      start_date: p.start_date ?? '', end_date: p.end_date ?? '',
    })
    setEditProject(p)
    setShowForm(true)
  }

  function resetForm() {
    setForm({ name: '', description: '', type: 'strategic', color: '#10b981', status: 'active', start_date: '', end_date: '' })
    setEditProject(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editProject) {
        await fetch(`/api/gestion-temps/projects/${editProject.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/gestion-temps/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      resetForm()
      onRefresh()
    } finally { setSaving(false) }
  }

  async function handleDelete(p: GTProject) {
    if (!confirm(`Supprimer le projet "${p.name}" ? Toutes les actions et saisies seront perdues.`)) return
    await fetch(`/api/gestion-temps/projects/${p.id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function handleShare() {
    if (!shareEmail.trim() || !sharePanel) return
    setShareSaving(true); setShareError('')
    try {
      // Chercher l'user_id à partir de l'email via l'API admin
      const res = await fetch('/api/users/by-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim().toLowerCase() }),
      })
      const json = await res.json()
      if (!res.ok || !json.data?.id) {
        setShareError('Utilisateur introuvable. Il doit avoir un compte sur la plateforme.')
        return
      }
      await fetch(`/api/gestion-temps/projects/${sharePanel}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_member', email: shareEmail.trim(), user_id: json.data.id, role: shareRole }),
      })
      setShareEmail(''); onRefresh()
    } finally { setShareSaving(false) }
  }

  async function handleRemoveMember(projectId: string, userId: string) {
    await fetch(`/api/gestion-temps/projects/${projectId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', user_id: userId }),
    })
    onRefresh()
  }

  const activeProjects   = projects.filter(p => p.status === 'active')
  const inactiveProjects = projects.filter(p => p.status !== 'active')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Projets</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{projects.length} projet{projects.length !== 1 ? 's' : ''} (dont {projects.filter(p => !p.is_owner).length} partagé{projects.filter(p => !p.is_owner).length !== 1 ? 's' : ''})</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
          + Nouveau projet
        </button>
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
            {editProject ? 'Modifier le projet' : 'Nouveau projet'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom du projet *"
              className="col-span-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optionnel)" rows={2}
              className="col-span-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ProjectType }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="strategic">Stratégique</option>
              <option value="rse">RSE</option>
              <option value="both">Stratégique & RSE</option>
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          {/* Couleur */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Couleur</p>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Annuler</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors">
              {saving ? 'Enregistrement...' : editProject ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-gray-400 animate-pulse">Chargement...</p>}

      {/* Liste projets actifs */}
      {[{ label: 'Projets actifs', items: activeProjects }, { label: 'Autres', items: inactiveProjects }].map(group => (
        group.items.length > 0 && (
          <div key={group.label}>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{group.label} ({group.items.length})</h4>
            <div className="space-y-2">
              {group.items.map(p => {
                const t = TYPE_LABELS[p.type]
                const over = p.planned_hours > 0 && p.actual_hours > p.planned_hours
                return (
                  <div key={p.id} className={`bg-white dark:bg-gray-800 rounded-xl border transition-colors ${selectedId === p.id ? 'border-emerald-400 dark:border-emerald-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => onSelect(p.id)}
                              className="font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm text-left">
                              {p.name}
                            </button>
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ color: t.color, backgroundColor: t.bg }}>
                              {t.label}
                            </span>
                            {!p.is_owner && <Badge variant="gray">Partagé</Badge>}
                            {over && <Badge variant="red">Hors budget</Badge>}
                          </div>
                          {p.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{p.description}</p>}
                          {/* Stats */}
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">📋 {p.action_count} action{p.action_count !== 1 ? 's' : ''}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">📋 Prévu : {fmtH(p.planned_hours)}</span>
                            <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>⏱️ Réalisé : {fmtH(p.actual_hours)}</span>
                            {p.planned_hours > 0 && <span className="text-xs text-gray-400">{pct(p.actual_hours, p.planned_hours)} %</span>}
                            <span className="text-xs text-gray-400">👥 {p.members.length + 1} membre{p.members.length !== 0 ? 's' : ''}</span>
                          </div>
                          {p.planned_hours > 0 && (
                            <div className="mt-2">
                              <ProgressBar actual={p.actual_hours} planned={p.planned_hours} color={p.color} />
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onSelect(p.id)} title="Voir les actions"
                            className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm">📋</button>
                          {p.is_owner && <>
                            <button onClick={() => setSharePanel(sharePanel === p.id ? null : p.id)} title="Partager"
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm">👥</button>
                            <button onClick={() => openEdit(p)} title="Modifier"
                              className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm">✏️</button>
                            <button onClick={() => handleDelete(p)} title="Supprimer"
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm">🗑️</button>
                          </>}
                        </div>
                      </div>
                    </div>

                    {/* Panel partage */}
                    {sharePanel === p.id && p.is_owner && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Partager avec un collaborateur</p>
                        <div className="flex gap-2 mb-2">
                          <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                            placeholder="Email du collaborateur"
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none" />
                          <select value={shareRole} onChange={e => setShareRole(e.target.value as MemberRole)}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none">
                            <option value="editor">Éditeur</option>
                            <option value="viewer">Lecteur</option>
                          </select>
                          <button onClick={handleShare} disabled={shareSaving || !shareEmail.trim()}
                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg">
                            {shareSaving ? '...' : 'Partager'}
                          </button>
                        </div>
                        {shareError && <p className="text-xs text-red-600 mb-2">{shareError}</p>}
                        {p.members.length > 0 && (
                          <div className="space-y-1">
                            {p.members.map(m => (
                              <div key={m.user_id} className="flex items-center gap-2 text-xs">
                                <span className="flex-1 text-gray-700 dark:text-gray-300">{m.email}</span>
                                <Badge variant="gray">{m.role === 'editor' ? 'Éditeur' : 'Lecteur'}</Badge>
                                <button onClick={() => handleRemoveMember(p.id, m.user_id)} className="text-red-400 hover:text-red-600">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      ))}

      {projects.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-2">📁</p>
          <p className="text-sm">Aucun projet.</p>
          <p className="text-xs mt-1">Créez votre premier projet stratégique ou RSE.</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab Actions ──────────────────────────────────────────────

function TabActions({ projects, selectedProjectId, onSelectProject, onRefresh }: {
  projects: GTProject[]
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onRefresh: () => void
}) {
  const [actions, setActions]   = useState<GTAction[]>([])
  const [loading, setLoading]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editAction, setEditAction] = useState<GTAction | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', planned_hours: '', priority: 'medium' as Priority, due_date: '',
  })

  const project = projects.find(p => p.id === selectedProjectId)

  const loadActions = useCallback(async (projectId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gestion-temps/projects/${projectId}/actions`)
      const json = await res.json()
      if (res.ok) setActions(json.data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedProjectId) loadActions(selectedProjectId)
    else setActions([])
  }, [selectedProjectId, loadActions])

  function resetForm() {
    setForm({ name: '', description: '', planned_hours: '', priority: 'medium', due_date: '' })
    setEditAction(null); setShowForm(false)
  }

  function openEdit(a: GTAction) {
    setForm({
      name: a.name, description: a.description ?? '',
      planned_hours: a.planned_hours > 0 ? String(a.planned_hours) : '',
      priority: a.priority, due_date: a.due_date ?? '',
    })
    setEditAction(a); setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !selectedProjectId) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || null,
        planned_hours: Number(form.planned_hours) || 0,
        priority: form.priority,
        due_date: form.due_date || null,
      }
      if (editAction) {
        await fetch(`/api/gestion-temps/projects/${selectedProjectId}/actions/${editAction.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      } else {
        await fetch(`/api/gestion-temps/projects/${selectedProjectId}/actions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      }
      resetForm(); loadActions(selectedProjectId); onRefresh()
    } finally { setSaving(false) }
  }

  async function handleStatusChange(a: GTAction, status: ActionStatus) {
    await fetch(`/api/gestion-temps/projects/${a.project_id}/actions/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadActions(a.project_id); onRefresh()
  }

  async function handleDelete(a: GTAction) {
    if (!confirm(`Supprimer l'action "${a.name}" ? Les saisies de temps associées seront perdues.`)) return
    await fetch(`/api/gestion-temps/projects/${a.project_id}/actions/${a.id}`, { method: 'DELETE' })
    loadActions(a.project_id); onRefresh()
  }

  const totalPlanned = actions.reduce((s, a) => s + a.planned_hours, 0)
  const totalActual  = actions.reduce((s, a) => s + a.actual_hours, 0)

  return (
    <div className="space-y-4">
      {/* Sélecteur de projet */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Projet sélectionné</label>
        <select value={selectedProjectId ?? ''} onChange={e => onSelectProject(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="">— Choisir un projet —</option>
          {projects.filter(p => p.status !== 'archived').map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!selectedProjectId && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm">Sélectionnez un projet pour voir ses actions.</p>
        </div>
      )}

      {selectedProjectId && project && (
        <>
          {/* En-tête projet + stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
              <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ color: TYPE_LABELS[project.type].color, backgroundColor: TYPE_LABELS[project.type].bg }}>
                {TYPE_LABELS[project.type].label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Actions', value: actions.length },
                { label: 'Heures planifiées', value: fmtH(totalPlanned) },
                { label: 'Heures réalisées', value: fmtH(totalActual) },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
            {totalPlanned > 0 && (
              <div className="mt-3">
                <ProgressBar actual={totalActual} planned={totalPlanned} color={project.color} />
                <p className="text-xs text-gray-400 mt-1">{pct(totalActual, totalPlanned)} % réalisé</p>
              </div>
            )}
          </div>

          {/* Bouton + formulaire */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Actions ({actions.length})</h3>
            {(project.is_owner || projects.find(p => p.id === selectedProjectId)?.members?.length !== undefined) && (
              <button onClick={() => { resetForm(); setShowForm(true) }}
                className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                + Ajouter une action
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm">{editAction ? 'Modifier' : 'Nouvelle action'}</h4>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nom de l'action *"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optionnel)" rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Heures planifiées</label>
                  <input type="number" min="0" step="0.5" value={form.planned_hours}
                    onChange={e => setForm(f => ({ ...f, planned_hours: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priorité</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Échéance</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Annuler</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg">
                  {saving ? 'Enregistrement...' : editAction ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          )}

          {loading && <p className="text-xs text-gray-400 animate-pulse">Chargement...</p>}

          {/* Liste des actions */}
          {!loading && actions.length === 0 && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">Aucune action pour ce projet.</p>
            </div>
          )}

          <div className="space-y-2">
            {actions.map(a => {
              const st = ACTION_STATUS[a.status]
              const pr = PRIORITY_LABELS[a.priority]
              const over = a.planned_hours > 0 && a.actual_hours > a.planned_hours
              const isLate = a.due_date && a.status !== 'done' && new Date(a.due_date) < new Date()
              return (
                <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3">
                    {/* Statut */}
                    <select value={a.status} onChange={e => handleStatusChange(a, e.target.value as ActionStatus)}
                      className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer flex-shrink-0 ${
                        a.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                        a.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                        a.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                      {Object.entries(ACTION_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                    </select>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${a.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.name}</span>
                        <Badge variant={pr.color as 'red' | 'amber' | 'gray'}>{pr.label}</Badge>
                        {isLate && <Badge variant="red">En retard</Badge>}
                        {over && <Badge variant="red">Hors budget</Badge>}
                      </div>
                      {a.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{a.description}</p>}

                      {/* Stats heures */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {a.planned_hours > 0 && <span className="text-xs text-gray-500">📋 {fmtH(a.planned_hours)} planifiés</span>}
                        <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>⏱️ {fmtH(a.actual_hours)} réalisés</span>
                        {a.due_date && <span className={`text-xs ${isLate ? 'text-red-600' : 'text-gray-400'}`}>📅 {fmtDate(a.due_date)}</span>}
                      </div>

                      {a.planned_hours > 0 && (
                        <div className="mt-2">
                          <ProgressBar actual={a.actual_hours} planned={a.planned_hours} color={project.color} />
                          <p className="text-xs text-gray-400 mt-0.5">{pct(a.actual_hours, a.planned_hours) ?? 0} %</p>
                        </div>
                      )}

                      {/* Par utilisateur */}
                      {Object.keys(a.actual_by_user).length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(a.actual_by_user).map(([email, h]) => (
                            <span key={email} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                              {email.split('@')[0]} : {fmtH(h)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm">✏️</button>
                      {project.is_owner && (
                        <button onClick={() => handleDelete(a)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm">🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab Saisie du temps ──────────────────────────────────────

function TabSaisie({ projects, onRefresh }: {
  projects: GTProject[]
  onRefresh: () => void
}) {
  const [selectedProject, setSelectedProject] = useState('')
  const [actions, setActions]   = useState<GTAction[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [recentEntries, setRecentEntries] = useState<GTEntry[]>([])
  const [form, setForm] = useState({ action_id: '', date: new Date().toISOString().split('T')[0], hours: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [editEntry, setEditEntry] = useState<GTEntry | null>(null)
  const [editForm, setEditForm] = useState({ hours: '', note: '' })

  const loadProjectActions = useCallback(async (projectId: string) => {
    setLoadingActions(true)
    try {
      const res = await fetch(`/api/gestion-temps/projects/${projectId}/actions`)
      const json = await res.json()
      setActions((json.data ?? []).filter((a: GTAction) => a.status !== 'cancelled' && a.status !== 'done'))
    } finally { setLoadingActions(false) }
  }, [])

  const loadRecent = useCallback(async () => {
    const dateFrom = new Date(); dateFrom.setDate(dateFrom.getDate() - 30)
    const res = await fetch(`/api/gestion-temps/time-entries?date_from=${dateFrom.toISOString().split('T')[0]}`)
    const json = await res.json()
    if (res.ok) setRecentEntries(json.data ?? [])
  }, [])

  useEffect(() => { loadRecent() }, [loadRecent])

  useEffect(() => {
    if (selectedProject) { loadProjectActions(selectedProject); setForm(f => ({ ...f, action_id: '' })) }
    else setActions([])
  }, [selectedProject, loadProjectActions])

  async function handleSubmit() {
    if (!form.action_id || !form.date || !form.hours) return
    setSaving(true)
    try {
      const res = await fetch('/api/gestion-temps/time-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: form.action_id, date: form.date, hours: Number(form.hours), note: form.note || null }),
      })
      if (res.ok) {
        setForm(f => ({ ...f, action_id: '', hours: '', note: '' }))
        setSuccess(true); setTimeout(() => setSuccess(false), 3000)
        loadRecent(); onRefresh()
      }
    } finally { setSaving(false) }
  }

  async function handleDeleteEntry(id: string) {
    await fetch(`/api/gestion-temps/time-entries/${id}`, { method: 'DELETE' })
    loadRecent(); onRefresh()
  }

  async function handleEditEntry() {
    if (!editEntry || !editForm.hours) return
    await fetch(`/api/gestion-temps/time-entries/${editEntry.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: Number(editForm.hours), note: editForm.note || null }),
    })
    setEditEntry(null); loadRecent(); onRefresh()
  }

  const activeProjects = projects.filter(p => p.status !== 'archived')

  return (
    <div className="space-y-6">
      {/* Formulaire de saisie */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Enregistrer du temps</h3>
        <div className="space-y-3">
          {/* Projet */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Projet</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">— Sélectionner un projet —</option>
              {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Action</label>
            <select value={form.action_id} onChange={e => setForm(f => ({ ...f, action_id: e.target.value }))}
              disabled={!selectedProject || loadingActions}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50">
              <option value="">{loadingActions ? 'Chargement...' : '— Sélectionner une action —'}</option>
              {actions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.planned_hours > 0 ? `(${fmtH(a.actual_hours)} / ${fmtH(a.planned_hours)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Durée (heures)</label>
              <input type="number" min="0.25" max="24" step="0.25" value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="ex : 2.5"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note (optionnel)</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Description de ce qui a été fait..." rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
          </div>

          <button onClick={handleSubmit}
            disabled={saving || !form.action_id || !form.date || !form.hours}
            className="w-full py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {saving ? 'Enregistrement...' : '⏱️ Enregistrer'}
          </button>

          {success && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">✓ Saisie enregistrée avec succès !</p>}
        </div>
      </div>

      {/* Historique des saisies */}
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Mes saisies récentes (30 jours)</h3>
        {recentEntries.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Aucune saisie récente.</p>
        ) : (
          <div className="space-y-2">
            {recentEntries.map(e => (
              <div key={e.id}>
                {editEntry?.id === e.id ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-emerald-400 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0.25" max="24" step="0.25" value={editForm.hours}
                        onChange={ev => setEditForm(f => ({ ...f, hours: ev.target.value }))}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none" />
                      <input value={editForm.note} onChange={ev => setEditForm(f => ({ ...f, note: ev.target.value }))}
                        placeholder="Note"
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditEntry(null)} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg">Annuler</button>
                      <button onClick={handleEditEntry} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg">Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: e.project_color ?? '#10b981' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{e.action_name}</p>
                      <p className="text-xs text-gray-400 truncate">{e.project_name}</p>
                      {e.note && <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5 truncate">{e.note}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmtH(e.hours)}</p>
                      <p className="text-xs text-gray-400">{fmtDate(e.date)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditEntry(e); setEditForm({ hours: String(e.hours), note: e.note ?? '' }) }}
                        className="p-1 text-gray-400 hover:text-emerald-600 text-xs">✏️</button>
                      <button onClick={() => handleDeleteEntry(e.id)} className="p-1 text-gray-400 hover:text-red-600 text-xs">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab Bilan ────────────────────────────────────────────────

function TabBilan({ projects }: { projects: GTProject[] }) {
  const [filterProject, setFilterProject] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [filterDateTo, setFilterDateTo] = useState(new Date().toISOString().split('T')[0])
  const [actions, setActions] = useState<GTAction[]>([])
  const [entries, setEntries] = useState<GTEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterProject) params.set('project_id', filterProject)
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo)   params.set('date_to', filterDateTo)

      const [entriesRes] = await Promise.all([
        fetch(`/api/gestion-temps/time-entries?${params}`),
      ])
      const entriesJson = await entriesRes.json()
      setEntries(entriesJson.data ?? [])

      if (filterProject) {
        const actionsRes = await fetch(`/api/gestion-temps/projects/${filterProject}/actions`)
        const actionsJson = await actionsRes.json()
        setActions(actionsJson.data ?? [])
      } else {
        // Charger toutes les actions de tous les projets
        const allActions: GTAction[] = []
        for (const p of projects) {
          const res = await fetch(`/api/gestion-temps/projects/${p.id}/actions`)
          const json = await res.json()
          allActions.push(...(json.data ?? []))
        }
        setActions(allActions)
      }
    } finally { setLoading(false) }
  }, [filterProject, filterDateFrom, filterDateTo, projects])

  useEffect(() => { if (projects.length > 0) load() }, [load, projects.length])

  // Agrégat par projet → action → user
  const projectsToShow = filterProject
    ? projects.filter(p => p.id === filterProject)
    : projects

  // Heures réelles par action (filtrées par date)
  const actualByAction: Record<string, { total: number; byUser: Record<string, number> }> = {}
  for (const e of entries) {
    if (!actualByAction[e.action_id]) actualByAction[e.action_id] = { total: 0, byUser: {} }
    actualByAction[e.action_id].total += e.hours
    actualByAction[e.action_id].byUser[e.user_email] =
      (actualByAction[e.action_id].byUser[e.user_email] ?? 0) + e.hours
  }

  // Heures par utilisateur (globales)
  const byUser: Record<string, number> = {}
  for (const e of entries) { byUser[e.user_email] = (byUser[e.user_email] ?? 0) + e.hours }
  const sortedUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1])

  const totalActual  = entries.reduce((s, e) => s + e.hours, 0)
  const totalPlanned = actions.filter(a => filterProject ? true : projectsToShow.some(p => p.id === a.project_id))
    .reduce((s, a) => s + a.planned_hours, 0)

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Filtres</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">Tous les projets</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
        <button onClick={load} disabled={loading}
          className="mt-3 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg">
          {loading ? 'Chargement...' : '↺ Actualiser'}
        </button>
      </div>

      {/* Synthèse globale */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Heures planifiées', value: fmtH(totalPlanned), icon: '📋' },
          { label: 'Heures réalisées', value: fmtH(totalActual), icon: '⏱️' },
          { label: 'Taux de réalisation', value: totalPlanned > 0 ? `${pct(totalActual, totalPlanned)} %` : '—', icon: '📊' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tableau par projet / action */}
      {loading ? <p className="text-xs text-gray-400 animate-pulse">Chargement du bilan...</p> : (
        <div className="space-y-4">
          {projectsToShow.map(p => {
            const pActions = actions.filter(a => a.project_id === p.id)
            if (pActions.length === 0) return null
            const pPlanned = pActions.reduce((s, a) => s + a.planned_hours, 0)
            const pActual  = pActions.reduce((s, a) => s + (actualByAction[a.id]?.total ?? 0), 0)
            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* En-tête projet */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex-1">{p.name}</h4>
                  <span className="text-xs text-gray-400">{TYPE_LABELS[p.type].label}</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{fmtH(pActual)} / {fmtH(pPlanned)}</span>
                  {pPlanned > 0 && <span className={`text-xs font-bold ${pActual > pPlanned ? 'text-red-600' : 'text-emerald-600'}`}>{pct(pActual, pPlanned)} %</span>}
                </div>
                {/* Tableau actions */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Action</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Statut</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Planifié</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Réalisé</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 dark:text-gray-400">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pActions.map(a => {
                      const actual  = actualByAction[a.id]?.total ?? 0
                      const byUser2 = actualByAction[a.id]?.byUser ?? {}
                      const over    = a.planned_hours > 0 && actual > a.planned_hours
                      return (
                        <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-800 dark:text-gray-200">{a.name}</p>
                            {Object.keys(byUser2).length > 0 && (
                              <p className="text-gray-400 truncate">
                                {Object.entries(byUser2).map(([e, h]) => `${e.split('@')[0]} (${fmtH(h)})`).join(' · ')}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                              a.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                              a.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                              a.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>{ACTION_STATUS[a.status].label}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{a.planned_hours > 0 ? fmtH(a.planned_hours) : '—'}</td>
                          <td className={`px-3 py-2 text-right font-medium ${over ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}>{actual > 0 ? fmtH(actual) : '—'}</td>
                          <td className={`px-4 py-2 text-right font-bold ${over ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {a.planned_hours > 0 && actual > 0 ? `${pct(actual, a.planned_hours)} %` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">Total</td>
                      <td />
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmtH(pPlanned)}</td>
                      <td className={`px-3 py-2 text-right ${pActual > pPlanned && pPlanned > 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{fmtH(pActual)}</td>
                      <td className={`px-4 py-2 text-right ${pActual > pPlanned && pPlanned > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {pPlanned > 0 ? `${pct(pActual, pPlanned)} %` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Heures par utilisateur */}
      {sortedUsers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Heures par contributeur</h3>
          <div className="space-y-2">
            {sortedUsers.map(([email, hours]) => (
              <div key={email} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 dark:text-gray-300 w-48 truncate">{email}</span>
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(hours / (sortedUsers[0][1] || 1)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-16 text-right">{fmtH(hours)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'projects',  label: 'Projets',         icon: '📁' },
  { id: 'actions',   label: 'Actions',          icon: '📋' },
  { id: 'saisie',    label: 'Saisie du temps',  icon: '⏱️' },
  { id: 'bilan',     label: 'Bilan',            icon: '📈' },
]

export default function GestionTempsApp({ ctx: _ctx }: { ctx: RseContext }) {
  const [tab, setTab]                     = useState('dashboard')
  const [projects, setProjects]           = useState<GTProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [recentEntries, setRecentEntries] = useState<GTEntry[]>([])

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const res = await fetch('/api/gestion-temps/projects')
      const json = await res.json()
      if (res.ok) setProjects(json.data ?? [])
    } finally { setLoadingProjects(false) }
  }, [])

  const loadRecentEntries = useCallback(async () => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    const res = await fetch(`/api/gestion-temps/time-entries?date_from=${d.toISOString().split('T')[0]}`)
    const json = await res.json()
    if (res.ok) setRecentEntries(json.data ?? [])
  }, [])

  useEffect(() => {
    loadProjects()
    loadRecentEntries()
  }, [loadProjects, loadRecentEntries])

  function handleRefresh() { loadProjects(); loadRecentEntries() }

  function handleSelectProject(id: string) {
    setSelectedProjectId(id)
    setTab('actions')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'dashboard' && (
          <TabDashboard
            projects={projects}
            recentEntries={recentEntries}
            onSelectProject={handleSelectProject}
            onTabChange={setTab}
          />
        )}
        {tab === 'projects' && (
          <TabProjects
            projects={projects}
            loading={loadingProjects}
            onSelect={handleSelectProject}
            selectedId={selectedProjectId}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'actions' && (
          <TabActions
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={id => setSelectedProjectId(id)}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'saisie' && (
          <TabSaisie
            projects={projects}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'bilan' && (
          <TabBilan projects={projects} />
        )}
      </div>
    </div>
  )
}
