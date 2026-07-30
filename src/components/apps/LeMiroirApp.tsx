'use client'

// Le Miroir v2 — aligné sur la Méthode d'accompagnement Sens'ethO v0.6.
// Phases : collecte (chacun peint, personne ne lit) → restitution (écarts,
// adéquation, image cible, 3 engagements observables, indicateurs).
// Cascade : entreprise (2 animaux : marché + cité) · services · postes
// d'encadrement (le poste, jamais la personne) · parties prenantes.

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { LeMiroirPdfData, PdfEtreAgg, PdfPortraitMilieu } from '@/components/apps/LeMiroirPDFReport'
import type { RseContext } from '@/components/rse/RseAppShell'
import {
  ESPECES, VERDICTS, OPEN_QUESTIONS,
  especeById, habitatById, relationById, PP_COTES, CONTRAT_REGLES, SEUIL_RESTITUTION,
  ETRE_KIND_LABELS, type EtreKind,
} from '@/lib/leMiroir'
import { Observer, SecteurBox, Gauge, type AiSuggestion, type Etre } from '@/components/apps/LeMiroirObserver'

// ─── Types ────────────────────────────────────────────────────────────────────


interface Portrait {
  id: string; user_id: string; etre_key: string; etre_label: string
  espece_id: string; espece_cite_id: string | null
  habitat_marche_id: string | null; habitat_cite_id: string | null
  verdict_marche: number | null; verdict_cite: number | null
  milieu_libre: string | null; relation: string | null
  signaux: string | null; dedicace: string | null
  justification: string | null; kind: 'individuel' | 'auto'; participant_id?: string | null
  methode?: 'manuel' | 'ia' | null; prompt?: Record<string, string> | null; ia?: AiSuggestion | null
}
interface ImageCible { espece_id?: string; note?: string }
interface Campagne { id: string; owner_id: string; annee: number; nom: string | null; statut: 'collecte' | 'restitution'; image_cible: ImageCible | null; socle: Socle | null; date_cloture_prevue: string | null }
interface Socle { etres?: string[]; son_service?: boolean }
interface Participant { id: string; user_id?: string | null; nom?: string | null; poste: string | null; service: string | null; regles_acceptees?: boolean; cellule_id?: string | null; is_externe?: boolean }
interface EtreDecl { id: string; kind: 'poste' | 'partie_prenante'; label: string; cote: 'marche' | 'cite' | 'groupe' | null }
interface Engagement { id: string; qui: string; quoi: string; echeance: string | null; comportement: string; statut: 'en_cours' | 'constate' | 'abandonne' }
interface PrevYear { especeMarche?: string; especeCite?: string; imageCible?: ImageCible | null }

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const LeMiroirPDFReport = dynamic(() => import('@/components/apps/LeMiroirPDFReport'), { ssr: false })

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
  const [cellules, setCellules] = useState<Cellule[]>([])
  const [showPilotage, setShowPilotage] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [pdfData, setPdfData] = useState<LeMiroirPdfData | null>(null)

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
    const [{ data: parts }, { data: ports }, { data: mine }, { data: decl }, { data: engs }, { data: prevCamp }, { data: cells }] = await Promise.all([
      supabase.from('le_miroir_participants').select('id,user_id,nom,poste,service,regles_acceptees,cellule_id,is_externe').eq('campagne_id', camp.id),
      supabase.from('le_miroir_portraits').select('*').eq('campagne_id', camp.id),
      supabase.from('le_miroir_participants').select('id,nom,poste,service,regles_acceptees,cellule_id,is_externe').eq('campagne_id', camp.id).eq('user_id', uid).maybeSingle(),
      supabase.from('le_miroir_etres').select('id,kind,label,cote').eq('campagne_id', camp.id).order('created_at'),
      supabase.from('le_miroir_engagements').select('id,qui,quoi,echeance,comportement,statut').eq('campagne_id', camp.id).order('created_at'),
      supabase.from('le_miroir_campagnes').select('id,image_cible').eq('org_id', orgId).eq('annee', year - 1).limit(1).maybeSingle(),
      supabase.from('le_miroir_cellules').select('id,nom,perimetre').eq('campagne_id', camp.id).order('created_at'),
    ])
    setParticipants((parts as Participant[]) ?? [])
    setPortraits((ports as Portrait[]) ?? [])
    setParticipant((mine as Participant) ?? null)
    setEtresDecl((decl as EtreDecl[]) ?? [])
    setEngagements((engs as Engagement[]) ?? [])
    setCellules((cells as Cellule[]) ?? [])
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

  // ─── Exports exhaustifs (artefacts de restitution — seuil respecté) ─────────

  async function handleExportExcel() {
    if (!campagne || exportingExcel) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/le-miroir/${campagne.id}/export-excel`)
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error || 'Échec export') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `LeMiroir_${orgName.replace(/[^a-z0-9]/gi, '_')}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): LeMiroirPdfData {
    const espLbl = (id: string | null | undefined) => { const e = id ? especeById(id) : null; return e ? `${e.emoji} ${e.nom}` : null }
    const habLbl = (id: string | null | undefined) => { const h = id ? habitatById(id) : null; return h ? `${h.emoji} ${h.nom}` : null }
    const regardsDe = (key: string) => portraits.filter((p) => p.etre_key === key && p.kind === 'individuel')
    const nDe = (key: string) => new Set(regardsDe(key).map((p) => p.user_id)).size

    const het = regardsDe('entreprise')
    const auto = portraits.find((p) => p.etre_key === 'entreprise' && p.kind === 'auto')
    const espM = modeOf(het.map((p) => p.espece_id))
    const espC = modeOf(het.map((p) => p.espece_cite_id || p.espece_id))
    const vM = avgOf(het.map((p) => p.verdict_marche || 0).filter(Boolean))
    const vC = avgOf(het.map((p) => p.verdict_cite || 0).filter(Boolean))
    const milieu = (esp: string | undefined, hab: string | undefined, v: number | undefined, dirEsp: string | null | undefined, dirV: number | null | undefined): PdfPortraitMilieu => ({
      especeLabel: espLbl(esp), habitatLabel: habLbl(hab), verdict: v ?? null,
      dirigeantEspeceLabel: espLbl(dirEsp), dirigeantVerdict: dirV ?? null,
      ecartEspece: Boolean(auto && esp && dirEsp && dirEsp !== esp),
      ecartVerdict: Boolean(auto && v !== undefined && dirV && Math.abs(dirV - v) >= 1),
    })

    const verdictTitre: Record<EtreKind, string> = {
      entreprise: 'Adéquation',
      service: "L'animal du service sert-il l'animal de l'entreprise ?",
      poste: 'Fonctionnement adapté — et poste viable ?',
      partie_prenante: 'La relation est-elle viable pour les deux ?',
    }
    const agg = (e: Etre): PdfEtreAgg => {
      const regs = regardsDe(e.key)
      const n = nDe(e.key)
      const sousSeuil = n < SEUIL_RESTITUTION
      const rel = relationById(modeOf(regs.map((p) => p.relation || '').filter(Boolean)) ?? '')
      return {
        label: e.label, nRegards: n, sousSeuil,
        especeLabel: sousSeuil ? null : espLbl(modeOf(regs.map((p) => p.espece_id))),
        relationLabel: sousSeuil || !rel ? null : `${rel.emoji} ${rel.nom}`,
        verdict: sousSeuil ? null : (avgOf(regs.map((p) => p.verdict_marche || 0).filter(Boolean)) ?? null),
        verdictTitre: verdictTitre[e.kind],
        milieux: sousSeuil ? [] : (regs.map((p) => p.milieu_libre).filter(Boolean) as string[]),
        signaux: sousSeuil ? [] : (regs.map((p) => p.signaux).filter(Boolean) as string[]),
        justifications: sousSeuil ? [] : (regs.map((p) => p.justification).filter(Boolean) as string[]),
      }
    }
    const peints = (kind: EtreKind) => etres.filter((e) => e.kind === kind && portraits.some((p) => p.etre_key === e.key))

    const acceptes = participants.filter((p) => p.regles_acceptees !== false).length
    const etresPeints = etres.filter((e) => portraits.some((p) => p.etre_key === e.key))
    const restituables = etresPeints.filter((e) => nDe(e.key) >= SEUIL_RESTITUTION)
    const ecartDirigeant = !auto ? '—' : (() => {
      const dM = espM && auto.espece_id !== espM
      const dC = espC && (auto.espece_cite_id || auto.espece_id) !== espC
      if (dM && dC) return 'Écart sur les deux milieux'
      if (dM) return 'Écart sur le marché'
      if (dC) return 'Écart sur la cité'
      return "Aligné (même famille d'image)"
    })()
    const constates = engagements.filter((e) => e.statut === 'constate').length
    const cibleEsp = especeById(campagne?.image_cible?.espece_id ?? '')
    const statutLabels = { en_cours: 'En cours', constate: 'Comportement constaté ✓', abandonne: 'Abandonné' } as const

    return {
      organisation: orgName, year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      statutLabel: 'Restitution ouverte',
      entreprise: het.length || auto ? {
        nRegards: nDe('entreprise'), sousSeuil: nDe('entreprise') < SEUIL_RESTITUTION,
        marche: milieu(espM, modeOf(het.map((p) => p.habitat_marche_id || '').filter(Boolean)), vM, auto?.espece_id, auto?.verdict_marche),
        cite: milieu(espC, modeOf(het.map((p) => p.habitat_cite_id || '').filter(Boolean)), vC, auto?.espece_cite_id || auto?.espece_id, auto?.verdict_cite),
        paireDiff: Boolean(espM && espC && espM !== espC),
        dedicaces: het.map((p) => p.dedicace).filter(Boolean) as string[],
        signaux: het.map((p) => p.signaux).filter(Boolean) as string[],
      } : null,
      services: peints('service').map(agg),
      postes: peints('poste').map(agg),
      partiesPrenantes: peints('partie_prenante').map(agg),
      imageCible: campagne?.image_cible ? { especeLabel: cibleEsp ? `${cibleEsp.emoji} ${cibleEsp.nom}` : null, note: campagne.image_cible.note ?? null } : null,
      engagements: engagements.map((e) => ({ qui: e.qui, quoi: e.quoi, echeance: e.echeance, comportement: e.comportement, statutLabel: statutLabels[e.statut], constate: e.statut === 'constate' })),
      indicateurs: [
        { label: 'Participation', value: `${acceptes} participant(s) ayant accepté le contrat de règles` },
        { label: `Êtres restituables (seuil ≥ ${SEUIL_RESTITUTION})`, value: `${restituables.length} / ${etresPeints.length} êtres peints` },
        { label: 'Écart dirigeant ↔ équipes', value: ecartDirigeant },
        { label: 'Tenue des engagements', value: engagements.length ? `${constates} / ${engagements.length} comportement(s) constaté(s)` : 'Aucun engagement posé' },
      ],
      regles: CONTRAT_REGLES,
      seuil: SEUIL_RESTITUTION,
    }
  }

  async function handleExportPDF() {
    if (!campagne || exportingPDF) return
    setExportingPDF(true)
    try {
      const data = buildPdfData()
      const enginePromise = import('@/lib/pdf/exportReport')
      setPdfData(data)
      await new Promise<void>((resolve) => {
        if (document.querySelector('#le-miroir-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#le-miroir-pdf-root [data-pdf-page]')) { observer.disconnect(); resolve() }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => { observer.disconnect(); resolve() }, 4000)
      })
      // Laisser le navigateur peindre — repli setTimeout : les rAF sont gelées
      // quand la fenêtre est occultée/minimisée, la promesse ne doit pas y rester bloquée.
      await new Promise<void>((r) => {
        const t = setTimeout(r, 400)
        requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r() }))
      })
      const { exportReport } = await enginePromise
      const orgSlug = orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportReport('le-miroir-pdf-root', `LeMiroir-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[le-miroir/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <LeMiroirPDFReport id="le-miroir-pdf-root" data={pdfData} />
        </div>
      )}
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        {(['peindre', 'miroir', 'action'] as const).map((t) => (
          (t !== 'action' || !enCollecte) && (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm border" style={chipStyle(tab === t)}>
              {t === 'peindre' ? '🖌️ Peindre' : t === 'miroir' ? '🪞 Le miroir' : '🎯 Image cible & engagements'}
            </button>
          )
        ))}
        {isOwner && (
          <button onClick={() => setShowPilotage((v) => !v)} className="px-4 py-2 rounded-lg text-sm border" style={{ ...card, color: 'var(--text)' }}>
            ⚙️ Pilotage
          </button>
        )}
        {!enCollecte && (
          <>
            <button disabled={exportingPDF} onClick={handleExportPDF} title="Rapport PDF exhaustif de la restitution"
              className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50" style={{ ...card, color: 'var(--text)' }}>
              {exportingPDF ? '⏳ PDF…' : '⬇ PDF'}
            </button>
            <button disabled={exportingExcel} onClick={handleExportExcel} title="Export Excel exhaustif (5 onglets)"
              className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50" style={{ ...card, color: 'var(--text)' }}>
              {exportingExcel ? '⏳ Excel…' : '⬇ Excel'}
            </button>
          </>
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

      {isOwner && showPilotage && (
        <PilotagePanel campagne={campagne} etres={etres} etresDecl={etresDecl} participants={participants}
          portraits={portraits} cellules={cellules} socle={campagne.socle} supabase={supabase}
          onChange={loadAll} myAutoDone={myAutoEntreprise} />
      )}

      {tab === 'peindre' && (enCollecte
        ? <Observer etres={etres} isOwner={isOwner} myAutoDone={myAutoEntreprise} onSave={async (p) => {
            await supabase.from('le_miroir_portraits').insert({ campagne_id: campagne.id, user_id: userId, participant_id: participant.id, ...p })
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

// ─── Pilotage : le dossier de campagne du responsable ────────────────────────

interface Cellule { id: string; nom: string; perimetre: string | null }
interface Invitation {
  id: string; token: string; label: string | null; email: string | null; kind: 'interne' | 'externe'
  cote: string | null; cellule_id: string | null; participant_id: string | null
  revoked: boolean; used_at: string | null; sent_at: string | null; sent_count?: number
}

/** Compte les regards distincts sur un être (participant si connu, sinon compte). */
const auteurDe = (p: Portrait) => p.participant_id ?? p.user_id ?? p.id
const regardsSur = (portraits: Portrait[], key: string) =>
  new Set(portraits.filter((p) => p.etre_key === key && p.kind === 'individuel').map(auteurDe)).size

function PilotagePanel({
  campagne, etres, etresDecl, participants, portraits, cellules, socle,
  supabase, onChange, myAutoDone,
}: {
  campagne: Campagne; etres: Etre[]; etresDecl: EtreDecl[]
  participants: Participant[]; portraits: Portrait[]; cellules: Cellule[]
  socle: { etres?: string[]; son_service?: boolean } | null
  supabase: SupabaseClient; onChange: () => void; myAutoDone: boolean
}) {
  const [vue, setVue] = useState<'ensemble' | 'cellules' | 'cascade' | 'liens'>('ensemble')
  const onglets = [
    { k: 'ensemble', l: '📊 Vue d’ensemble' },
    { k: 'cellules', l: '👥 Cellules & participants' },
    { k: 'cascade', l: '🧬 Cascade & socle' },
    { k: 'liens', l: '🔗 Liens d’invitation' },
  ] as const

  return (
    <div className="rounded-2xl border p-4 mb-5" style={card}>
      <div className="flex flex-wrap gap-2 mb-4">
        {onglets.map((o) => (
          <button key={o.k} onClick={() => setVue(o.k)} className="px-3 py-1.5 rounded-lg border text-sm" style={chipStyle(vue === o.k)}>
            {o.l}
          </button>
        ))}
      </div>
      {vue === 'ensemble' && <VueEnsemble campagne={campagne} etres={etres} participants={participants} portraits={portraits} cellules={cellules} socle={socle} myAutoDone={myAutoDone} supabase={supabase} onChange={onChange} />}
      {vue === 'cellules' && <VueCellules campagneId={campagne.id} cellules={cellules} participants={participants} portraits={portraits} supabase={supabase} onChange={onChange} />}
      {vue === 'cascade' && <VueCascade campagne={campagne} etres={etres} etresDecl={etresDecl} portraits={portraits} socle={socle} supabase={supabase} onChange={onChange} />}
      {vue === 'liens' && (
        <div className="space-y-4">
          <VueLiens campagneId={campagne.id} cellules={cellules} participants={participants} />
          <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <ShareManager campagneId={campagne.id} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── 1. Vue d'ensemble ────────────────────────────────────────────────────────

function VueEnsemble({ campagne, etres, participants, portraits, cellules, socle, myAutoDone, supabase, onChange }: {
  campagne: Campagne; etres: Etre[]; participants: Participant[]; portraits: Portrait[]
  cellules: Cellule[]; socle: { etres?: string[]; son_service?: boolean } | null
  myAutoDone: boolean; supabase: SupabaseClient; onChange: () => void
}) {
  const acceptes = participants.filter((p) => p.regles_acceptees !== false).length
  const ontPeint = new Set(portraits.map(auteurDe)).size
  const socleKeys = socle?.etres ?? []
  const etresPeints = etres.filter((e) => portraits.some((p) => p.etre_key === e.key))
  const restituables = etresPeints.filter((e) => regardsSur(portraits, e.key) >= SEUIL_RESTITUTION)
  const [date, setDate] = useState(campagne.date_cloture_prevue ?? '')

  // Ce qui bloque la clôture
  const blocages: string[] = []
  if (!myAutoDone) blocages.push("Votre portrait de référence de l'entreprise n'est pas fait (jalon de la phase 1).")
  const socleSousSeuil = socleKeys.filter((k) => regardsSur(portraits, k) < SEUIL_RESTITUTION)
  if (socleSousSeuil.length) {
    blocages.push(`${socleSousSeuil.length} être(s) du socle sous le seuil de ${SEUIL_RESTITUTION} regards — ils ne seront pas restitués.`)
  }
  const cellulesFaibles = cellules.filter((c) => participants.filter((p) => p.cellule_id === c.id).length < SEUIL_RESTITUTION)
  if (cellulesFaibles.length) {
    blocages.push(`${cellulesFaibles.length} cellule(s) à moins de ${SEUIL_RESTITUTION} membres : fusionner, compléter, ou basculer en entretiens individuels (variante « petite structure »).`)
  }
  if (!participants.length) blocages.push('Aucun participant : créez des cellules et envoyez des liens d’invitation.')
  else if (!restituables.length) {
    blocages.push(`Aucun être n'atteint ${SEUIL_RESTITUTION} regards : la restitution serait vide. Invitez d'autres participants, ou passez en entretiens individuels agrégés (variante « petite structure »).`)
  }

  async function majDate(v: string) {
    setDate(v)
    await supabase.from('le_miroir_campagnes').update({ date_cloture_prevue: v || null }).eq('id', campagne.id)
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Chiffre v={participants.length} l="participants" s={`${acceptes} ont accepté le contrat`} />
        <Chiffre v={ontPeint} l="ont peint" s={`${portraits.length} portraits au total`} />
        <Chiffre v={cellules.length} l="cellules" s={`${cellulesFaibles.length} sous ${SEUIL_RESTITUTION} membres`} />
        <Chiffre v={`${restituables.length}/${etresPeints.length}`} l="êtres restituables" s={`seuil ≥ ${SEUIL_RESTITUTION} regards`} />
      </div>

      <div>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Où en est chaque être ?</div>
        <div className="space-y-1.5">
          {etres.map((e) => {
            const n = regardsSur(portraits, e.key)
            const ok = n >= SEUIL_RESTITUTION
            const auSocle = socleKeys.includes(e.key)
            return (
              <div key={e.key} className="flex items-center gap-2 text-sm">
                <span className="w-56 truncate" style={{ color: 'var(--text)' }}>
                  {auSocle && <span title="Au socle imposé" style={{ color: 'var(--accent)' }}>★ </span>}{e.label}
                </span>
                <span className="text-xs w-20" style={{ color: 'var(--text-subtle)' }}>{ETRE_KIND_LABELS[e.kind]}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                  <div className="h-2 rounded-full" style={{
                    width: `${Math.min(100, (n / SEUIL_RESTITUTION) * 100)}%`,
                    backgroundColor: ok ? 'var(--accent)' : '#c9a227',
                  }} />
                </div>
                <span className="text-xs w-24 text-right" style={{ color: ok ? 'var(--accent)' : '#a85b3b' }}>
                  {n}/{SEUIL_RESTITUTION} {ok ? '✓' : '🔒'}
                </span>
              </div>
            )
          })}
          {!etres.length && <Vide>Aucun être : ajoutez des postes et des parties prenantes dans « Cascade & socle ».</Vide>}
        </div>
      </div>

      <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
          {blocages.length ? '⚠️ Avant de clore la collecte' : '✓ Prêt à clore la collecte'}
        </div>
        {blocages.length
          ? <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>{blocages.map((b, i) => <li key={i}>• {b}</li>)}</ul>
          : <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Les jalons de la phase 1 sont franchis. La restitution ouvrira le miroir à tous les participants.</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span style={{ color: 'var(--text-subtle)' }}>Clôture prévue le</span>
          <input type="date" value={date} onChange={(e) => majDate(e.target.value)}
            className="px-2 py-1 rounded-lg border bg-transparent text-sm" style={card} />
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>(fenêtre courte recommandée : 10 jours ouvrés)</span>
        </div>
      </div>
    </div>
  )
}

function Chiffre({ v, l, s }: { v: React.ReactNode; l: string; s?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{v}</div>
      <div className="text-sm" style={{ color: 'var(--text)' }}>{l}</div>
      {s && <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s}</div>}
    </div>
  )
}
function Vide({ children }: { children: React.ReactNode }) {
  return <div className="text-sm italic" style={{ color: 'var(--text-subtle)' }}>{children}</div>
}

// ── 2. Cellules & participants ───────────────────────────────────────────────

function VueCellules({ campagneId, cellules, participants, portraits, supabase, onChange }: {
  campagneId: string; cellules: Cellule[]; participants: Participant[]; portraits: Portrait[]
  supabase: SupabaseClient; onChange: () => void
}) {
  const [nom, setNom] = useState(''); const [perimetre, setPerimetre] = useState('')

  async function creer() {
    if (!nom.trim()) return
    await supabase.from('le_miroir_cellules').insert({ campagne_id: campagneId, nom: nom.trim(), perimetre: perimetre.trim() || null })
    setNom(''); setPerimetre(''); onChange()
  }
  async function supprimer(id: string) {
    await supabase.from('le_miroir_cellules').delete().eq('id', id); onChange()
  }
  async function affecter(participantId: string, celluleId: string | null) {
    await supabase.from('le_miroir_participants').update({ cellule_id: celluleId }).eq('id', participantId); onChange()
  }

  const sansCellule = participants.filter((p) => !p.cellule_id)

  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        La cellule est l&apos;unité d&apos;observation de la méthode : <b>4 observateurs minimum</b>, un <b>point de vue commun</b>
        (même service, même site, même métier), et <b>pas de lien hiérarchique direct</b> — les encadrants forment leurs propres cellules.
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la cellule (ex : Atelier 1)"
          className="px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        <input value={perimetre} onChange={(e) => setPerimetre(e.target.value)} placeholder="Périmètre (ex : production, site de Lyon)"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        <button onClick={creer} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Créer la cellule</button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {cellules.map((c) => {
          const membres = participants.filter((p) => p.cellule_id === c.id)
          const peints = membres.filter((m) => portraits.some((p) => auteurDe(p) === m.id)).length
          const faible = membres.length < SEUIL_RESTITUTION
          return (
            <div key={c.id} className="rounded-xl border p-3" style={{ backgroundColor: 'var(--bg)', borderColor: faible ? '#c9a227' : 'var(--border)' }}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{c.nom}</div>
                  {c.perimetre && <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{c.perimetre}</div>}
                </div>
                <button onClick={() => supprimer(c.id)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>suppr.</button>
              </div>
              <div className="text-xs mt-1.5 mb-2" style={{ color: faible ? '#a85b3b' : 'var(--accent)' }}>
                {membres.length} membre(s) {faible ? `· sous le seuil de ${SEUIL_RESTITUTION}` : '✓'} · {peints} ont peint
              </div>
              <ul className="text-sm space-y-1">
                {membres.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>
                      {m.nom || m.poste || 'Participant'}{m.service ? ` · ${m.service}` : ''}
                      {m.is_externe && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}> (externe)</span>}
                    </span>
                    <button onClick={() => affecter(m.id, null)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>retirer</button>
                  </li>
                ))}
                {!membres.length && <li className="text-xs italic" style={{ color: 'var(--text-subtle)' }}>Aucun membre.</li>}
              </ul>
            </div>
          )
        })}
        {!cellules.length && <Vide>Aucune cellule. Créez-en une pour organiser les regards.</Vide>}
      </div>

      <div>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Participants sans cellule ({sansCellule.length})</div>
        <div className="space-y-1.5">
          {sansCellule.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-[160px]" style={{ color: 'var(--text)' }}>
                {p.nom || p.poste || 'Participant'}{p.service ? ` · ${p.service}` : ''}
                {p.regles_acceptees === false && <span className="text-xs" style={{ color: '#a85b3b' }}> · contrat non accepté</span>}
              </span>
              <select defaultValue="" onChange={(e) => e.target.value && affecter(p.id, e.target.value)}
                className="px-2 py-1 rounded-lg border bg-transparent text-xs" style={card}>
                <option value="">— affecter à une cellule —</option>
                {cellules.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          ))}
          {!sansCellule.length && <Vide>Tous les participants sont affectés.</Vide>}
        </div>
      </div>
    </div>
  )
}

// ── 3. Cascade & socle ───────────────────────────────────────────────────────

function VueCascade({ campagne, etres, etresDecl, portraits, socle, supabase, onChange }: {
  campagne: Campagne; etres: Etre[]; etresDecl: EtreDecl[]; portraits: Portrait[]
  socle: { etres?: string[]; son_service?: boolean } | null
  supabase: SupabaseClient; onChange: () => void
}) {
  const [kind, setKind] = useState<'poste' | 'partie_prenante'>('poste')
  const [label, setLabel] = useState('')
  const [cote, setCote] = useState<string>('marche')
  const socleKeys = socle?.etres ?? []
  const sonService = socle?.son_service ?? true

  async function ajouter() {
    if (!label.trim()) return
    await supabase.from('le_miroir_etres').insert({
      campagne_id: campagne.id, kind, label: label.trim(), cote: kind === 'partie_prenante' ? cote : null,
    })
    setLabel(''); onChange()
  }
  async function retirer(id: string) {
    await supabase.from('le_miroir_etres').delete().eq('id', id); onChange()
  }
  async function majSocle(etresList: string[], service: boolean) {
    await supabase.from('le_miroir_campagnes').update({ socle: { etres: etresList, son_service: service } }).eq('id', campagne.id)
    onChange()
  }
  const basculer = (key: string) => {
    const s = new Set(socleKeys)
    if (s.has(key)) s.delete(key); else s.add(key)
    majSocle(Array.from(s), sonService)
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Le socle imposé</div>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          Ce que chaque participant doit peindre — le reste de la cascade lui reste ouvert. C&apos;est ce qui garantit
          d&apos;atteindre le seuil de {SEUIL_RESTITUTION} regards sur l&apos;essentiel.
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {etres.map((e) => (
            <button key={e.key} onClick={() => basculer(e.key)} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(socleKeys.includes(e.key))}>
              {socleKeys.includes(e.key) ? '★ ' : ''}{e.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
          <input type="checkbox" checked={sonService} onChange={(e) => majSocle(socleKeys, e.target.checked)} />
          <span>Chacun doit aussi peindre <b>son propre service</b></span>
        </label>
      </div>

      <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Postes d&apos;encadrement et parties prenantes</div>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          Les services se déduisent des participants. Ajoutez ici les <b>postes</b> (le poste, jamais la personne) et les
          <b> parties prenantes</b> (clients, fournisseurs, maison mère, syndicats, chercheurs d&apos;emploi…).
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
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
          <button onClick={ajouter} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>Ajouter</button>
        </div>
        <ul className="text-sm space-y-1">
          {etresDecl.map((e) => {
            const key = (e.kind === 'poste' ? 'poste:' : 'pp:') + e.id
            const n = regardsSur(portraits, key)
            return (
              <li key={e.id} className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-subtle)' }}>
                  {e.kind === 'poste' ? 'poste' : PP_COTES.find((c) => c.id === e.cote)?.label ?? 'partie prenante'}
                </span>
                <span className="flex-1" style={{ color: 'var(--text)' }}>{e.label}</span>
                <span className="text-xs" style={{ color: n >= SEUIL_RESTITUTION ? 'var(--accent)' : 'var(--text-subtle)' }}>{n}/{SEUIL_RESTITUTION}</span>
                <button onClick={() => retirer(e.id)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>retirer</button>
              </li>
            )
          })}
          {!etresDecl.length && <Vide>Aucun poste ni partie prenante déclarés.</Vide>}
        </ul>
      </div>
    </div>
  )
}

// ── 4. Liens d'invitation ────────────────────────────────────────────────────

function VueLiens({ campagneId, cellules, participants }: { campagneId: string; cellules: Cellule[]; participants: Participant[] }) {
  const [liste, setListe] = useState<Invitation[]>([])
  const [nombre, setNombre] = useState(4)
  const [celluleId, setCelluleId] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<'interne' | 'externe'>('interne')
  const [cote, setCote] = useState('marche')
  const [emails, setEmails] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [rapport, setRapport] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copie, setCopie] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const r = await fetch(`/api/le-miroir/${campagneId}/invitations`)
    const d = await r.json(); if (r.ok) setListe((d.data as Invitation[]) ?? [])
  }, [campagneId])
  useEffect(() => { charger() }, [charger])

  const lien = (t: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/miroir/${t}`

  const adresses = emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))

  async function creer() {
    setBusy(true); setRapport(null)
    await fetch(`/api/le-miroir/${campagneId}/invitations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: adresses.length ? adresses : undefined,
        nombre, cellule_id: celluleId || null, label: label.trim() || null, kind, cote,
      }),
    })
    setBusy(false); setLabel(''); setEmails(''); charger()
  }

  /** Envoi par Microsoft Graph — corps du message figé côté serveur. */
  async function envoyer(ids?: string[]) {
    setEnvoi(true); setRapport(null)
    const r = await fetch(`/api/le-miroir/${campagneId}/invitations/envoyer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { invitation_ids: ids } : {}),
    })
    const d = await r.json()
    setEnvoi(false)
    setRapport(r.ok
      ? `✓ ${d.envoyes} invitation(s) envoyée(s)${d.echecs?.length ? ` · ${d.echecs.length} échec(s) : ${d.echecs.map((e: {email: string}) => e.email).join(', ')}` : ''}`
      : (d.error || 'Échec de l’envoi.'))
    charger()
  }
  async function revoquer(id: string) {
    await fetch(`/api/le-miroir/${campagneId}/invitations?invitation_id=${id}`, { method: 'DELETE' }); charger()
  }
  async function copier(txt: string, id: string) {
    try { await navigator.clipboard.writeText(txt); setCopie(id); setTimeout(() => setCopie(null), 1800) } catch { /* presse-papier indisponible */ }
  }
  const actifs = liste.filter((i) => !i.revoked)
  const aEnvoyer = actifs.filter((i) => i.email && !i.sent_at)
  async function copierTous() {
    const txt = actifs.map((i) => `${i.label ?? 'Participant'} : ${lien(i.token)}`).join('\n')
    copier(txt, 'tous')
  }

  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Un lien par personne, <b>sans création de compte</b> : chacun accepte le contrat de règles, se déclare, puis peint.
        C&apos;est la voie normale en mission (personne ne crée 40 comptes) et la seule pour les <b>parties prenantes externes</b>{' '}
        (clients, fournisseurs, candidats). Un lien est un secret : ne le diffusez pas en liste publique. L&apos;envoi par Microsoft&nbsp;365 utilise un message <b>figé</b> (invitation seule, sans image ni pixel de suivi) : cette fonction ne peut pas servir à un envoi commercial.
      </div>

      <div className="rounded-xl border p-3 space-y-2" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap gap-2 items-center">
          {(['interne', 'externe'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="px-3 py-1.5 rounded-lg border text-xs" style={chipStyle(kind === k)}>
              {k === 'interne' ? 'Participants internes' : 'Parties prenantes externes'}
            </button>
          ))}
          {kind === 'externe' && PP_COTES.map((c) => (
            <button key={c.id} onClick={() => setCote(c.id)} title={c.exemples} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(cote === c.id)}>{c.label}</button>
          ))}
        </div>
        <div>
          <label className="block text-sm mb-0.5" style={{ color: 'var(--text)' }}>Adresses e-mail (une par ligne — optionnel)</label>
          <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>
            Renseignées, l&apos;app crée un lien par personne et peut les envoyer par Outlook (Microsoft&nbsp;365).
            Laissez vide pour générer des liens anonymes que vous distribuerez vous-même.
          </div>
          <textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)}
            placeholder={'marc.dupont@exemple.fr, sophie.martin@exemple.fr'}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
          {adresses.length > 0 && <div className="text-xs mt-1" style={{ color: 'var(--accent)' }}>{adresses.length} adresse(s) valide(s) détectée(s)</div>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm" style={{ color: 'var(--text)' }}>{adresses.length ? 'Liens' : 'Nombre'}</label>
          <input type="number" min={1} max={40} value={adresses.length || nombre} disabled={adresses.length > 0}
            onChange={(e) => setNombre(Number(e.target.value))}
            className="w-20 px-2 py-1.5 rounded-lg border bg-transparent text-sm disabled:opacity-50" style={card} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={adresses.length > 0}
            placeholder={adresses.length ? 'Accroche déduite de chaque adresse' : 'Libellé (ex : Atelier, Client)'}
            title={adresses.length ? "Avec des adresses, l'accroche « Bonjour … » est déduite de chaque adresse" : ''}
            className="px-3 py-1.5 rounded-lg border bg-transparent text-sm disabled:opacity-50" style={card} />
          {kind === 'interne' && (
            <select value={celluleId} onChange={(e) => setCelluleId(e.target.value)} className="px-2 py-1.5 rounded-lg border bg-transparent text-sm" style={card}>
              <option value="">— sans cellule —</option>
              {cellules.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          )}
          <button disabled={busy} onClick={creer} className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {busy ? '…' : 'Générer les liens'}
          </button>
        </div>
      </div>

      {actifs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{actifs.length} lien(s) actif(s)</div>
          <button onClick={copierTous} className="text-xs underline" style={{ color: 'var(--accent)' }}>
            {copie === 'tous' ? '✓ copiés' : 'copier toute la liste'}
          </button>
          {aEnvoyer.length > 0 && (
            <button disabled={envoi} onClick={() => envoyer()} className="px-3 py-1.5 rounded-lg text-white text-xs disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
              {envoi ? 'Envoi en cours…' : `✉ Envoyer les ${aEnvoyer.length} invitation(s) non envoyée(s)`}
            </button>
          )}
        </div>
      )}
      {rapport && <div className="text-sm" style={{ color: rapport.startsWith('✓') ? 'var(--accent)' : '#a85b3b' }}>{rapport}</div>}
      {envoi && <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Cadence lente volontaire (≈ 1 envoi par seconde) pour ne pas ressembler à un envoi de masse — patientez.</div>}
      <div className="space-y-1.5">
        {liste.map((i) => {
          const part = participants.find((p) => p.id === i.participant_id)
          return (
            <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm rounded-lg border p-2"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', opacity: i.revoked ? 0.5 : 1 }}>
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-subtle)' }}>
                {i.kind === 'externe' ? (PP_COTES.find((c) => c.id === i.cote)?.label ?? 'externe') : (cellules.find((c) => c.id === i.cellule_id)?.nom ?? 'interne')}
              </span>
              <span style={{ color: 'var(--text)' }}>{i.label ?? 'Participant'}</span>
              {i.email && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{i.email}</span>}
              <code className="text-xs px-2 py-0.5 rounded truncate max-w-[280px]" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-subtle)' }}>
                /miroir/{i.token.slice(0, 12)}…
              </code>
              {i.revoked
                ? <span className="text-xs" style={{ color: '#a85b3b' }}>révoqué</span>
                : <>
                    <button onClick={() => copier(lien(i.token), i.id)} className="text-xs underline" style={{ color: 'var(--accent)' }}>
                      {copie === i.id ? '✓ copié' : 'copier le lien'}
                    </button>
                    {i.email && (
                      <button disabled={envoi} onClick={() => envoyer([i.id])} className="text-xs underline disabled:opacity-50" style={{ color: 'var(--accent)' }}>
                        {i.sent_at ? 'renvoyer' : 'envoyer'}
                      </button>
                    )}
                    <button onClick={() => revoquer(i.id)} className="text-xs underline" style={{ color: 'var(--text-subtle)' }}>révoquer</button>
                  </>}
              <span className="ml-auto text-xs text-right" style={{ color: i.used_at ? 'var(--accent)' : 'var(--text-subtle)' }}>
                {i.used_at ? `utilisé${part?.nom ? ` — ${part.nom}` : ''}` : 'pas encore utilisé'}
                {i.sent_at && <><br /><span style={{ color: 'var(--text-subtle)' }}>envoyé{(i.sent_count ?? 0) > 1 ? ` ×${i.sent_count}` : ''}</span></>}
              </span>
            </div>
          )
        })}
        {!liste.length && <Vide>Aucun lien généré.</Vide>}
      </div>
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

function ActionPanel({ campagne, portraits, etres, engagements, participants, prev, isOwner, supabase, onChange }: {
  campagne: Campagne; portraits: Portrait[]; etres: Etre[]; engagements: Engagement[]
  participants: Participant[]; prev: PrevYear | null; isOwner: boolean; supabase: SupabaseClient; onChange: () => void
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
