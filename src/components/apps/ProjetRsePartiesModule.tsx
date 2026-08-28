'use client'

// Sous-application « Parties prenantes » de Projet RSE (méthode du cours,
// Practice Guide §7.1) : registre, matrice Pouvoir × Intérêt interactive et
// plan d'engagement. Particularité du cours : « la société » et « la Terre »
// sont des parties prenantes à part entière.
//
// API : /api/projet-rse/projets/[id]/parties · engagements · import-parties

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'

// ── Types (contrat API) ───────────────────────────────────────────────────────

type Categorie = 'verte' | 'orange' | 'bleue'
type Attitude = 'alliee' | 'ouverte' | 'neutre' | 'vigilante' | 'opposee'
type StatutSuivi = 'a_engager' | 'engagee' | 'a_risque' | 'ok'
type StatutEngagement = 'a_faire' | 'en_cours' | 'fait'

interface Partie {
  id: string
  nom: string
  organisation: string | null
  categorie: Categorie
  role: string | null
  pouvoir: number
  interet: number
  attitude: Attitude
  attentes: string | null
  verbatims: string | null
  strategie: string | null
  statut_suivi: StatutSuivi
}

interface Engagement {
  id: string
  partie_id: string
  action: string
  responsable: string | null
  canal: string | null
  frequence: string | null
  echeance: string | null
  statut: StatutEngagement
}

interface PpSession {
  id: string
  name: string
  organisation: string | null
  exercice: string | null
  pp_count: number
}

// ── Libellés & couleurs ───────────────────────────────────────────────────────

const CATEGORIES: { value: Categorie; label: string; dot: string; badge: string }[] = [
  { value: 'verte', label: '🟢 Opérationnel quotidien', dot: '#16a34a', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'orange', label: '🟠 Gouvernance', dot: '#ea580c', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  { value: 'bleue', label: '🔵 Externe critique', dot: '#2563eb', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
]

const ATTITUDES: { value: Attitude; label: string; ring: string; badge: string; dash?: string }[] = [
  { value: 'alliee', label: 'Alliée', ring: '#15803d', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'ouverte', label: 'Ouverte', ring: '#0d9488', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  { value: 'neutre', label: 'Neutre', ring: '#6b7280', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'vigilante', label: 'Vigilante', ring: '#d97706', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', dash: '4 2' },
  { value: 'opposee', label: 'Opposée', ring: '#dc2626', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', dash: '2 2' },
]

const STATUTS_SUIVI: { value: StatutSuivi; label: string; badge: string }[] = [
  { value: 'a_engager', label: 'À engager', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'engagee', label: 'Engagée', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { value: 'a_risque', label: 'À risque', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { value: 'ok', label: 'OK', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
]

const STATUTS_ENGAGEMENT: Record<StatutEngagement, { label: string; badge: string; next: StatutEngagement }> = {
  a_faire: { label: 'À faire', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', next: 'en_cours' },
  en_cours: { label: 'En cours', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', next: 'fait' },
  fait: { label: 'Fait ✓', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', next: 'a_faire' },
}

function catOf(v: Categorie) { return CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0] }
function attOf(v: Attitude) { return ATTITUDES.find(a => a.value === v) ?? ATTITUDES[2] }
function suiviOf(v: StatutSuivi) { return STATUTS_SUIVI.find(s => s.value === v) ?? STATUTS_SUIVI[0] }

function quadrantStrategie(pouvoir: number, interet: number): string {
  if (pouvoir >= 3 && interet >= 3) return 'Engager pleinement'
  if (pouvoir >= 3) return 'Garder satisfait'
  if (interet >= 3) return 'Tenir informé'
  return 'Information minimale'
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Fiche d'édition ───────────────────────────────────────────────────────────

interface PartieForm {
  id?: string
  nom: string
  organisation: string
  categorie: Categorie
  role: string
  pouvoir: number
  interet: number
  attitude: Attitude
  attentes: string
  verbatims: string
  strategie: string
  statut_suivi: StatutSuivi
}

const EMPTY_FORM: PartieForm = {
  nom: '', organisation: '', categorie: 'verte', role: '', pouvoir: 3, interet: 3,
  attitude: 'neutre', attentes: '', verbatims: '', strategie: '', statut_suivi: 'a_engager',
}

const PRESET_TERRE: PartieForm = {
  ...EMPTY_FORM,
  nom: 'La Terre',
  categorie: 'bleue',
  role: 'Partie prenante silencieuse — écosystèmes, climat, ressources',
  pouvoir: 5, interet: 5,
  attentes: 'Préservation des ressources, limitation des émissions et des déchets, respect des limites planétaires.',
  strategie: 'Engager pleinement',
  attitude: 'neutre',
}

const PRESET_SOCIETE: PartieForm = {
  ...EMPTY_FORM,
  nom: 'La société',
  categorie: 'bleue',
  role: 'Partie prenante silencieuse — communautés, générations futures',
  pouvoir: 4, interet: 4,
  attentes: 'Retombées sociales positives, transparence, équité, absence d’externalités négatives pour les communautés.',
  strategie: 'Engager pleinement',
  attitude: 'neutre',
}

// ── Composant principal ───────────────────────────────────────────────────────

type SubTab = 'registre' | 'matrice' | 'plan'
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'registre', label: '📇 Registre' },
  { key: 'matrice', label: '🧭 Matrice Pouvoir × Intérêt' },
  { key: 'plan', label: '🤝 Plan d’engagement' },
]

export default function ProjetRsePartiesModule({ projetId, phase, readOnly }: ProjetRseModuleProps) {
  const base = `/api/projet-rse/projets/${projetId}`

  const [tab, setTab] = useState<SubTab>('registre')
  const [error, setError] = useState<string | null>(null)
  const [parties, setParties] = useState<Partie[]>([])
  const [loaded, setLoaded] = useState(false)

  // Fiche d'édition
  const [form, setForm] = useState<PartieForm | null>(null)
  const [saving, setSaving] = useState(false)

  // Import depuis Parties Prenantes & Matérialité
  const [showImport, setShowImport] = useState(false)
  const [sessions, setSessions] = useState<PpSession[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importInfo, setImportInfo] = useState<string | null>(null)

  // Engagements
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [filterPartie, setFilterPartie] = useState('')

  // Rappel de revue : la phase du projet a-t-elle changé depuis la dernière
  // modification des parties ? (heuristique simple, mémorisée en localStorage)
  const phaseKey = `projet-rse-parties-phase-${projetId}`
  const [phaseBanner, setPhaseBanner] = useState(false)
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(phaseKey)
      setPhaseBanner(last !== null && last !== phase)
    } catch { /* stockage indisponible : pas de bandeau */ }
  }, [phase, phaseKey])
  const rememberPhase = useCallback(() => {
    try { window.localStorage.setItem(phaseKey, phase) } catch { /* ignore */ }
    setPhaseBanner(false)
  }, [phaseKey, phase])

  // ── Chargements ──
  const loadParties = useCallback(async () => {
    try {
      const res = await fetch(`${base}/parties`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des parties prenantes')
      setParties(((j as { parties?: Partie[] }).parties) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setLoaded(true) }
  }, [base])

  const loadEngagements = useCallback(async () => {
    try {
      const res = await fetch(`${base}/engagements`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement du plan d’engagement')
      setEngagements(((j as { engagements?: Engagement[] }).engagements) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base])

  useEffect(() => { loadParties(); loadEngagements() }, [loadParties, loadEngagements])

  // ── Mutations parties ──
  const savePartie = useCallback(async () => {
    if (!form || !form.nom.trim()) return
    setSaving(true); setError(null)
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        nom: form.nom.trim(),
        organisation: form.organisation.trim() || null,
        categorie: form.categorie,
        role: form.role.trim() || null,
        pouvoir: form.pouvoir,
        interet: form.interet,
        attitude: form.attitude,
        attentes: form.attentes.trim() || null,
        verbatims: form.verbatims.trim() || null,
        strategie: form.strategie.trim() || null,
        statut_suivi: form.statut_suivi,
      }
      const res = await fetch(`${base}/parties`, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’enregistrement')
      setForm(null)
      rememberPhase()
      await loadParties()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }, [form, base, loadParties, rememberPhase])

  const deletePartie = useCallback(async (id: string) => {
    if (!window.confirm('Supprimer cette partie prenante (et ses actions d’engagement) ?')) return
    try {
      const res = await fetch(`${base}/parties?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de suppression')
      }
      rememberPhase()
      await loadParties(); await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base, loadParties, loadEngagements, rememberPhase])

  const patchPartie = useCallback(async (id: string, champs: Partial<Partie>) => {
    // Mise à jour optimiste (drag de la matrice, changement de statut)
    setParties(prev => prev.map(p => (p.id === id ? { ...p, ...champs } : p)))
    try {
      const res = await fetch(`${base}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...champs }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de mise à jour')
      }
      rememberPhase()
    } catch (e) { setError(String((e as Error).message ?? e)); await loadParties() }
  }, [base, loadParties, rememberPhase])

  // ── Import ──
  const openImport = useCallback(async () => {
    setShowImport(true); setSessions(null); setImportInfo(null)
    try {
      const res = await fetch('/api/parties-prenantes/sessions')
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des sessions')
      setSessions(((j as { data?: PpSession[] }).data) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)); setSessions([]) }
  }, [])

  const runImport = useCallback(async (sessionId: string) => {
    setImporting(true); setError(null)
    try {
      const res = await fetch(`${base}/import-parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pp_session_id: sessionId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’import')
      const n = (j as { imported?: number }).imported ?? 0
      setImportInfo(`${n} partie${n > 1 ? 's' : ''} prenante${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}.`)
      rememberPhase()
      await loadParties()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setImporting(false) }
  }, [base, loadParties, rememberPhase])

  // ── Mutations engagements ──
  const [newEng, setNewEng] = useState<{ partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string }>(
    { partie_id: '', action: '', responsable: '', canal: '', frequence: '', echeance: '' })
  const [savingEng, setSavingEng] = useState(false)

  const addEngagement = useCallback(async () => {
    const partieId = filterPartie || newEng.partie_id
    if (!partieId || !newEng.action.trim()) return
    setSavingEng(true); setError(null)
    try {
      const res = await fetch(`${base}/engagements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partie_id: partieId,
          action: newEng.action.trim(),
          responsable: newEng.responsable.trim() || null,
          canal: newEng.canal.trim() || null,
          frequence: newEng.frequence.trim() || null,
          echeance: newEng.echeance || null,
          statut: 'a_faire',
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’ajout de l’action')
      setNewEng({ partie_id: '', action: '', responsable: '', canal: '', frequence: '', echeance: '' })
      await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSavingEng(false) }
  }, [base, newEng, filterPartie, loadEngagements])

  const cycleEngagement = useCallback(async (eng: Engagement) => {
    const next = STATUTS_ENGAGEMENT[eng.statut].next
    setEngagements(prev => prev.map(e => (e.id === eng.id ? { ...e, statut: next } : e)))
    try {
      const res = await fetch(`${base}/engagements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eng.id, statut: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de mise à jour du statut')
      }
    } catch (e) { setError(String((e as Error).message ?? e)); await loadEngagements() }
  }, [base, loadEngagements])

  const deleteEngagement = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${base}/engagements?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de suppression')
      }
      await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base, loadEngagements])

  const partieById = useCallback((id: string) => parties.find(p => p.id === id), [parties])

  // ── Rendu ──
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      {phaseBanner && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start justify-between gap-3">
          <span>🔄 Nouvelle phase du projet : pensez à réévaluer le pouvoir et l’intérêt de chaque partie prenante — le processus d’engagement est continu.</span>
          <button onClick={rememberPhase} className="shrink-0 font-medium hover:underline">OK</button>
        </div>
      )}

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${tab === t.key
              ? 'text-indigo-700 dark:text-indigo-400 font-semibold border-b-2 border-indigo-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'registre' && (
        <RegistreTab
          parties={parties} loaded={loaded} readOnly={readOnly}
          onNew={() => setForm({ ...EMPTY_FORM })}
          onPreset={(preset) => setForm({ ...preset })}
          onEdit={(p) => setForm({
            id: p.id, nom: p.nom, organisation: p.organisation ?? '', categorie: p.categorie,
            role: p.role ?? '', pouvoir: p.pouvoir, interet: p.interet, attitude: p.attitude,
            attentes: p.attentes ?? '', verbatims: p.verbatims ?? '', strategie: p.strategie ?? '',
            statut_suivi: p.statut_suivi,
          })}
          onDelete={deletePartie}
          onImport={openImport}
        />
      )}

      {tab === 'matrice' && (
        <MatriceTab parties={parties} readOnly={readOnly} onMove={(id, pouvoir, interet) => patchPartie(id, { pouvoir, interet })} />
      )}

      {tab === 'plan' && (
        <PlanTab
          parties={parties} engagements={engagements} readOnly={readOnly}
          filterPartie={filterPartie} setFilterPartie={setFilterPartie}
          newEng={newEng} setNewEng={setNewEng} savingEng={savingEng}
          onAdd={addEngagement} onCycle={cycleEngagement} onDelete={deleteEngagement}
          partieById={partieById}
        />
      )}

      {/* Fiche d'édition */}
      {form && (
        <FicheModal form={form} setForm={setForm} saving={saving} onSave={savePartie} onClose={() => setForm(null)} />
      )}

      {/* Import */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImport(false)}>
          <div className="w-full max-w-lg rounded-xl border shadow-xl p-5 space-y-4"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">Importer depuis « Parties Prenantes & Matérialité »</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sélectionnez une session : ses parties prenantes identifiées seront ajoutées au registre du projet.
            </p>
            {importInfo && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                ✓ {importInfo}
              </div>
            )}
            {sessions === null ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement des sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune session trouvée dans l’app Parties Prenantes & Matérialité.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {[s.organisation, s.exercice].filter(Boolean).join(' · ')} · {s.pp_count} PP identifiée{s.pp_count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <button onClick={() => runImport(s.id)} disabled={importing}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
                      {importing ? 'Import…' : 'Importer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowImport(false)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onglet Registre ───────────────────────────────────────────────────────────

function RegistreTab({ parties, loaded, readOnly, onNew, onPreset, onEdit, onDelete, onImport }: {
  parties: Partie[]
  loaded: boolean
  readOnly: boolean
  onNew: () => void
  onPreset: (preset: PartieForm) => void
  onEdit: (p: Partie) => void
  onDelete: (id: string) => void
  onImport: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Aide : les catégories du cours */}
      <div className="rounded-xl border p-4 space-y-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300">Les trois catégories du cours</h3>
        <div className="grid gap-2 sm:grid-cols-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🟢 Opérationnel quotidien</span> — équipe, métiers, fournisseurs directs : ceux qui font le projet au jour le jour.</p>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🟠 Gouvernance</span> — sponsor, direction, financeurs : ceux qui décident, arbitrent et valident.</p>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🔵 Externe critique</span> — clients, riverains, régulateurs… et, particularité de la méthode, <span className="font-semibold text-gray-800 dark:text-gray-200">« la société » et « la Terre »</span> sont des parties prenantes à part entière, même silencieuses.</p>
        </div>
      </div>

      {/* Barre d'actions */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onNew}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            + Ajouter une partie prenante
          </button>
          <button onClick={() => onPreset(PRESET_TERRE)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            🌍 + Ajouter la Terre
          </button>
          <button onClick={() => onPreset(PRESET_SOCIETE)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            🏘️ + Ajouter la société
          </button>
          <button onClick={onImport}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            📥 Importer depuis Parties Prenantes & Matérialité
          </button>
        </div>
      )}

      {/* Tableau */}
      {!loaded ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
      ) : parties.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Aucune partie prenante pour l’instant. Ajoutez-en une, ou commencez par « la Terre » et « la société ».
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2 text-center">Pouvoir</th>
                <th className="px-3 py-2 text-center">Intérêt</th>
                <th className="px-3 py-2">Attitude</th>
                <th className="px-3 py-2">Suivi</th>
                {!readOnly && <th className="px-3 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {parties.map(p => {
                const cat = catOf(p.categorie); const att = attOf(p.attitude); const sui = suiviOf(p.statut_suivi)
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => onEdit(p)}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.nom}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{p.organisation ?? '—'}</td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cat.badge}`}>{cat.label}</span></td>
                    <td className="px-3 py-2 max-w-[16rem] truncate" style={{ color: 'var(--text-muted)' }}>{p.role ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{p.pouvoir}</td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{p.interet}</td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${att.badge}`}>{att.label}</span></td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sui.badge}`}>{sui.label}</span></td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={e => { e.stopPropagation(); onEdit(p) }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">Modifier</button>
                        <button onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Fiche modale ──────────────────────────────────────────────────────────────

function FicheModal({ form, setForm, saving, onSave, onClose }: {
  form: PartieForm
  setForm: (f: PartieForm | null) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<PartieForm>) => setForm({ ...form, ...patch })
  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelCls = 'block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">
          {form.id ? 'Modifier la partie prenante' : 'Nouvelle partie prenante'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nom *</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.nom} onChange={e => set({ nom: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Organisation</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.organisation} onChange={e => set({ organisation: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Catégorie</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.categorie} onChange={e => set({ categorie: e.target.value as Categorie })}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rôle dans le projet</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.role} onChange={e => set({ role: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Pouvoir : {form.pouvoir}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-600" value={form.pouvoir} onChange={e => set({ pouvoir: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Intérêt : {form.interet}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-600" value={form.interet} onChange={e => set({ interet: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Attitude</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.attitude} onChange={e => set({ attitude: e.target.value as Attitude })}>
              {ATTITUDES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Statut de suivi</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.statut_suivi} onChange={e => set({ statut_suivi: e.target.value as StatutSuivi })}>
              {STATUTS_SUIVI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Attentes vis-à-vis du projet</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.attentes} onChange={e => set({ attentes: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Verbatims (paroles entendues, telles quelles)</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.verbatims} onChange={e => set({ verbatims: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Stratégie d’engagement <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(suggestion selon la matrice : {quadrantStrategie(form.pouvoir, form.interet)})</span></label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.strategie} onChange={e => set({ strategie: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={onSave} disabled={saving || !form.nom.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Matrice ────────────────────────────────────────────────────────────

// Géométrie du SVG (viewBox fixe, responsive via width 100%)
const M = { w: 640, h: 520, left: 56, right: 16, top: 40, bottom: 56 }
const PLOT_W = M.w - M.left - M.right
const PLOT_H = M.h - M.top - M.bottom

function xOf(interet: number) { return M.left + ((interet - 1) / 4) * PLOT_W }
function yOf(pouvoir: number) { return M.top + PLOT_H - ((pouvoir - 1) / 4) * PLOT_H }

function MatriceTab({ parties, readOnly, onMove }: {
  parties: Partie[]
  readOnly: boolean
  onMove: (id: string, pouvoir: number, interet: number) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<{ id: string; pouvoir: number; interet: number } | null>(null)
  const dragRef = useRef<typeof drag>(null)
  dragRef.current = drag

  // Convertit un événement pointeur en valeurs (pouvoir, intérêt) continues 1-5
  const toValues = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * M.w
    const py = ((e.clientY - rect.top) / rect.height) * M.h
    const interet = Math.min(5, Math.max(1, 1 + ((px - M.left) / PLOT_W) * 4))
    const pouvoir = Math.min(5, Math.max(1, 1 + ((M.top + PLOT_H - py) / PLOT_H) * 4))
    return { pouvoir, interet }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const v = toValues(e)
    if (v) setDrag({ id: dragRef.current.id, ...v })
  }, [toValues])

  const onPointerUp = useCallback(() => {
    const d = dragRef.current
    if (d) {
      const pouvoir = Math.round(d.pouvoir)
      const interet = Math.round(d.interet)
      const p = parties.find(x => x.id === d.id)
      if (p && (p.pouvoir !== pouvoir || p.interet !== interet)) onMove(d.id, pouvoir, interet)
    }
    setDrag(null)
  }, [parties, onMove])

  // Décale légèrement les points superposés pour qu'ils restent tous visibles
  const seen = new Map<string, number>()
  const positioned = parties.map(p => {
    const isDragged = drag?.id === p.id
    const pv = isDragged ? drag!.pouvoir : p.pouvoir
    const it = isDragged ? drag!.interet : p.interet
    const key = `${p.pouvoir}-${p.interet}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    const jitter = isDragged ? 0 : n * 10
    return { p, cx: xOf(it) + jitter, cy: yOf(pv) - (isDragged ? 0 : (n % 2) * 8), isDragged }
  })

  const gridColor = 'var(--border)'
  const midX = xOf(3); const midY = yOf(3)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300 mb-1">Matrice Pouvoir × Intérêt</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {readOnly
            ? 'Lecture seule : les points reflètent le pouvoir et l’intérêt de chaque partie prenante.'
            : 'Faites glisser un point pour réévaluer le pouvoir et l’intérêt d’une partie prenante (enregistrement automatique).'}
        </p>
        <svg ref={svgRef} viewBox={`0 0 ${M.w} ${M.h}`} className="w-full select-none" style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          {/* Quadrants */}
          <rect x={midX} y={M.top} width={M.left + PLOT_W - midX} height={midY - M.top} fill="#6366f1" opacity={0.10} />
          <rect x={M.left} y={M.top} width={midX - M.left} height={midY - M.top} fill="#6366f1" opacity={0.05} />
          <rect x={midX} y={midY} width={M.left + PLOT_W - midX} height={M.top + PLOT_H - midY} fill="#6366f1" opacity={0.05} />

          {/* Grille 1-5 */}
          {[1, 2, 3, 4, 5].map(v => (
            <g key={v}>
              <line x1={xOf(v)} y1={M.top} x2={xOf(v)} y2={M.top + PLOT_H} stroke={gridColor} strokeWidth={v === 3 ? 2 : 1} strokeDasharray={v === 3 ? undefined : '3 3'} />
              <line x1={M.left} y1={yOf(v)} x2={M.left + PLOT_W} y2={yOf(v)} stroke={gridColor} strokeWidth={v === 3 ? 2 : 1} strokeDasharray={v === 3 ? undefined : '3 3'} />
              <text x={xOf(v)} y={M.top + PLOT_H + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{v}</text>
              <text x={M.left - 12} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{v}</text>
            </g>
          ))}

          {/* Axes */}
          <text x={M.left + PLOT_W / 2} y={M.h - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-muted)">Intérêt →</text>
          <text x={16} y={M.top + PLOT_H / 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-muted)"
            transform={`rotate(-90 16 ${M.top + PLOT_H / 2})`}>Pouvoir →</text>

          {/* Libellés de stratégie par quadrant */}
          <text x={(M.left + midX) / 2} y={M.top + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Garder satisfait</text>
          <text x={(midX + M.left + PLOT_W) / 2} y={M.top + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Engager pleinement</text>
          <text x={(M.left + midX) / 2} y={M.top + PLOT_H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Information minimale</text>
          <text x={(midX + M.left + PLOT_W) / 2} y={M.top + PLOT_H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Tenir informé</text>

          {/* Points */}
          {positioned.map(({ p, cx, cy, isDragged }) => {
            const cat = catOf(p.categorie); const att = attOf(p.attitude)
            return (
              <g key={p.id} style={{ cursor: readOnly ? 'default' : 'grab' }}
                onPointerDown={readOnly ? undefined : (e) => {
                  e.preventDefault();
                  (e.currentTarget.ownerSVGElement)?.setPointerCapture?.(e.pointerId)
                  setDrag({ id: p.id, pouvoir: p.pouvoir, interet: p.interet })
                }}>
                <circle cx={cx} cy={cy} r={isDragged ? 13 : 10} fill={cat.dot} fillOpacity={0.9}
                  stroke={att.ring} strokeWidth={3} strokeDasharray={att.dash} />
                <text x={cx} y={cy - (isDragged ? 18 : 15)} textAnchor="middle" fontSize={11} fontWeight={600}
                  fill="var(--text-muted)">{p.nom.length > 22 ? p.nom.slice(0, 22) + '…' : p.nom}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Légende */}
      <div className="grid gap-3 sm:grid-cols-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold text-gray-800 dark:text-gray-200">Couleur du point = catégorie</p>
          {CATEGORIES.map(c => (
            <p key={c.value} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.dot }} /> {c.label}
            </p>
          ))}
        </div>
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold text-gray-800 dark:text-gray-200">Liseré du point = attitude</p>
          {ATTITUDES.map(a => (
            <p key={a.value} className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="5" fill="none" stroke={a.ring} strokeWidth="2.5" strokeDasharray={a.dash} />
              </svg>
              {a.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Onglet Plan d'engagement ──────────────────────────────────────────────────

function PlanTab({ parties, engagements, readOnly, filterPartie, setFilterPartie, newEng, setNewEng, savingEng, onAdd, onCycle, onDelete, partieById }: {
  parties: Partie[]
  engagements: Engagement[]
  readOnly: boolean
  filterPartie: string
  setFilterPartie: (id: string) => void
  newEng: { partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string }
  setNewEng: (v: { partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string }) => void
  savingEng: boolean
  onAdd: () => void
  onCycle: (e: Engagement) => void
  onDelete: (id: string) => void
  partieById: (id: string) => Partie | undefined
}) {
  const visible = engagements
    .filter(e => !filterPartie || e.partie_id === filterPartie)
    .slice()
    .sort((a, b) => {
      if (!a.echeance && !b.echeance) return 0
      if (!a.echeance) return 1
      if (!b.echeance) return -1
      return a.echeance.localeCompare(b.echeance)
    })

  const inputCls = 'px-2 py-1.5 text-xs rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-4">
      {/* Bandeau conseil Fair Process */}
      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3 text-sm text-teal-800 dark:text-teal-300">
        💡 <span className="font-semibold">Fair Process</span> : impliquer les parties prenantes en amont, expliquer la décision prise, clarifier les attentes qui en découlent.
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Partie prenante :</label>
        <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={filterPartie} onChange={e => setFilterPartie(e.target.value)}>
          <option value="">Toutes</option>
          {parties.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Partie prenante</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Fréquence</th>
              <th className="px-3 py-2">Échéance</th>
              <th className="px-3 py-2">Statut</th>
              {!readOnly && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {visible.map(e => {
              const st = STATUTS_ENGAGEMENT[e.statut]
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{partieById(e.partie_id)?.nom ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{e.action}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.responsable ?? '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.canal ?? '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.frequence ?? '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{formatDateFr(e.echeance)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => !readOnly && onCycle(e)} disabled={readOnly}
                      title={readOnly ? undefined : 'Cliquer pour faire avancer le statut'}
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${st.badge} ${readOnly ? 'cursor-default' : 'hover:opacity-75'}`}>
                      {st.label}
                    </button>
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onDelete(e.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={readOnly ? 7 : 8} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucune action d’engagement pour l’instant.
              </td></tr>
            )}
            {/* Ajout inline */}
            {!readOnly && (
              <tr>
                <td className="px-3 py-2">
                  {filterPartie ? (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{partieById(filterPartie)?.nom}</span>
                  ) : (
                    <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={newEng.partie_id}
                      onChange={e => setNewEng({ ...newEng, partie_id: e.target.value })}>
                      <option value="">Choisir…</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-full`} style={{ borderColor: 'var(--border)' }} placeholder="Nouvelle action…"
                    value={newEng.action} onChange={e => setNewEng({ ...newEng, action: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Qui ?"
                    value={newEng.responsable} onChange={e => setNewEng({ ...newEng, responsable: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Canal"
                    value={newEng.canal} onChange={e => setNewEng({ ...newEng, canal: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Fréquence"
                    value={newEng.frequence} onChange={e => setNewEng({ ...newEng, frequence: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
                    value={newEng.echeance} onChange={e => setNewEng({ ...newEng, echeance: e.target.value })} />
                </td>
                <td className="px-3 py-2" colSpan={2}>
                  <button onClick={onAdd} disabled={savingEng || !newEng.action.trim() || !(filterPartie || newEng.partie_id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
                    {savingEng ? 'Ajout…' : '+ Ajouter'}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
