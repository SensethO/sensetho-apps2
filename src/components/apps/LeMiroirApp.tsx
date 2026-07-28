'use client'

// Le Miroir v2 — aligné sur la Méthode d'accompagnement Sens'ethO v0.6.
// Phases : collecte (chacun peint, personne ne lit) → restitution (écarts,
// adéquation, image cible, 3 engagements observables, indicateurs).
// Cascade : entreprise (2 animaux : marché + cité) · services · postes
// d'encadrement (le poste, jamais la personne) · parties prenantes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RseContext } from '@/components/rse/RseAppShell'
import {
  ESPECES, VERDICTS, QUIZ, OPEN_QUESTIONS, SECTEUR_DISCLAIMER,
  especeById, habitatById, habitatsPourMilieu, suggererEspeces,
  RELATIONS, relationById, PP_COTES, CONTRAT_REGLES, SEUIL_RESTITUTION,
  QUESTION_FILTRE_POSTE, SIGNAUX_HINT, DEDICACE_HINT, MILIEU_SERVICE_HINT, MILIEU_POSTE_HINT,
  type EtreKind,
} from '@/lib/leMiroir'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiSecteur {
  nom?: string; attractivite?: string; forces?: string[]; faiblesses?: string[]
  turnover?: string; stress_burnout?: string; remuneration?: string
}
interface AiSuggestion {
  especeId?: string; especeCiteId?: string; habitatMarcheId?: string; habitatCiteId?: string
  verdictMarche?: number; verdictCite?: number; justification?: string; secteur?: AiSecteur
}

interface Portrait {
  id: string; user_id: string; etre_key: string; etre_label: string
  espece_id: string; espece_cite_id: string | null
  habitat_marche_id: string | null; habitat_cite_id: string | null
  verdict_marche: number | null; verdict_cite: number | null
  milieu_libre: string | null; relation: string | null
  signaux: string | null; dedicace: string | null
  justification: string | null; kind: 'individuel' | 'auto'
  methode?: 'manuel' | 'ia' | null; prompt?: Record<string, string> | null; ia?: AiSuggestion | null
}
interface ImageCible { espece_id?: string; note?: string }
interface Campagne { id: string; owner_id: string; annee: number; nom: string | null; statut: 'collecte' | 'restitution'; image_cible: ImageCible | null }
interface Participant { id: string; user_id?: string; poste: string | null; service: string | null; regles_acceptees?: boolean }
interface EtreDecl { id: string; kind: 'poste' | 'partie_prenante'; label: string; cote: 'marche' | 'cite' | 'groupe' | null }
interface Engagement { id: string; qui: string; quoi: string; echeance: string | null; comportement: string; statut: 'en_cours' | 'constate' | 'abandonne' }
interface Etre { key: string; label: string; kind: EtreKind; cote?: string | null }
interface PrevYear { especeMarche?: string; especeCite?: string; imageCible?: ImageCible | null }

const card = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' } as const
const chipStyle = (active: boolean) => active
  ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
  : { ...card, color: 'var(--text)' }
const modeOf = (arr: string[]) => { if (!arr.length) return undefined; const c: Record<string, number> = {}; arr.forEach((v) => (c[v] = (c[v] || 0) + 1)); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] }
const avgOf = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : undefined
const verdictLabel = (v: number | null | undefined) => v ? (VERDICTS.find((x) => x.value === Math.round(v))?.label ?? '—') : '—'
const oqLabel = (id: string) => OPEN_QUESTIONS.find((q) => q.id === id)?.label ?? id

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LeMiroirApp({ ctx }: { ctx: RseContext }) {
  const supabase = useMemo(() => createClient(), [])
  const orgId = ctx.org?.id ?? null
  const orgName = ctx.org?.denomination ?? "L'entreprise"
  const year = ctx.year

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [portraits, setPortraits] = useState<Portrait[]>([])
  const [etresDecl, setEtresDecl] = useState<EtreDecl[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [prev, setPrev] = useState<PrevYear | null>(null)
  const [tab, setTab] = useState<'peindre' | 'miroir' | 'action'>('peindre')
  const [showCadrage, setShowCadrage] = useState(false)

  const loadAll = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id ?? null
    setUserId(uid)
    const { data: camp } = await supabase
      .from('le_miroir_campagnes').select('*').eq('org_id', orgId).eq('annee', year).limit(1).maybeSingle()
    if (!camp) { setCampagne(null); setLoading(false); return }
    setCampagne(camp as Campagne)
    const [{ data: parts }, { data: ports }, { data: mine }, { data: decl }, { data: engs }, { data: prevCamp }] = await Promise.all([
      supabase.from('le_miroir_participants').select('id,user_id,poste,service,regles_acceptees').eq('campagne_id', camp.id),
      supabase.from('le_miroir_portraits').select('*').eq('campagne_id', camp.id),
      supabase.from('le_miroir_participants').select('id,poste,service,regles_acceptees').eq('campagne_id', camp.id).eq('user_id', uid).maybeSingle(),
      supabase.from('le_miroir_etres').select('id,kind,label,cote').eq('campagne_id', camp.id).order('created_at'),
      supabase.from('le_miroir_engagements').select('id,qui,quoi,echeance,comportement,statut').eq('campagne_id', camp.id).order('created_at'),
      supabase.from('le_miroir_campagnes').select('id,image_cible').eq('org_id', orgId).eq('annee', year - 1).limit(1).maybeSingle(),
    ])
    setParticipants((parts as Participant[]) ?? [])
    setPortraits((ports as Portrait[]) ?? [])
    setParticipant((mine as Participant) ?? null)
    setEtresDecl((decl as EtreDecl[]) ?? [])
    setEngagements((engs as Engagement[]) ?? [])
    if (prevCamp) {
      const { data: prevPorts } = await supabase
        .from('le_miroir_portraits').select('espece_id,espece_cite_id,kind').eq('campagne_id', prevCamp.id).eq('etre_key', 'entreprise')
      const het = ((prevPorts as Portrait[]) ?? []).filter((p) => p.kind === 'individuel')
      setPrev({
        especeMarche: modeOf(het.map((p) => p.espece_id)),
        especeCite: modeOf(het.map((p) => p.espece_cite_id || p.espece_id)),
        imageCible: (prevCamp as { image_cible?: ImageCible | null }).image_cible ?? null,
      })
    } else setPrev(null)
    setLoading(false)
  }, [supabase, orgId, year])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    ctx.setYearShiftHandler(async (delta: number) => {
      if (!orgId) return
      await fetch('/api/le-miroir/shift-year', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, delta }),
      })
    })
    return () => { ctx.setYearShiftHandler(null) }
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startCampagne() {
    if (!userId || !orgId) return
    await supabase.from('le_miroir_campagnes').insert({ owner_id: userId, org_id: orgId, annee: year, nom: `Campagne ${year}`, statut: 'collecte' })
    loadAll()
  }

  if (!orgId) return <Info>Sélectionnez une organisation dans le panneau de gauche pour démarrer le miroir.</Info>
  if (loading) return <Info>Chargement du miroir…</Info>

  if (!campagne) {
    return (
      <div className="p-6 max-w-2xl">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Aucune campagne pour {orgName} · {year}</h2>
        <p className="mb-3" style={{ color: 'var(--text-muted)' }}>
          En tant que responsable, vous démarrez la campagne du miroir collectif (phase de collecte). Vous inviterez ensuite
          des participants ; chacun acceptera le contrat de règles, puis peindra les êtres qu&apos;il côtoie : l&apos;entreprise
          (deux animaux — son marché et sa place dans la cité), son service, les postes d&apos;encadrement et les parties prenantes.
        </p>
        <ReglesBox />
        <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
          Pendant la collecte, personne ne lit les réponses — pas même vous. Vous clorez la collecte quand votre propre
          portrait sera fait ; la restitution s&apos;ouvrira alors pour tous.
        </p>
        <button onClick={startCampagne} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Démarrer la campagne {year}
        </button>
      </div>
    )
  }

  const isOwner = campagne.owner_id === userId
  const enCollecte = campagne.statut !== 'restitution'

  if (!participant || !participant.regles_acceptees) {
    return <Onboarding existing={participant} onSave={async (poste, service) => {
      if (participant) {
        await supabase.from('le_miroir_participants').update({ poste, service, regles_acceptees: true }).eq('id', participant.id)
      } else {
        await supabase.from('le_miroir_participants').insert({ campagne_id: campagne.id, user_id: userId, poste, service, regles_acceptees: true })
      }
      loadAll()
    }} />
  }

  // Cascade des êtres observables (méthode §4.2)
  const services = Array.from(new Set(participants.map((p) => p.service).filter(Boolean))) as string[]
  const etres: Etre[] = [
    { key: 'entreprise', label: orgName, kind: 'entreprise' },
    ...services.map((s) => ({ key: 'service:' + s, label: 'Service ' + s, kind: 'service' as EtreKind })),
    ...etresDecl.filter((e) => e.kind === 'poste').map((e) => ({ key: 'poste:' + e.id, label: e.label, kind: 'poste' as EtreKind })),
    ...etresDecl.filter((e) => e.kind === 'partie_prenante').map((e) => ({ key: 'pp:' + e.id, label: e.label, kind: 'partie_prenante' as EtreKind, cote: e.cote })),
  ]

  const myAutoEntreprise = portraits.some((p) => p.user_id === userId && p.etre_key === 'entreprise' && p.kind === 'auto')

  async function setStatut(statut: 'collecte' | 'restitution') {
    if (!campagne) return
    await supabase.from('le_miroir_campagnes').update({ statut }).eq('id', campagne.id)
    loadAll()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        {(['peindre', 'miroir', 'action'] as const).map((t) => (
          (t !== 'action' || !enCollecte) && (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm border" style={chipStyle(tab === t)}>
              {t === 'peindre' ? '🖌️ Peindre' : t === 'miroir' ? '🪞 Le miroir' : '🎯 Image cible & engagements'}
            </button>
          )
        ))}
        {isOwner && (
          <button onClick={() => setShowCadrage((v) => !v)} className="px-4 py-2 rounded-lg text-sm border" style={{ ...card, color: 'var(--text)' }}>
            ⚙️ Cadrage
          </button>
        )}
        <span className="px-3 py-1 rounded-full text-xs border" style={enCollecte
          ? { backgroundColor: '#eef4ee', color: '#3d6b3d', borderColor: '#cfe0cf' }
          : { backgroundColor: '#f6e7df', color: '#a85b3b', borderColor: '#ecd0c0' }}>
          {enCollecte ? '● Collecte en cours' : '● Restitution ouverte'}
        </span>
        <span className="ml-auto text-sm self-center" style={{ color: 'var(--text-subtle)' }}>
          {participant.poste} · {participant.service}
        </span>
      </div>

      {isOwner && (
        <div className="mb-4 flex flex-wrap gap-2 items-center text-xs" style={{ color: 'var(--text-subtle)' }}>
          {enCollecte ? (
            <>
              <button disabled={!myAutoEntreprise} onClick={() => setStatut('restitution')}
                title={myAutoEntreprise ? '' : "Faites d'abord votre portrait de l'entreprise (référence du dirigeant)"}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ ...card, color: 'var(--text)' }}>
                Clore la collecte → ouvrir la restitution
              </button>
              {!myAutoEntreprise && <span>Jalon : votre portrait de référence doit être fait avant de clore (méthode, phase 1).</span>}
            </>
          ) : (
            <button onClick={() => setStatut('collecte')} className="px-3 py-1.5 rounded-lg border" style={{ ...card, color: 'var(--text)' }}>
              Rouvrir la collecte
            </button>
          )}
        </div>
      )}

      {isOwner && showCadrage && (
        <CadragePanel campagneId={campagne.id} etresDecl={etresDecl} onChange={loadAll} supabase={supabase} />
      )}

      {tab === 'peindre' && (enCollecte
        ? <Observer etres={etres} isOwner={isOwner} myAutoDone={myAutoEntreprise} onSave={async (p) => {
            await supabase.from('le_miroir_portraits').insert({ campagne_id: campagne.id, user_id: userId, ...p })
            await loadAll()
          }} />
        : <Info>La collecte est close — la campagne est en phase de restitution. {isOwner ? 'Vous pouvez la rouvrir ci-dessus si besoin.' : 'Rendez-vous dans « Le miroir ».'}</Info>)}

      {tab === 'miroir' && (
        <Miroir etres={etres} portraits={portraits} enCollecte={enCollecte} userId={userId} participants={participants} />
      )}

      {tab === 'action' && !enCollecte && (
        <ActionPanel campagne={campagne} portraits={portraits} etres={etres} engagements={engagements}
          participants={participants} prev={prev} isOwner={isOwner} supabase={supabase} onChange={loadAll} />
      )}
    </div>
  )
}

function Info({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>{children}</div>
}

function ReglesBox() {
  return (
    <div className="rounded-xl border p-4 mb-3" style={card}>
      <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>📜 Le contrat de règles</div>
      <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-muted)' }}>
        {CONTRAT_REGLES.map((r, i) => <li key={i} className="flex gap-2"><span style={{ color: 'var(--accent)' }}>•</span><span>{r}</span></li>)}
      </ul>
    </div>
  )
}

// ─── Onboarding : contrat de règles + identité fonctionnelle ─────────────────

function Onboarding({ existing, onSave }: { existing: Participant | null; onSave: (poste: string, service: string) => Promise<void> }) {
  const [poste, setPoste] = useState(existing?.poste ?? '')
  const [service, setService] = useState(existing?.service ?? '')
  const [accepte, setAccepte] = useState(false)
  const [saving, setSaving] = useState(false)
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Bienvenue dans le miroir</h2>
      <p className="mb-3" style={{ color: 'var(--text-muted)' }}>
        Vous allez décrire l&apos;entreprise et ce qui l&apos;entoure comme des animaux dans leur milieu. Il n&apos;y a pas de
        bonne réponse ; personne ne sera noté — ni vous, ni vos collègues. On cherche l&apos;image la plus juste, pas la plus flatteuse.
      </p>
      <ReglesBox />
      <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-1" />
        <span>J&apos;ai lu le contrat de règles et je m&apos;engage à le respecter.</span>
      </label>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Votre poste</label>
          <input value={poste} onChange={(e) => setPoste(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent" style={card} placeholder="ex : Chargé d'affaires" />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Votre service</label>
          <input value={service} onChange={(e) => setService(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent" style={card} placeholder="ex : Commercial" />
        </div>
      </div>
      <button disabled={!poste || !service || !accepte || saving} onClick={async () => { setSaving(true); await onSave(poste.trim(), service.trim()) }}
        className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
        {saving ? '…' : 'Commencer'}
      </button>
    </div>
  )
}

// ─── Cadrage (owner) : invitations + postes + parties prenantes ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CadragePanel({ campagneId, etresDecl, onChange, supabase }: { campagneId: string; etresDecl: EtreDecl[]; onChange: () => void; supabase: any }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-5">
      <ShareManager campagneId={campagneId} />
      <EtresManager campagneId={campagneId} etresDecl={etresDecl} onChange={onChange} supabase={supabase} />
    </div>
  )
}

interface ShareRow {
  id: string; shared_with_user_id: string
  profiles?: { email?: string | null; full_name?: string | null } | { email?: string | null; full_name?: string | null }[] | null
}
function shareEmail(s: ShareRow): string {
  const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
  return p?.email || p?.full_name || s.shared_with_user_id
}

function ShareManager({ campagneId }: { campagneId: string }) {
  const [list, setList] = useState<ShareRow[]>([])
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/le-miroir/${campagneId}/shares`)
    const d = await r.json(); if (r.ok) setList((d.data as ShareRow[]) ?? [])
  }, [campagneId])
  useEffect(() => { load() }, [load])

  async function invite() {
    if (!email.trim()) return
    setBusy(true); setMsg(null)
    const r = await fetch(`/api/le-miroir/${campagneId}/shares`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
    })
    const d = await r.json(); setBusy(false)
    if (!r.ok) { setMsg(d.error || "Échec de l'invitation."); return }
    setEmail(''); setMsg('✓ Participant invité.'); load()
  }
  async function remove(id: string) {
    await fetch(`/api/le-miroir/${campagneId}/shares?share_id=${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="rounded-xl border p-4" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>👥 Inviter des participants</div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Par e-mail (compte requis sur la plateforme). Chaque invité accepte le contrat de règles, déclare poste et service, puis peint.</p>
      <div className="flex gap-2 mb-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.fr" className="flex-1 px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        <button disabled={busy} onClick={invite} className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>{busy ? '…' : 'Inviter'}</button>
      </div>
      {msg && <div className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{msg}</div>}
      {list.length > 0 && (
        <ul className="text-sm space-y-1">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <span style={{ color: 'var(--text)' }}>{shareEmail(s)}</span>
              <button onClick={() => remove(s.id)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>retirer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EtresManager({ campagneId, etresDecl, onChange, supabase }: { campagneId: string; etresDecl: EtreDecl[]; onChange: () => void; supabase: any }) {
  const [kind, setKind] = useState<'poste' | 'partie_prenante'>('poste')
  const [label, setLabel] = useState('')
  const [cote, setCote] = useState<string>('marche')

  async function add() {
    if (!label.trim()) return
    await supabase.from('le_miroir_etres').insert({ campagne_id: campagneId, kind, label: label.trim(), cote: kind === 'partie_prenante' ? cote : null })
    setLabel(''); onChange()
  }
  async function remove(id: string) {
    await supabase.from('le_miroir_etres').delete().eq('id', id); onChange()
  }

  return (
    <div className="rounded-xl border p-4" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>🧬 La cascade : postes et parties prenantes</div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Les services se déduisent des participants. Ajoutez ici les <b>postes d&apos;encadrement</b> à peindre (le poste,
        jamais la personne — ex. « Le poste de chef d&apos;atelier ») et les <b>parties prenantes</b> (clients, fournisseurs,
        maison mère, syndicats, chercheurs d&apos;emploi…).
      </p>
      <div className="flex gap-2 mb-2 flex-wrap">
        {(['poste', 'partie_prenante'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="px-3 py-1.5 rounded-lg border text-xs" style={chipStyle(kind === k)}>
            {k === 'poste' ? "Poste d'encadrement" : 'Partie prenante'}
          </button>
        ))}
        {kind === 'partie_prenante' && PP_COTES.map((c) => (
          <button key={c.id} onClick={() => setCote(c.id)} title={c.exemples} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(cote === c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border bg-transparent text-sm" style={card}
          placeholder={kind === 'poste' ? "ex : Le poste de chef d'atelier" : 'ex : Nos clients grands comptes'} />
        <button onClick={add} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--accent)' }}>Ajouter</button>
      </div>
      <ul className="text-sm space-y-1">
        {etresDecl.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-subtle)' }}>
              {e.kind === 'poste' ? 'poste' : PP_COTES.find((c) => c.id === e.cote)?.label ?? 'partie prenante'}
            </span>
            <span style={{ color: 'var(--text)' }}>{e.label}</span>
            <button onClick={() => remove(e.id)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>retirer</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Peindre ──────────────────────────────────────────────────────────────────

interface NewPortrait {
  etre_key: string; etre_label: string; espece_id: string; espece_cite_id: string | null
  habitat_marche_id: string | null; habitat_cite_id: string | null
  verdict_marche: number | null; verdict_cite: number | null
  milieu_libre: string | null; relation: string | null; signaux: string | null; dedicace: string | null
  justification: string | null; kind: 'individuel' | 'auto'; methode: 'manuel' | 'ia'
  prompt: Record<string, string> | null; ia: AiSuggestion | null
}

function Observer({ etres, isOwner, myAutoDone, onSave }: { etres: Etre[]; isOwner: boolean; myAutoDone: boolean; onSave: (p: NewPortrait) => Promise<void> }) {
  const [etreKey, setEtreKey] = useState(etres[0]?.key ?? 'entreprise')
  const etre = etres.find((x) => x.key === etreKey) ?? etres[0]
  const kind: EtreKind = etre?.kind ?? 'entreprise'

  const [regard, setRegard] = useState<'individuel' | 'auto'>('individuel')
  const [espece, setEspece] = useState(''); const [especeCite, setEspeceCite] = useState('')
  const [hM, setHM] = useState(''); const [hC, setHC] = useState('')
  const [vM, setVM] = useState(0); const [vC, setVC] = useState(0)
  const [milieuLibre, setMilieuLibre] = useState(''); const [relation, setRelation] = useState('')
  const [signaux, setSignaux] = useState(''); const [dedicace, setDedicace] = useState(''); const [justif, setJustif] = useState('')
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
  const [oa, setOa] = useState<Record<string, string>>({}); const [analysing, setAnalysing] = useState(false); const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [aiSecteur, setAiSecteur] = useState<AiSecteur | null>(null)
  const [methode, setMethode] = useState<'manuel' | 'ia'>('manuel')
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)

  const tags = Object.values(answers).flat(); const suggestions = suggererEspeces(tags)
  const visibleQuiz = QUIZ.filter((q) => !q.showIf || q.showIf(tags))
  const etreLabel = etre?.label ?? 'cet être'

  function resetForm() {
    setEspece(''); setEspeceCite(''); setHM(''); setHC(''); setVM(0); setVC(0)
    setMilieuLibre(''); setRelation(''); setSignaux(''); setDedicace(''); setJustif('')
    setAnswers({}); setOa({}); setAiSecteur(null); setAiSuggestion(null); setAiMsg(null)
  }

  const ready = kind === 'entreprise'
    ? Boolean(espece && especeCite && hM && hC && vM && vC)
    : kind === 'partie_prenante'
      ? Boolean(espece && relation && vM)
      : Boolean(espece && milieuLibre.trim() && vM)

  async function analyser() {
    setAnalysing(true); setAiMsg(null); setAiSecteur(null); setAiSuggestion(null)
    try {
      const res = await fetch('/api/le-miroir/analyse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etreLabel, answers: oa, quizTags: tags }),
      })
      const data = await res.json()
      if (!res.ok || !data.suggestion) { setAiMsg(data.error || 'Analyse indisponible pour le moment.'); setAnalysing(false); return }
      const s = data.suggestion as AiSuggestion
      setAiSuggestion(s)
      if (s.especeId) { setEspece(s.especeId); setEspeceCite(s.especeCiteId || s.especeId) }
      if (s.habitatMarcheId) setHM(s.habitatMarcheId)
      if (s.habitatCiteId) setHC(s.habitatCiteId)
      if (s.verdictMarche) setVM(s.verdictMarche)
      if (s.verdictCite) setVC(s.verdictCite)
      if (s.justification) setJustif(s.justification)
      if (s.secteur) setAiSecteur(s.secteur as AiSecteur)
      setAiMsg("✓ Proposition de l'IA appliquée ci-dessous — ajustez si besoin, puis enregistrez.")
    } catch {
      setAiMsg("Erreur lors de l'analyse.")
    }
    setAnalysing(false)
  }

  async function save() {
    setSaving(true); setSaved(false)
    const promptClean = Object.fromEntries(Object.entries(oa).filter(([, v]) => v && v.trim()))
    const base: NewPortrait = {
      etre_key: etreKey, etre_label: etreLabel,
      espece_id: espece,
      espece_cite_id: kind === 'entreprise' ? especeCite : null,
      habitat_marche_id: kind === 'entreprise' ? hM : null,
      habitat_cite_id: kind === 'entreprise' ? hC : null,
      verdict_marche: vM || null,
      verdict_cite: kind === 'entreprise' ? (vC || null) : null,
      milieu_libre: kind === 'service' || kind === 'poste' ? milieuLibre.trim() || null : null,
      relation: kind === 'partie_prenante' ? relation || null : null,
      signaux: signaux.trim() || null,
      dedicace: kind === 'entreprise' && regard === 'individuel' ? dedicace.trim() || null : null,
      justification: justif.trim() || null,
      kind: kind === 'entreprise' && isOwner ? regard : 'individuel',
      methode,
      prompt: methode === 'ia' && Object.keys(promptClean).length ? promptClean : null,
      ia: methode === 'ia' ? aiSuggestion : null,
    }
    await onSave(base)
    setSaving(false); setSaved(true); resetForm()
  }

  return (
    <div className="max-w-3xl">
      <Field label="Quel être peignez-vous ?">
        <select value={etreKey} onChange={(e) => { setEtreKey(e.target.value); resetForm(); setSaved(false) }} className="px-3 py-2 rounded-lg border bg-transparent" style={card}>
          <optgroup label="L'entreprise (deux milieux : marché et cité)">
            <option value="entreprise">{etres[0]?.label}</option>
          </optgroup>
          {etres.some((e) => e.kind === 'service') && (
            <optgroup label="Les services">
              {etres.filter((e) => e.kind === 'service').map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </optgroup>
          )}
          {etres.some((e) => e.kind === 'poste') && (
            <optgroup label="Les postes d'encadrement (le poste, jamais la personne)">
              {etres.filter((e) => e.kind === 'poste').map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </optgroup>
          )}
          {etres.some((e) => e.kind === 'partie_prenante') && (
            <optgroup label="Les parties prenantes">
              {etres.filter((e) => e.kind === 'partie_prenante').map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </optgroup>
          )}
        </select>
      </Field>

      {kind === 'poste' && (
        <div className="rounded-xl border p-3 mb-4 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
          <b style={{ color: 'var(--text)' }}>⚠️ {QUESTION_FILTRE_POSTE}</b><br />
          Tout ce qui ne survivrait pas au changement de titulaire n&apos;a pas sa place dans ce portrait. L&apos;animal, c&apos;est
          le poste tel qu&apos;il fonctionne ; le milieu, c&apos;est ce que la fonction exige et ce dont elle dispose.
        </div>
      )}

      {kind === 'entreprise' && isOwner && (
        <Field label="Type de regard">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setRegard('individuel')} className="px-3 py-1.5 rounded-lg border text-sm" style={chipStyle(regard === 'individuel')}>Regard parmi les autres</button>
            <button onClick={() => setRegard('auto')} className="px-3 py-1.5 rounded-lg border text-sm" style={chipStyle(regard === 'auto')}>
              Portrait de référence du dirigeant {myAutoDone ? '✓' : ''}
            </button>
          </div>
          {regard === 'auto' && (
            <div className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
              Votre portrait servira de point de comparaison avec celui des équipes (écart dirigeant ↔ équipes). Il est requis pour clore la collecte.
            </div>
          )}
        </Field>
      )}

      {kind === 'entreprise' && (
        <Field label="Comment construire le portrait ?">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMethode('ia')} className="px-3 py-1.5 rounded-lg border text-sm" style={chipStyle(methode === 'ia')}>🤖 Automatique (IA, narratif)</button>
            <button onClick={() => setMethode('manuel')} className="px-3 py-1.5 rounded-lg border text-sm" style={chipStyle(methode === 'manuel')}>✋ Manuel (choix guidé)</button>
          </div>
          <div className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
            {methode === 'ia'
              ? "Décrivez l'activité avec vos mots ; l'IA propose les deux animaux, les habitats et le profil sectoriel — vous gardez la main."
              : "Répondez au questionnaire : les questions s'affinent selon vos réponses, puis choisissez les espèces et les milieux."}
          </div>
        </Field>
      )}

      {kind === 'entreprise' && methode === 'ia' && (
        <Field label="🤖 Analyse IA — décrire l'activité">
          <div className="rounded-xl border p-4 space-y-3" style={card}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Renseignez quelques éléments sur « {etreLabel} » ; l&apos;IA proposera les animaux et habitats (marché / cité), que vous pourrez ajuster.</p>
            {OPEN_QUESTIONS.map((q) => (
              <div key={q.id}>
                <label className="block text-sm mb-0.5" style={{ color: 'var(--text)' }}>{q.label}</label>
                {q.hint && <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{q.hint}</div>}
                {q.type === 'choice'
                  ? <div className="flex flex-wrap gap-2">{(q.options ?? []).map((o) => (
                      <button key={o} type="button" onClick={() => setOa((a) => ({ ...a, [q.id]: a[q.id] === o ? '' : o }))} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(oa[q.id] === o)}>{o}</button>
                    ))}</div>
                  : <textarea rows={2} value={oa[q.id] || ''} onChange={(e) => setOa((a) => ({ ...a, [q.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />}
              </div>
            ))}
            <button type="button" disabled={analysing} onClick={analyser} className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
              {analysing ? 'Analyse en cours…' : "Analyser avec l'IA"}
            </button>
            {aiMsg && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{aiMsg}</div>}
            {aiSecteur && <SecteurBox sect={aiSecteur} disclaimer />}
          </div>
        </Field>
      )}

      {kind === 'entreprise' && methode === 'manuel' && (
        <Field label="🧭 Questionnaire — m'aider à trouver l'espèce">
          <div className="rounded-xl border p-4" style={card}>
            {visibleQuiz.map((q) => (
              <div key={q.id} className="mb-3">
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{q.question}</div>
                {q.hint && <div className="text-xs mb-1.5" style={{ color: 'var(--text-subtle)' }}>{q.hint}</div>}
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o, i) => {
                    const active = (answers[q.id] || []).join() === o.tags.join()
                    return <button key={i} onClick={() => setAnswers((a) => ({ ...a, [q.id]: active ? [] : o.tags }))}
                      className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(active)}>{o.label}</button>
                  })}
                </div>
              </div>
            ))}
            {suggestions.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Suggestions :</div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => { const e = especeById(s.id)!; return (
                    <button key={s.id} onClick={() => setEspece(s.id)} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(espece === s.id)}>{e.emoji} {e.nom}</button>
                  ) })}
                </div>
              </div>
            )}
          </div>
        </Field>
      )}

      {/* ── Portraits selon la cascade ── */}
      {kind === 'entreprise' ? (
        <>
          <div className="rounded-xl border p-4 mb-4" style={card}>
            <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>🏹 Premier portrait — l&apos;entreprise sur son MARCHÉ</div>
            <EspecePicker value={espece} onChange={setEspece} suggested={new Set(suggestions.map((s) => s.id))} />
            <HabitatPicker label="Son habitat économique" milieu="marché" value={hM} onChange={setHM} />
            <Field label="L'espèce est-elle armée pour ce milieu, tel qu'il évolue ?"><Scale value={vM} onChange={setVM} /></Field>
          </div>
          <div className="rounded-xl border p-4 mb-4" style={card}>
            <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>🏛️ Second portrait — l&apos;entreprise dans la CITÉ</div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Regardée comme habitante de la société (territoire, emploi, ce qu&apos;elle prélève et rend), ce peut être un animal
              <b> totalement différent</b>. Ce portrait est aussi sa marque employeur réelle : cet animal-là est-il attractif ?
              A-t-on envie de rejoindre sa colonie, sa meute, sa ruche ?
            </p>
            <EspecePicker value={especeCite} onChange={setEspeceCite} />
            <HabitatPicker label="Son habitat social" milieu="cité" value={hC} onChange={setHC} />
            <Field label="Est-il un habitant viable de son territoire — et attractif ?"><Scale value={vC} onChange={setVC} /></Field>
          </div>
        </>
      ) : kind === 'partie_prenante' ? (
        <div className="rounded-xl border p-4 mb-4" style={card}>
          <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>🌐 {etreLabel}</div>
          <EspecePicker value={espece} onChange={setEspece} />
          <Field label="La relation entre cet animal et l'entreprise">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
              {RELATIONS.map((r) => (
                <button key={r.id} onClick={() => setRelation(r.id)} title={r.sens} className="text-left rounded-lg border p-2"
                  style={relation === r.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)' } : card}>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{r.emoji} {r.nom}</div>
                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{r.sens}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="La relation est-elle viable pour les deux ? (qui nourrit qui, qui épuise qui ?)"><Scale value={vM} onChange={setVM} /></Field>
        </div>
      ) : (
        <div className="rounded-xl border p-4 mb-4" style={card}>
          <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>{kind === 'poste' ? '🧭' : '🏢'} {etreLabel}</div>
          <EspecePicker value={espece} onChange={setEspece} />
          <Field label={kind === 'poste' ? 'Son milieu : la fonction' : 'Son milieu : sa place dans l’entreprise'}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{kind === 'poste' ? MILIEU_POSTE_HINT : MILIEU_SERVICE_HINT}</div>
            <textarea rows={3} value={milieuLibre} onChange={(e) => setMilieuLibre(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
          </Field>
          <Field label={kind === 'poste'
            ? 'Le fonctionnement du poste est-il adapté à ce que son milieu exige — et le poste est-il viable ?'
            : "L'animal du service sert-il l'animal de l'entreprise ?"}>
            <Scale value={vM} onChange={setVM} />
          </Field>
        </div>
      )}

      <Field label="Les signaux">
        <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{SIGNAUX_HINT}</div>
        <textarea rows={2} value={signaux} onChange={(e) => setSignaux(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
      </Field>

      {kind === 'entreprise' && (!isOwner || regard === 'individuel') && (
        <Field label="La dédicace (anonyme)">
          <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{DEDICACE_HINT}</div>
          <textarea rows={2} value={dedicace} onChange={(e) => setDedicace(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        </Field>
      )}

      <Field label="Justification (facultatif)">
        <textarea rows={2} value={justif} onChange={(e) => setJustif(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent" style={card} />
      </Field>

      <div className="flex items-center gap-3">
        <button disabled={!ready || saving} onClick={save} className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer le portrait'}
        </button>
        {saved && <span className="text-sm" style={{ color: 'var(--accent)' }}>✓ Portrait enregistré — vous pouvez en peindre un autre.</span>}
      </div>
    </div>
  )
}

function EspecePicker({ value, onChange, suggested }: { value: string; onChange: (v: string) => void; suggested?: Set<string> }) {
  return (
    <Field label="L'espèce (le mode de fonctionnement observé)">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
        {ESPECES.map((e) => (
          <button key={e.id} onClick={() => onChange(e.id)} title={e.description} className="text-left rounded-lg border p-2"
            style={value === e.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)' } : card}>
            <div className="text-2xl">{e.emoji} {suggested?.has(e.id) && <span className="text-[10px] align-middle" style={{ color: 'var(--accent)' }}>★</span>}</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.nom}</div>
            <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{e.trait}</div>
          </button>
        ))}
      </div>
      {value && especeById(value) && (
        <div className="mt-2 rounded-lg border p-3 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{especeById(value)!.emoji} {especeById(value)!.nom} — </span>
          {especeById(value)!.description}
        </div>
      )}
    </Field>
  )
}

function HabitatPicker({ label, milieu, value, onChange }: { label: string; milieu: 'marché' | 'cité'; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {habitatsPourMilieu(milieu).map((h) => (
          <button key={h.id} onClick={() => onChange(h.id)} title={h.description} className="px-3 py-1.5 rounded-full border text-xs"
            style={value === h.id ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { ...card, color: 'var(--text)' }}>
            {h.emoji} {h.nom}
          </button>
        ))}
      </div>
    </Field>
  )
}

function Scale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VERDICTS.map((v) => (
        <button key={v.value} onClick={() => onChange(v.value)} className="px-3 py-1.5 rounded-lg border text-xs"
          style={value === v.value ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { ...card, color: 'var(--text)' }}>
          {v.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  )
}

function Gauge({ value }: { value?: number }) {
  const n = value ? Math.round(value) : 0
  return <span className="inline-flex gap-1 align-middle">{[1, 2, 3, 4].map((i) => (
    <span key={i} className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: i <= n ? 'var(--accent)' : 'var(--border)' }} />
  ))}</span>
}

function SecteurBox({ sect, disclaimer }: { sect: AiSecteur; disclaimer?: boolean }) {
  return (
    <div className="rounded-lg border p-3 text-sm space-y-1" style={card}>
      <div className="font-semibold" style={{ color: 'var(--text)' }}>📊 Profil sectoriel{sect.nom ? ` — ${sect.nom}` : ''} <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>(indicatif)</span></div>
      {sect.attractivite && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Attractivité :</b> {sect.attractivite}</div>}
      {sect.forces?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Forces :</b> {sect.forces.join(' · ')}</div> : null}
      {sect.faiblesses?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Faiblesses :</b> {sect.faiblesses.join(' · ')}</div> : null}
      {sect.turnover && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Turnover :</b> {sect.turnover}</div>}
      {sect.stress_burnout && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Stress / burn-out :</b> {sect.stress_burnout}</div>}
      {sect.remuneration && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Rémunération :</b> {sect.remuneration}</div>}
      {disclaimer && <div className="text-xs pt-1" style={{ color: 'var(--text-subtle)' }}>{SECTEUR_DISCLAIMER}</div>}
    </div>
  )
}

// ─── Le miroir (restitution) ──────────────────────────────────────────────────

function Miroir({ etres, portraits, enCollecte, userId, participants }: {
  etres: Etre[]; portraits: Portrait[]; enCollecte: boolean; userId: string | null; participants: Participant[]
}) {
  if (enCollecte) {
    const mine = portraits.filter((p) => p.user_id === userId)
    const acceptes = participants.filter((p) => p.regles_acceptees !== false).length
    return (
      <div className="max-w-3xl">
        <div className="rounded-xl border p-4 mb-4" style={card}>
          <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>🔒 Collecte en cours — le miroir est voilé</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Pendant la collecte, personne ne lit les réponses des autres — pas même le dirigeant (contrat de règles). Le miroir
            s&apos;ouvrira à la restitution. Participation : <b style={{ color: 'var(--text)' }}>{acceptes}</b> participant(s),{' '}
            <b style={{ color: 'var(--text)' }}>{portraits.length}</b> portrait(s) peints.
          </p>
        </div>
        {mine.length > 0 && (
          <>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Mes portraits ({mine.length})</div>
            <div className="space-y-3">{mine.map((p, i) => <PortraitDetail key={p.id} p={p} index={i} />)}</div>
          </>
        )}
      </div>
    )
  }

  const groups: { kind: EtreKind; titre: string; note?: string }[] = [
    { kind: 'entreprise', titre: "L'entreprise — deux animaux, deux milieux" },
    { kind: 'service', titre: 'Les services' },
    { kind: 'poste', titre: "Les postes d'encadrement", note: 'Le poste, jamais la personne. En mission réelle, chaque portrait de poste est restitué au titulaire avant toute discussion collective (méthode §6.4).' },
    { kind: 'partie_prenante', titre: 'Les parties prenantes — les espèces qui peuplent les milieux' },
  ]

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const list = etres.filter((e) => e.kind === g.kind)
        const painted = list.filter((e) => portraits.some((p) => p.etre_key === e.key))
        if (!painted.length) return null
        return (
          <div key={g.kind}>
            <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{g.titre}</div>
            {g.note && <div className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>{g.note}</div>}
            <div className={g.kind === 'entreprise' ? '' : 'grid md:grid-cols-2 gap-4 items-start'}>
              {painted.map((e) => {
                const all = portraits.filter((p) => p.etre_key === e.key)
                return g.kind === 'entreprise'
                  ? <EntrepriseCard key={e.key} label={e.label} all={all} />
                  : <EtreCard key={e.key} etre={e} all={all} />
              })}
            </div>
          </div>
        )
      })}
      {portraits.length === 0 && <Info>Aucun portrait. Rouvrez la collecte pour peindre.</Info>}
    </div>
  )
}

function SousLeSeuil({ n }: { n: number }) {
  return (
    <div className="rounded-lg border border-dashed p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
      🔒 Sous le seuil de restitution : {n}/{SEUIL_RESTITUTION} regards. Rien n&apos;est restitué en dessous de {SEUIL_RESTITUTION} regards
      (contrat de règles) — invitez d&apos;autres participants ou fusionnez ce périmètre.
    </div>
  )
}

function EntrepriseCard({ label, all }: { label: string; all: Portrait[] }) {
  const [open, setOpen] = useState(false)
  const het = all.filter((p) => p.kind === 'individuel')
  const auto = all.find((p) => p.kind === 'auto')
  const nRegards = new Set(het.map((p) => p.user_id)).size
  const sousSeuil = nRegards < SEUIL_RESTITUTION

  const espM = modeOf(het.map((p) => p.espece_id))
  const espC = modeOf(het.map((p) => p.espece_cite_id || p.espece_id))
  const habM = modeOf(het.map((p) => p.habitat_marche_id || '').filter(Boolean))
  const habC = modeOf(het.map((p) => p.habitat_cite_id || '').filter(Boolean))
  const vM = avgOf(het.map((p) => p.verdict_marche || 0).filter(Boolean))
  const vC = avgOf(het.map((p) => p.verdict_cite || 0).filter(Boolean))
  const dedicaces = het.map((p) => p.dedicace).filter(Boolean) as string[]
  const signaux = het.map((p) => p.signaux).filter(Boolean) as string[]

  const eM = especeById(espM ?? ''); const eC = especeById(espC ?? '')
  const autoEM = auto ? especeById(auto.espece_id) : null
  const autoEC = auto ? especeById(auto.espece_cite_id || auto.espece_id) : null
  const ecartEspeceM = auto && espM && auto.espece_id !== espM
  const ecartEspeceC = auto && espC && (auto.espece_cite_id || auto.espece_id) !== espC
  const ecartVM = auto && vM !== undefined && auto.verdict_marche ? Math.abs(auto.verdict_marche - vM) >= 1 : false
  const ecartVC = auto && vC !== undefined && auto.verdict_cite ? Math.abs(auto.verdict_cite - vC) >= 1 : false
  const paireDiff = espM && espC && espM !== espC

  const badge = (txt: string) => (
    <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#f6e7df', color: '#a85b3b' }}>{txt}</span>
  )

  return (
    <div className="rounded-xl border p-4" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>{nRegards} regard(s){auto ? ' + le portrait de référence du dirigeant' : ''}</div>

      {sousSeuil ? <SousLeSeuil n={nRegards} /> : (
        <>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg border p-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>🏹 SUR SON MARCHÉ</div>
              <div style={{ color: 'var(--text)' }}>{eM ? `${eM.emoji} ${eM.nom}` : '—'}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {(() => { const h = habitatById(habM ?? ''); return h ? `${h.emoji} ${h.nom} · ` : '' })()}adéquation <Gauge value={vM} />
              </div>
              {auto && (
                <div className="text-xs mt-2 pt-2 border-t space-x-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <span>Dirigeant : {autoEM ? `${autoEM.emoji} ${autoEM.nom}` : '—'} · <Gauge value={auto.verdict_marche ?? undefined} /></span>
                  {ecartEspeceM && badge("écart d'espèce")}
                  {ecartVM && badge("écart d'adéquation")}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>🏛️ DANS LA CITÉ (marque employeur réelle)</div>
              <div style={{ color: 'var(--text)' }}>{eC ? `${eC.emoji} ${eC.nom}` : '—'}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {(() => { const h = habitatById(habC ?? ''); return h ? `${h.emoji} ${h.nom} · ` : '' })()}adéquation <Gauge value={vC} />
              </div>
              {auto && (
                <div className="text-xs mt-2 pt-2 border-t space-x-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <span>Dirigeant : {autoEC ? `${autoEC.emoji} ${autoEC.nom}` : '—'} · <Gauge value={auto.verdict_cite ?? undefined} /></span>
                  {ecartEspeceC && badge("écart d'espèce")}
                  {ecartVC && badge("écart d'adéquation")}
                </div>
              )}
            </div>
          </div>

          {paireDiff && (
            <div className="rounded-lg border p-3 mb-3 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>⚖️ La paire des deux animaux :</b> {eM?.emoji} {eM?.nom} sur le marché, {eC?.emoji} {eC?.nom} dans
              la cité. Deux animaux différents — tension féconde ou écartèlement ? Les deux peuvent-ils être portés par le même
              corps ? C&apos;est souvent là que la perte de sens se loge (méthode §5.2).
            </div>
          )}

          {dedicaces.length > 0 && (
            <div className="rounded-lg border p-3 mb-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>💬 LES DÉDICACES (anonymes) — « si cet animal pouvait dire une chose au dirigeant… »</div>
              <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                {dedicaces.map((d, i) => <li key={i}>« {d} »</li>)}
              </ul>
            </div>
          )}

          {signaux.length > 0 && (
            <div className="rounded-lg border p-3 mb-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-subtle)' }}>📡 LES SIGNAUX (peur / blessure / angle mort)</div>
              <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                {signaux.map((s, i) => <li key={i}>« {s} »</li>)}
              </ul>
            </div>
          )}

          <button onClick={() => setOpen((o) => !o)} className="text-xs underline" style={{ color: 'var(--accent)' }}>
            {open ? 'Masquer le détail' : `Ouvrir le miroir — voir les ${all.length} portrait(s)`}
          </button>
          {open && (
            <div className="mt-3 space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {all.map((p, i) => <PortraitDetail key={p.id} p={p} index={i} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EtreCard({ etre, all }: { etre: Etre; all: Portrait[] }) {
  const [open, setOpen] = useState(false)
  const het = all.filter((p) => p.kind === 'individuel')
  const nRegards = new Set(het.map((p) => p.user_id)).size
  const sousSeuil = nRegards < SEUIL_RESTITUTION
  const esp = especeById(modeOf(het.map((p) => p.espece_id)) ?? '')
  const v = avgOf(het.map((p) => p.verdict_marche || 0).filter(Boolean))
  const rel = etre.kind === 'partie_prenante' ? relationById(modeOf(het.map((p) => p.relation || '').filter(Boolean)) ?? '') : null
  const milieux = het.map((p) => p.milieu_libre).filter(Boolean) as string[]
  const signaux = het.map((p) => p.signaux).filter(Boolean) as string[]

  return (
    <div className="rounded-xl border p-4" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{etre.label}</div>
      <div className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>{nRegards} regard(s)</div>
      {sousSeuil ? <SousLeSeuil n={nRegards} /> : (
        <>
          <div className="mb-1" style={{ color: 'var(--text)' }}>{esp ? `${esp.emoji} ${esp.nom}` : '—'}</div>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            {rel && <span className="mr-2">{rel.emoji} {rel.nom}</span>}
            {etre.kind === 'partie_prenante' ? 'relation viable ?' : 'adéquation'} <Gauge value={v} />
          </div>
          {milieux.length > 0 && (
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>Le milieu décrit :</b> {milieux.map((m, i) => <span key={i}>« {m} » </span>)}
            </div>
          )}
          {signaux.length > 0 && (
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>Signaux :</b> {signaux.map((s, i) => <span key={i}>« {s} » </span>)}
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className="text-xs underline" style={{ color: 'var(--accent)' }}>
            {open ? 'Masquer le détail' : `Voir les ${all.length} regard(s)`}
          </button>
          {open && (
            <div className="mt-3 space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {all.map((p, i) => <PortraitDetail key={p.id} p={p} index={i} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PortraitDetail({ p, index }: { p: Portrait; index: number }) {
  const esp = especeById(p.espece_id)
  const espC = p.espece_cite_id ? especeById(p.espece_cite_id) : null
  const hM = p.habitat_marche_id ? habitatById(p.habitat_marche_id) : null
  const hC = p.habitat_cite_id ? habitatById(p.habitat_cite_id) : null
  const rel = p.relation ? relationById(p.relation) : null
  const isIa = p.methode === 'ia'
  const sect = p.ia?.secteur
  return (
    <div className="rounded-lg border p-3 text-xs space-y-1.5" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          {p.kind === 'auto' ? 'Portrait du dirigeant' : `Regard ${index + 1}`}
        </span>
        <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-subtle)' }}>
          {isIa ? '🤖 Automatique (IA)' : '✋ Manuel'}
        </span>
      </div>
      <div style={{ color: 'var(--text)' }}>
        {esp ? `${esp.emoji} ${esp.nom}` : '—'}{espC && espC.id !== p.espece_id ? <span> · cité : {espC.emoji} {espC.nom}</span> : null}
      </div>
      {(hM || hC) && (
        <div style={{ color: 'var(--text-muted)' }}>
          {hM && <>Marché : {hM.emoji} {hM.nom} · <i>{verdictLabel(p.verdict_marche)}</i><br /></>}
          {hC && <>Cité : {hC.emoji} {hC.nom} · <i>{verdictLabel(p.verdict_cite)}</i></>}
        </div>
      )}
      {!hM && p.verdict_marche ? <div style={{ color: 'var(--text-muted)' }}>{rel ? 'Relation viable' : 'Adéquation'} : <i>{verdictLabel(p.verdict_marche)}</i></div> : null}
      {rel && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Relation :</b> {rel.emoji} {rel.nom}</div>}
      {p.milieu_libre && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Milieu :</b> {p.milieu_libre}</div>}
      {p.signaux && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Signaux :</b> {p.signaux}</div>}
      {p.dedicace && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Dédicace :</b> « {p.dedicace} »</div>}
      {p.justification && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Justification :</b> {p.justification}</div>}

      {isIa && p.prompt && Object.keys(p.prompt).length > 0 && (
        <div className="mt-1 pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="font-semibold mb-0.5" style={{ color: 'var(--text)' }}>📝 Ce qui a été décrit à l&apos;IA</div>
          {Object.entries(p.prompt).map(([k, v]) => (
            <div key={k} style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>{oqLabel(k)} :</b> {v}</div>
          ))}
        </div>
      )}
      {isIa && sect && (
        <div className="mt-1 pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
          <SecteurBox sect={sect} />
        </div>
      )}
    </div>
  )
}

// ─── Image cible, engagements, indicateurs (phase 3-4) ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActionPanel({ campagne, portraits, etres, engagements, participants, prev, isOwner, supabase, onChange }: {
  campagne: Campagne; portraits: Portrait[]; etres: Etre[]; engagements: Engagement[]
  participants: Participant[]; prev: PrevYear | null; isOwner: boolean; supabase: any; onChange: () => void
}) {
  const [cibleEspece, setCibleEspece] = useState(campagne.image_cible?.espece_id ?? '')
  const [cibleNote, setCibleNote] = useState(campagne.image_cible?.note ?? '')
  const [qui, setQui] = useState(''); const [quoi, setQuoi] = useState(''); const [echeance, setEcheance] = useState(''); const [comportement, setComportement] = useState('')

  const het = portraits.filter((p) => p.etre_key === 'entreprise' && p.kind === 'individuel')
  const auto = portraits.find((p) => p.etre_key === 'entreprise' && p.kind === 'auto')
  const espM = modeOf(het.map((p) => p.espece_id))
  const espC = modeOf(het.map((p) => p.espece_cite_id || p.espece_id))

  async function saveCible() {
    await supabase.from('le_miroir_campagnes').update({ image_cible: { espece_id: cibleEspece || undefined, note: cibleNote.trim() || undefined } }).eq('id', campagne.id)
    onChange()
  }
  async function addEngagement() {
    if (!qui.trim() || !quoi.trim() || !comportement.trim() || engagements.length >= 3) return
    await supabase.from('le_miroir_engagements').insert({
      campagne_id: campagne.id, qui: qui.trim(), quoi: quoi.trim(), echeance: echeance.trim() || null, comportement: comportement.trim(),
    })
    setQui(''); setQuoi(''); setEcheance(''); setComportement(''); onChange()
  }
  async function setEngStatut(id: string, statut: Engagement['statut']) {
    await supabase.from('le_miroir_engagements').update({ statut }).eq('id', id); onChange()
  }
  async function delEngagement(id: string) {
    await supabase.from('le_miroir_engagements').delete().eq('id', id); onChange()
  }

  // ── Indicateurs standard (méthode §7.3) ──
  const acceptes = participants.filter((p) => p.regles_acceptees !== false).length
  const etresPeints = etres.filter((e) => portraits.some((p) => p.etre_key === e.key))
  const restituables = etresPeints.filter((e) => new Set(portraits.filter((p) => p.etre_key === e.key && p.kind === 'individuel').map((p) => p.user_id)).size >= SEUIL_RESTITUTION)
  const ecartDirigeant = !auto ? '—'
    : (() => {
        const dM = espM && auto.espece_id !== espM
        const dC = espC && (auto.espece_cite_id || auto.espece_id) !== espC
        if (dM && dC) return 'Écart sur les deux milieux'
        if (dM) return 'Écart sur le marché'
        if (dC) return 'Écart sur la cité'
        return 'Aligné (même famille d’image)'
      })()
  const constates = engagements.filter((e) => e.statut === 'constate').length
  const cibleEsp = especeById(campagne.image_cible?.espece_id ?? '')
  const prevEsp = especeById(prev?.especeMarche ?? '')
  const prevCible = especeById(prev?.imageCible?.espece_id ?? '')
  const nowEsp = especeById(espM ?? '')
  const mouvement = prev?.especeMarche
    ? `${prevEsp ? prevEsp.emoji + ' ' + prevEsp.nom : '—'} (${campagne.annee - 1}) → ${nowEsp ? nowEsp.emoji + ' ' + nowEsp.nom : '—'} (${campagne.annee})${prevCible ? ` · cible ${campagne.annee - 1} : ${prevCible.emoji} ${prevCible.nom}${nowEsp && prevCible.id === nowEsp.id ? ' ✓ atteinte' : ''}` : ''}`
    : 'Première campagne — la re-mesure comparera les images l’an prochain.'

  const engStatutStyle: Record<Engagement['statut'], React.CSSProperties> = {
    en_cours: { backgroundColor: '#eef1f6', color: '#4a5a78' },
    constate: { backgroundColor: '#eef4ee', color: '#3d6b3d' },
    abandonne: { backgroundColor: '#f6e7df', color: '#a85b3b' },
  }
  const engStatutLabel: Record<Engagement['statut'], string> = { en_cours: 'En cours', constate: 'Comportement constaté ✓', abandonne: 'Abandonné' }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Image cible */}
      <div className="rounded-xl border p-4" style={card}>
        <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>🎯 L&apos;image cible</div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Choisie collectivement en atelier de restitution : quel animal voulons-nous être, dans quel milieu, et qu&apos;est-ce
          que ça implique ? Le praticien vérifie l&apos;adéquation au milieu réel — pas d&apos;image de fuite (méthode §6.1).
        </p>
        {campagne.image_cible?.espece_id && cibleEsp && (
          <div className="mb-2 text-lg" style={{ color: 'var(--text)' }}>{cibleEsp.emoji} {cibleEsp.nom}</div>
        )}
        {campagne.image_cible?.note && <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>« {campagne.image_cible.note} »</div>}
        {isOwner && (
          <div className="flex flex-wrap gap-2 items-start">
            <select value={cibleEspece} onChange={(e) => setCibleEspece(e.target.value)} className="px-3 py-2 rounded-lg border bg-transparent text-sm" style={card}>
              <option value="">— espèce cible —</option>
              {ESPECES.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.nom}</option>)}
            </select>
            <input value={cibleNote} onChange={(e) => setCibleNote(e.target.value)} placeholder="Ce que ça implique, en une phrase (issue de l'atelier)"
              className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
            <button onClick={saveCible} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Enregistrer</button>
          </div>
        )}
      </div>

      {/* Engagements */}
      <div className="rounded-xl border p-4" style={card}>
        <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>🤝 Les engagements — 3 maximum, en comportements observables</div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          [Qui] fera [quoi] à partir de [quand], et on le verra à [comportement observable] — pas « améliorer la communication »,
          mais quelque chose qu&apos;un observateur extérieur pourrait constater (méthode §7.1).
        </p>
        <div className="space-y-2 mb-3">
          {engagements.map((e, i) => (
            <div key={e.id} className="rounded-lg border p-3 text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <b style={{ color: 'var(--text)' }}>Engagement {i + 1}</b>
                <span className="px-2 py-0.5 rounded-full text-xs" style={engStatutStyle[e.statut]}>{engStatutLabel[e.statut]}</span>
                {isOwner && (
                  <span className="ml-auto flex gap-1">
                    {(['en_cours', 'constate', 'abandonne'] as const).map((s) => (
                      <button key={s} onClick={() => setEngStatut(e.id, s)} className="px-2 py-0.5 rounded border text-xs"
                        style={e.statut === s ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { ...card, color: 'var(--text-subtle)' }}>
                        {s === 'en_cours' ? 'en cours' : s === 'constate' ? 'constaté' : 'abandonné'}
                      </button>
                    ))}
                    <button onClick={() => delEngagement(e.id)} className="px-2 py-0.5 text-xs underline" style={{ color: 'var(--text-subtle)' }}>suppr.</button>
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text)' }}>{e.qui}</b> — {e.quoi}{e.echeance ? ` · à partir de ${e.echeance}` : ''}<br />
                <span className="text-xs">👁 On le verra à : {e.comportement}</span>
              </div>
            </div>
          ))}
        </div>
        {isOwner && engagements.length < 3 && (
          <div className="grid md:grid-cols-2 gap-2">
            <input value={qui} onChange={(e) => setQui(e.target.value)} placeholder="Qui ? (ex : le dirigeant, le CODIR)" className="px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
            <input value={echeance} onChange={(e) => setEcheance(e.target.value)} placeholder="À partir de quand ? (ex : lundi prochain)" className="px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
            <input value={quoi} onChange={(e) => setQuoi(e.target.value)} placeholder="Fera quoi ?" className="px-3 py-2 rounded-lg border bg-transparent text-sm md:col-span-2" style={card} />
            <input value={comportement} onChange={(e) => setComportement(e.target.value)} placeholder="On le verra à… (comportement observable)" className="px-3 py-2 rounded-lg border bg-transparent text-sm md:col-span-2" style={card} />
            <div><button onClick={addEngagement} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Ajouter l&apos;engagement</button></div>
          </div>
        )}
        {engagements.length >= 3 && <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>3 engagements — au-delà, rien ne se fait (méthode §7.1).</div>}
      </div>

      {/* Indicateurs standard */}
      <div className="rounded-xl border p-4" style={card}>
        <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>📈 Les indicateurs standard de la mission (méthode §7.3)</div>
        <table className="w-full text-sm mt-2">
          <tbody style={{ color: 'var(--text-muted)' }}>
            <Ind label="Participation" value={`${acceptes} participant(s) ayant accepté le contrat de règles`} />
            <Ind label="Êtres restituables (seuil ≥ 4)" value={`${restituables.length} / ${etresPeints.length} êtres peints`} />
            <Ind label="Écart dirigeant ↔ équipes" value={ecartDirigeant} />
            <Ind label="Tenue des engagements" value={engagements.length ? `${constates} / ${engagements.length} comportement(s) constaté(s)` : 'Aucun engagement posé'} />
            <Ind label="Mouvement d'image (re-mesure)" value={mouvement} />
          </tbody>
        </table>
        <div className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
          Ces indicateurs figurent en dernière page de chaque diagnostic. Jamais utilisés pour comparer des clients entre eux —
          uniquement en agrégat anonymisé.
        </div>
      </div>
    </div>
  )
}

function Ind({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
      <td className="py-1.5 pr-3 font-medium whitespace-nowrap align-top" style={{ color: 'var(--text)' }}>{label}</td>
      <td className="py-1.5">{value}</td>
    </tr>
  )
}
