'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RseContext } from '@/components/rse/RseAppShell'
import {
  ESPECES, VERDICTS, QUIZ, OPEN_QUESTIONS, SECTEUR_DISCLAIMER, especeById, habitatById, habitatsPourMilieu, suggererEspeces,
} from '@/lib/leMiroir'

interface AiSecteur {
  nom?: string; attractivite?: string; forces?: string[]; faiblesses?: string[]
  turnover?: string; stress_burnout?: string; remuneration?: string
}
interface AiSuggestion {
  especeId?: string; habitatMarcheId?: string; habitatCiteId?: string
  verdictMarche?: number; verdictCite?: number; justification?: string; secteur?: AiSecteur
}

interface Portrait {
  id: string; user_id: string; etre_key: string; etre_label: string; espece_id: string
  habitat_marche_id: string; habitat_cite_id: string; verdict_marche: number; verdict_cite: number
  justification: string | null; kind: 'individuel' | 'auto'
  methode?: 'manuel' | 'ia' | null; prompt?: Record<string, string> | null; ia?: AiSuggestion | null
}
interface Campagne { id: string; owner_id: string; annee: number; nom: string | null }
interface Participant { id: string; poste: string | null; service: string | null }

const card = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' } as const

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
  const [tab, setTab] = useState<'observer' | 'miroir'>('observer')
  const [showShare, setShowShare] = useState(false)

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
    const [{ data: parts }, { data: ports }, { data: mine }] = await Promise.all([
      supabase.from('le_miroir_participants').select('id,poste,service').eq('campagne_id', camp.id),
      supabase.from('le_miroir_portraits').select('*').eq('campagne_id', camp.id),
      supabase.from('le_miroir_participants').select('id,poste,service').eq('campagne_id', camp.id).eq('user_id', uid).maybeSingle(),
    ])
    setParticipants((parts as Participant[]) ?? [])
    setPortraits((ports as Portrait[]) ?? [])
    setParticipant((mine as Participant) ?? null)
    setLoading(false)
  }, [supabase, orgId, year])

  useEffect(() => { loadAll() }, [loadAll])

  // Décalage d'année (règle RseAppShell obligatoire pour données par année)
  useEffect(() => {
    ctx.setYearShiftHandler(async (delta: number) => {
      if (!orgId) return
      await fetch('/api/le-miroir/shift-year', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, delta }),
      })
    })
    return () => { ctx.setYearShiftHandler(null) }
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function startCampagne() {
    if (!userId || !orgId) return
    await supabase.from('le_miroir_campagnes').insert({ owner_id: userId, org_id: orgId, annee: year, nom: `Campagne ${year}` })
    loadAll()
  }

  if (!orgId) return <Info>Sélectionnez une organisation dans le panneau de gauche pour démarrer le miroir.</Info>
  if (loading) return <Info>Chargement du miroir…</Info>

  if (!campagne) {
    return (
      <div className="p-6 max-w-xl">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Aucune campagne pour {orgName} · {year}</h2>
        <p className="mb-4" style={{ color: 'var(--text-muted)' }}>
          En tant que responsable, démarrez la campagne du miroir collectif. Vous pourrez ensuite inviter des participants
          (via le partage de la plateforme) ; chacun déclarera son poste et son service, puis peindra l&apos;organisation.
        </p>
        <button onClick={startCampagne} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Démarrer la campagne {year}
        </button>
      </div>
    )
  }

  if (!participant) {
    return <Onboarding onSave={async (poste, service) => {
      await supabase.from('le_miroir_participants').insert({ campagne_id: campagne.id, user_id: userId, poste, service })
      loadAll()
    }} />
  }

  // Êtres observables : l'entreprise + les services déclarés
  const services = Array.from(new Set(participants.map((p) => p.service).filter(Boolean))) as string[]
  const etres: { key: string; label: string }[] = [
    { key: 'entreprise', label: orgName },
    ...services.map((s) => ({ key: 'service:' + s, label: 'Service ' + s })),
  ]
  const isOwner = campagne.owner_id === userId

  return (
    <div className="p-4 md:p-6">
      <div className="flex gap-2 mb-5">
        {(['observer', 'miroir'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm border"
            style={tab === t ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { ...card, color: 'var(--text)' }}>
            {t === 'observer' ? 'Peindre' : 'Le miroir'}
          </button>
        ))}
        {isOwner && (
          <button onClick={() => setShowShare((v) => !v)} className="px-4 py-2 rounded-lg text-sm border" style={{ ...card, color: 'var(--text)' }}>
            👥 Inviter
          </button>
        )}
        <span className="ml-auto text-sm self-center" style={{ color: 'var(--text-subtle)' }}>
          {participant.poste} · {participant.service} — {portraits.length} portraits
        </span>
      </div>

      {isOwner && showShare && <ShareManager campagneId={campagne.id} />}

      {tab === 'observer'
        ? <Observer etres={etres} onSave={async (p) => {
            const full = { campagne_id: campagne.id, user_id: userId, ...p }
            const { error } = await supabase.from('le_miroir_portraits').insert(full)
            if (error) {
              // Repli si les colonnes methode/prompt/ia n'existent pas encore (migration non appliquée)
              const { methode, prompt, ia, ...base } = full; void methode; void prompt; void ia
              await supabase.from('le_miroir_portraits').insert(base)
            }
            await loadAll(); setTab('miroir')
          }} />
        : <Miroir etres={etres} portraits={portraits} />}
    </div>
  )
}

function Info({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>{children}</div>
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
    if (!r.ok) { setMsg(d.error || 'Échec de l\'invitation.'); return }
    setEmail(''); setMsg('✓ Participant invité.'); load()
  }
  async function remove(id: string) {
    await fetch(`/api/le-miroir/${campagneId}/shares?share_id=${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="rounded-xl border p-4 mb-5" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>👥 Inviter des participants</div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Par e-mail (la personne doit avoir un compte sur la plateforme). Chaque invité déclarera son poste et son service, puis pourra peindre les êtres qu&apos;il côtoie.</p>
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

function Onboarding({ onSave }: { onSave: (poste: string, service: string) => Promise<void> }) {
  const [poste, setPoste] = useState(''); const [service, setService] = useState(''); const [saving, setSaving] = useState(false)
  return (
    <div className="p-6 max-w-md">
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Bienvenue dans le miroir</h2>
      <p className="mb-4" style={{ color: 'var(--text-muted)' }}>Avant de commencer, dites-nous qui vous êtes dans l&apos;organisation.</p>
      <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Votre poste</label>
      <input value={poste} onChange={(e) => setPoste(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border bg-transparent" style={card} placeholder="ex : Chargé d'affaires" />
      <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Votre service</label>
      <input value={service} onChange={(e) => setService(e.target.value)} className="w-full mb-4 px-3 py-2 rounded-lg border bg-transparent" style={card} placeholder="ex : Commercial" />
      <button disabled={!poste || !service || saving} onClick={async () => { setSaving(true); await onSave(poste.trim(), service.trim()) }}
        className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
        {saving ? '…' : 'Commencer'}
      </button>
    </div>
  )
}

interface NewPortrait { etre_key: string; etre_label: string; espece_id: string; habitat_marche_id: string; habitat_cite_id: string; verdict_marche: number; verdict_cite: number; justification: string | null; kind: 'individuel' | 'auto'; methode: 'manuel' | 'ia'; prompt: Record<string, string> | null; ia: AiSuggestion | null }

function Observer({ etres, onSave }: { etres: { key: string; label: string }[]; onSave: (p: NewPortrait) => Promise<void> }) {
  const [etreKey, setEtreKey] = useState(etres[0]?.key ?? 'entreprise')
  const [kind, setKind] = useState<'individuel' | 'auto'>('individuel')
  const [espece, setEspece] = useState(''); const [hM, setHM] = useState(''); const [hC, setHC] = useState('')
  const [vM, setVM] = useState(0); const [vC, setVC] = useState(0); const [justif, setJustif] = useState('')
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); const [saving, setSaving] = useState(false)
  const [oa, setOa] = useState<Record<string, string>>({}); const [analysing, setAnalysing] = useState(false); const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [aiSecteur, setAiSecteur] = useState<AiSecteur | null>(null)
  const [methode, setMethode] = useState<'manuel' | 'ia'>('manuel')
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const tags = Object.values(answers).flat(); const suggestions = suggererEspeces(tags)
  const visibleQuiz = QUIZ.filter((q) => !q.showIf || q.showIf(tags))
  const suggestedIds = new Set(suggestions.map((s) => s.id))
  const ready = espece && hM && hC && vM && vC
  const chip = (active: boolean) => active
    ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
    : { ...card, color: 'var(--text)' }
  const etreLabel = etres.find((x) => x.key === etreKey)?.label ?? 'cet être'

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
      if (s.especeId) setEspece(s.especeId)
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

  return (
    <div className="max-w-3xl">
      <Field label="Quel être ?">
        <select value={etreKey} onChange={(e) => setEtreKey(e.target.value)} className="px-3 py-2 rounded-lg border bg-transparent" style={card}>
          {etres.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
      </Field>

      <Field label="Type de regard">
        <div className="flex gap-2">
          {(['individuel', 'auto'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="px-3 py-1.5 rounded-lg border text-sm" style={chip(kind === k)}>
              {k === 'individuel' ? 'Regard extérieur' : 'Auto-portrait'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Comment construire le portrait ?">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMethode('ia')} className="px-3 py-1.5 rounded-lg border text-sm" style={chip(methode === 'ia')}>🤖 Automatique (IA, narratif)</button>
          <button onClick={() => setMethode('manuel')} className="px-3 py-1.5 rounded-lg border text-sm" style={chip(methode === 'manuel')}>✋ Manuel (choix guidé)</button>
        </div>
        <div className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
          {methode === 'ia'
            ? "Décrivez l'activité avec vos mots ; l'IA propose l'espèce, les habitats et le profil sectoriel — vous gardez la main pour ajuster."
            : "Répondez au questionnaire : les questions s'affinent selon vos réponses, puis choisissez l'espèce et les milieux."}
        </div>
      </Field>

      {methode === 'ia' && (
      <Field label="🤖 Analyse IA — décrire l'activité">
        <div className="rounded-xl border p-4 space-y-3" style={card}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Renseignez quelques éléments sur « {etreLabel} » ; l&apos;IA proposera l&apos;espèce et les habitats (marché / cité), que vous pourrez ensuite ajuster.</p>
          {OPEN_QUESTIONS.map((q) => (
            <div key={q.id}>
              <label className="block text-sm mb-0.5" style={{ color: 'var(--text)' }}>{q.label}</label>
              {q.hint && <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{q.hint}</div>}
              {q.type === 'choice'
                ? <div className="flex flex-wrap gap-2">{(q.options ?? []).map((o) => (
                    <button key={o} type="button" onClick={() => setOa((a) => ({ ...a, [q.id]: a[q.id] === o ? '' : o }))} className="px-3 py-1.5 rounded-full border text-xs" style={chip(oa[q.id] === o)}>{o}</button>
                  ))}</div>
                : <textarea rows={2} value={oa[q.id] || ''} onChange={(e) => setOa((a) => ({ ...a, [q.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />}
            </div>
          ))}
          <button type="button" disabled={analysing} onClick={analyser} className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {analysing ? 'Analyse en cours…' : "Analyser avec l'IA"}
          </button>
          {aiMsg && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{aiMsg}</div>}
          {aiSecteur && (
            <div className="rounded-lg border p-3 text-sm space-y-1" style={card}>
              <div className="font-semibold" style={{ color: 'var(--text)' }}>📊 Profil sectoriel{aiSecteur.nom ? ` — ${aiSecteur.nom}` : ''} <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>(indicatif)</span></div>
              {aiSecteur.attractivite && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Attractivité :</b> {aiSecteur.attractivite}</div>}
              {aiSecteur.forces?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Forces :</b> {aiSecteur.forces.join(' · ')}</div> : null}
              {aiSecteur.faiblesses?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Faiblesses :</b> {aiSecteur.faiblesses.join(' · ')}</div> : null}
              {aiSecteur.turnover && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Turnover :</b> {aiSecteur.turnover}</div>}
              {aiSecteur.stress_burnout && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Stress / burn-out :</b> {aiSecteur.stress_burnout}</div>}
              {aiSecteur.remuneration && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Rémunération :</b> {aiSecteur.remuneration}</div>}
              <div className="text-xs pt-1" style={{ color: 'var(--text-subtle)' }}>{SECTEUR_DISCLAIMER}</div>
            </div>
          )}
        </div>
      </Field>
      )}

      {methode === 'manuel' && (
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
                    className="px-3 py-1.5 rounded-full border text-xs" style={chip(active)}>{o.label}</button>
                })}
              </div>
            </div>
          ))}
          {suggestions.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Suggestions :</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => { const e = especeById(s.id)!; return (
                  <button key={s.id} onClick={() => setEspece(s.id)} className="px-3 py-1.5 rounded-full border text-xs" style={chip(espece === s.id)}>{e.emoji} {e.nom}</button>
                ) })}
              </div>
            </div>
          )}
        </div>
      </Field>
      )}

      <Field label="L'espèce (le mode de fonctionnement)">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
          {ESPECES.map((e) => (
            <button key={e.id} onClick={() => setEspece(e.id)} title={e.description} className="text-left rounded-lg border p-2"
              style={espece === e.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)' } : card}>
              <div className="text-2xl">{e.emoji} {suggestedIds.has(e.id) && <span className="text-[10px] align-middle" style={{ color: 'var(--accent)' }}>★</span>}</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.nom}</div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{e.trait}</div>
            </button>
          ))}
        </div>
        {espece && especeById(espece) && (
          <div className="mt-2 rounded-lg border p-3 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{especeById(espece)!.emoji} {especeById(espece)!.nom} — </span>
            {especeById(espece)!.description}
          </div>
        )}
      </Field>

      <HabitatPicker label="Habitat côté marché" milieu="marché" value={hM} onChange={setHM} />
      <HabitatPicker label="Habitat côté cité" milieu="cité" value={hC} onChange={setHC} />

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Adéquation sur le marché ?"><Scale value={vM} onChange={setVM} /></Field>
        <Field label="Adéquation dans la cité ?"><Scale value={vC} onChange={setVC} /></Field>
      </div>

      <Field label="Justification (facultatif)">
        <textarea rows={2} value={justif} onChange={(e) => setJustif(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-transparent" style={card} />
      </Field>

      <button disabled={!ready || saving} onClick={async () => {
        setSaving(true)
        const e = etres.find((x) => x.key === etreKey)!
        const promptClean = Object.fromEntries(Object.entries(oa).filter(([, v]) => v && v.trim()))
        await onSave({
          etre_key: etreKey, etre_label: e.label, espece_id: espece, habitat_marche_id: hM, habitat_cite_id: hC,
          verdict_marche: vM, verdict_cite: vC, justification: justif.trim() || null, kind, methode,
          prompt: methode === 'ia' && Object.keys(promptClean).length ? promptClean : null,
          ia: methode === 'ia' ? aiSuggestion : null,
        })
      }} className="px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
        {saving ? 'Enregistrement…' : 'Enregistrer le portrait'}
      </button>
    </div>
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

const modeOf = (arr: string[]) => { if (!arr.length) return undefined; const c: Record<string, number> = {}; arr.forEach((v) => (c[v] = (c[v] || 0) + 1)); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] }
const avgOf = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : undefined
const verdictLabel = (v: number) => VERDICTS.find((x) => x.value === v)?.label ?? '—'
const oqLabel = (id: string) => OPEN_QUESTIONS.find((q) => q.id === id)?.label ?? id

function Miroir({ etres, portraits }: { etres: { key: string; label: string }[]; portraits: Portrait[] }) {
  const cards = etres.map((e) => {
    const all = portraits.filter((p) => p.etre_key === e.key)
    if (!all.length) return null
    return <EtreCard key={e.key} label={e.label} all={all} />
  }).filter(Boolean)

  return (
    <div>
      {cards.length === 0
        ? <Info>Aucun portrait pour l&apos;instant. Allez dans « Peindre » pour commencer.</Info>
        : <div className="grid md:grid-cols-2 gap-4 items-start">{cards}</div>}
    </div>
  )
}

function EtreCard({ label, all }: { label: string; all: Portrait[] }) {
  const [open, setOpen] = useState(false)
  const het = all.filter((p) => p.kind === 'individuel'); const auto = all.find((p) => p.kind === 'auto')
  const vmM = avgOf(het.map((p) => p.verdict_marche)); const vcM = avgOf(het.map((p) => p.verdict_cite))
  const ecartC = auto && vcM !== undefined ? Math.abs(auto.verdict_cite - vcM) : 0
  const ecartM = auto && vmM !== undefined ? Math.abs(auto.verdict_marche - vmM) : 0
  const ecart = ecartC >= 1 || ecartM >= 1
  const esp = especeById(modeOf(het.map((p) => p.espece_id)) ?? '')

  return (
    <div className="rounded-xl border p-4" style={card}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>{het.length} regard(s){auto ? ' + 1 auto-portrait' : ''}</div>
      <div className="mb-2" style={{ color: 'var(--text)' }}>{esp ? `${esp.emoji} ${esp.nom}` : '—'}</div>
      <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div>marché : {(() => { const h = habitatById(modeOf(het.map((p) => p.habitat_marche_id)) ?? ''); return h ? h.emoji : '' })()} <Gauge value={vmM} /></div>
        <div>cité : {(() => { const h = habitatById(modeOf(het.map((p) => p.habitat_cite_id)) ?? ''); return h ? h.emoji : '' })()} <Gauge value={vcM} /></div>
      </div>
      {auto && (
        <div className="text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Auto : marché <Gauge value={auto.verdict_marche} /> · cité <Gauge value={auto.verdict_cite} />
          {ecart && <span className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f6e7df', color: '#a85b3b' }}>écart de perception</span>}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="mt-3 text-xs underline" style={{ color: 'var(--accent)' }}>
        {open ? 'Masquer le détail' : `Ouvrir le miroir — voir les ${all.length} regard(s)`}
      </button>
      {open && (
        <div className="mt-3 space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {all.map((p, i) => <PortraitDetail key={p.id} p={p} index={i} />)}
        </div>
      )}
    </div>
  )
}

function PortraitDetail({ p, index }: { p: Portrait; index: number }) {
  const esp = especeById(p.espece_id); const hM = habitatById(p.habitat_marche_id); const hC = habitatById(p.habitat_cite_id)
  const isIa = p.methode === 'ia'
  const sect = p.ia?.secteur
  return (
    <div className="rounded-lg border p-3 text-xs space-y-1.5" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          {p.kind === 'auto' ? 'Auto-portrait' : `Regard ${index + 1}`}
        </span>
        <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-subtle)' }}>
          {isIa ? '🤖 Automatique (IA)' : '✋ Manuel'}
        </span>
      </div>
      <div style={{ color: 'var(--text)' }}>{esp ? `${esp.emoji} ${esp.nom}` : '—'}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        Marché : {hM ? `${hM.emoji} ${hM.nom}` : '—'} · <i>{verdictLabel(p.verdict_marche)}</i><br />
        Cité : {hC ? `${hC.emoji} ${hC.nom}` : '—'} · <i>{verdictLabel(p.verdict_cite)}</i>
      </div>
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
          <div className="font-semibold mb-0.5" style={{ color: 'var(--text)' }}>🤖 Réponse de l&apos;IA — profil sectoriel{sect.nom ? ` (${sect.nom})` : ''}</div>
          {sect.attractivite && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Attractivité :</b> {sect.attractivite}</div>}
          {sect.forces?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Forces :</b> {sect.forces.join(' · ')}</div> : null}
          {sect.faiblesses?.length ? <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Faiblesses :</b> {sect.faiblesses.join(' · ')}</div> : null}
          {sect.turnover && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Turnover :</b> {sect.turnover}</div>}
          {sect.stress_burnout && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Stress / burn-out :</b> {sect.stress_burnout}</div>}
          {sect.remuneration && <div style={{ color: 'var(--text-muted)' }}><b style={{ color: 'var(--text)' }}>Rémunération :</b> {sect.remuneration}</div>}
        </div>
      )}
    </div>
  )
}
