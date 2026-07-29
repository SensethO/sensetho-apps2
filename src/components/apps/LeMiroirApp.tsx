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
  ESPECES, VERDICTS, QUIZ, OPEN_QUESTIONS, SECTEUR_DISCLAIMER,
  especeById, habitatById, habitatsPourMilieu, suggererEspeces,
  RELATIONS, relationById, PP_COTES, CONTRAT_REGLES, SEUIL_RESTITUTION,
  QUESTION_FILTRE_POSTE, SIGNAUX_HINT, DEDICACE_HINT, MILIEU_SERVICE_HINT, MILIEU_POSTE_HINT,
  ETRE_KIND_LABELS, type EtreKind,
} from '@/lib/leMiroir'
import { PLANCHES } from '@/lib/leMiroirPlanches'
import { PLANCHES_HABITATS } from '@/lib/leMiroirHabitats'

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
  const [showCadrage, setShowCadrage] = useState(false)
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
          <button onClick={() => setShowCadrage((v) => !v)} className="px-4 py-2 rounded-lg text-sm border" style={{ ...card, color: 'var(--text)' }}>
            ⚙️ Cadrage
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

function CadragePanel({ campagneId, etresDecl, onChange, supabase }: { campagneId: string; etresDecl: EtreDecl[]; onChange: () => void; supabase: SupabaseClient }) {
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

function EtresManager({ campagneId, etresDecl, onChange, supabase }: { campagneId: string; etresDecl: EtreDecl[]; onChange: () => void; supabase: SupabaseClient }) {
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

// ─── Peindre : parcours guidé pas à pas (façon formulaire), planches illustrées ──

interface NewPortrait {
  etre_key: string; etre_label: string; espece_id: string; espece_cite_id: string | null
  habitat_marche_id: string | null; habitat_cite_id: string | null
  verdict_marche: number | null; verdict_cite: number | null
  milieu_libre: string | null; relation: string | null; signaux: string | null; dedicace: string | null
  justification: string | null; kind: 'individuel' | 'auto'; methode: 'manuel' | 'ia'
  prompt: Record<string, string> | null; ia: AiSuggestion | null
}

const especeImg = (id: string) => `/bestiaire/${id}.jpg`

/** Fiche complète d'une espèce — la planche d'observation du Bestiaire :
 *  illustration + mode d'organisation, mécanisme, traduction, forces, vigilances, adéquation. */
function PlancheModal({ especeId, onClose, onChoose }: { especeId: string; onClose: () => void; onChoose?: (id: string) => void }) {
  const e = especeById(especeId)
  const p = PLANCHES[especeId]
  if (!e) return null
  const section = (icone: string, titre: string, texte: string) => (
    <div className="mb-3">
      <div className="text-xs font-bold tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>{icone} {titre.toUpperCase()}</div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{texte}</p>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl border max-w-2xl w-full max-h-[92vh] overflow-y-auto" style={card} onClick={(ev) => ev.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={especeImg(e.id)} alt={e.nom} className="w-full" style={{ maxHeight: '40vh', objectFit: 'cover', borderRadius: '1rem 1rem 0 0' }} />
        <div className="p-5">
          <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{e.emoji} {e.nom}</div>
          <div className="text-sm font-medium mb-3 pb-2 border-b" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>
            {p?.mode ?? e.trait}
          </div>
          {p ? (
            <>
              {section('🔬', 'Le mécanisme — dans la nature', p.meca)}
              {section('🏢', "La traduction — dans l'entreprise", p.traduction)}
              {section('💪', 'Forces', p.forces)}
              {section('⚠️', 'Vigilances', p.vigilances)}
              {section('🌿', 'Adéquation au milieu', p.adequation)}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{e.description}</p>
          )}
          <div className="flex gap-2 mt-4">
            {onChoose && (
              <button onClick={() => { onChoose(e.id); onClose() }} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                ✓ Choisir cette espèce
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm" style={{ ...card, color: 'var(--text)' }}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Galerie des 18 espèces : illustration + trait, sélection directe + accès à la planche. */
function EspeceGrid({ value, onChange, suggested, onPlanche }: {
  value: string; onChange: (v: string) => void; suggested?: Set<string>; onPlanche: (id: string) => void
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))' }}>
      {ESPECES.map((e) => (
        <div key={e.id} className="rounded-xl border overflow-hidden cursor-pointer transition-transform"
          style={value === e.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : card}
          onClick={() => onChange(e.id)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={especeImg(e.id)} alt={e.nom} loading="lazy" className="w-full" style={{ height: 110, objectFit: 'cover' }} />
          <div className="p-2">
            <div className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
              {value === e.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
              {e.emoji} {e.nom} {suggested?.has(e.id) && <span className="text-[10px]" style={{ color: 'var(--accent)' }}>★ suggéré</span>}
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{e.trait}</div>
            <button onClick={(ev) => { ev.stopPropagation(); onPlanche(e.id) }} className="text-xs underline" style={{ color: 'var(--accent)' }}>
              🔍 Voir la planche
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Aide au choix : le questionnaire comportemental (repliable). */
function QuizHelper({ answers, setAnswers, espece, setEspece }: {
  answers: Record<string, string[]>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  espece: string; setEspece: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const tags = Object.values(answers).flat()
  const suggestions = suggererEspeces(tags)
  const visibleQuiz = QUIZ.filter((q) => !q.showIf || q.showIf(tags))
  return (
    <div className="rounded-xl border mb-4" style={card}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
        🧭 Besoin d&apos;aide pour trouver l&apos;espèce ? {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="px-4 pb-4">
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
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Suggestions d&apos;après vos réponses :</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => { const e = especeById(s.id)!; return (
                  <button key={s.id} onClick={() => setEspece(s.id)} className="px-3 py-1.5 rounded-full border text-xs" style={chipStyle(espece === s.id)}>★ {e.emoji} {e.nom}</button>
                ) })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Fiche complète d'un milieu — la planche de milieu du Bestiaire :
 *  caractère, mécanisme (nature), traduction (entreprise), qui y prospère, qui y souffre, signaux. */
function HabitatModal({ habitatId, onClose, onChoose }: { habitatId: string; onClose: () => void; onChoose?: (id: string) => void }) {
  const h = habitatById(habitatId)
  const p = PLANCHES_HABITATS[habitatId]
  if (!h) return null
  const milieuLabel = h.milieu === 'les deux' ? 'Marché & Cité' : h.milieu === 'marché' ? 'Marché' : 'Cité'
  const section = (icone: string, titre: string, texte: string) => (
    <div className="mb-3">
      <div className="text-xs font-bold tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>{icone} {titre.toUpperCase()}</div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{texte}</p>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl border max-w-2xl w-full max-h-[92vh] overflow-y-auto" style={card} onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-center" style={{ height: 110, fontSize: 56, backgroundColor: 'var(--bg)', borderRadius: '1rem 1rem 0 0', borderBottom: '1px solid var(--border)' }}>
          {h.emoji}
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{h.nom}</div>
            <span className="px-2 py-0.5 rounded-full text-xs border" style={{ ...card, color: 'var(--text-subtle)' }}>{milieuLabel}</span>
          </div>
          <div className="text-sm font-medium mb-3 pb-2 border-b" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>
            {p?.caractere ?? h.sens}
          </div>
          {p ? (
            <>
              {section('🔬', 'Le milieu — dans la nature', p.meca)}
              {section('🏢', "Chez les humains, ça ressemble à…", p.traduction)}
              {section('🌱', 'Qui y prospère', p.prosperent)}
              {section('🥀', 'Qui y souffre', p.souffrent)}
              {section('📡', 'Les signaux du milieu (le reconnaître, le voir évoluer)', p.signaux)}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{h.description}</p>
          )}
          <div className="flex gap-2 mt-4">
            {onChoose && (
              <button onClick={() => { onChoose(h.id); onClose() }} className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: 'var(--accent)' }}>
                ✓ Choisir ce milieu
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm" style={{ ...card, color: 'var(--text)' }}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Choix d'habitat : cartes + accès à la planche de milieu + fiche du milieu sélectionné. */
function HabitatChoices({ milieu, value, onChange }: { milieu: 'marché' | 'cité'; value: string; onChange: (v: string) => void }) {
  const [planche, setPlanche] = useState<string | null>(null)
  const sel = value ? habitatById(value) : null
  const selPlanche = value ? PLANCHES_HABITATS[value] : null
  return (
    <div>
      {planche && <HabitatModal habitatId={planche} onClose={() => setPlanche(null)} onChoose={onChange} />}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
        {habitatsPourMilieu(milieu).map((h) => (
          <div key={h.id} className="text-left rounded-lg border p-2.5 cursor-pointer"
            style={value === h.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : card}
            onClick={() => onChange(h.id)}>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value === h.id && <span style={{ color: 'var(--accent)' }}>✓ </span>}{h.emoji} {h.nom}</div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{h.sens}</div>
            <button onClick={(ev) => { ev.stopPropagation(); setPlanche(h.id) }} className="text-xs underline" style={{ color: 'var(--accent)' }}>
              🔍 Voir la planche
            </button>
          </div>
        ))}
      </div>
      {sel && (
        <div className="rounded-lg border p-3 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{sel.emoji} {sel.nom} — </span>
          {selPlanche ? selPlanche.traduction : sel.description}
          {selPlanche && (
            <div className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
              🌱 <b>Y prospèrent :</b> {selPlanche.prosperent} · 🥀 <b>Y souffrent :</b> {selPlanche.souffrent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Échelle d'adéquation : liste verticale façon formulaire. */
function ScaleChoices({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2 max-w-md">
      {VERDICTS.map((v) => (
        <button key={v.value} onClick={() => onChange(v.value)} className="w-full text-left px-4 py-3 rounded-lg border text-sm flex items-center gap-3"
          style={value === v.value ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : card}>
          <span className="inline-block w-4 h-4 rounded-full border-2 flex-shrink-0"
            style={{ borderColor: value === v.value ? 'var(--accent)' : 'var(--border)', backgroundColor: value === v.value ? 'var(--accent)' : 'transparent' }} />
          <span style={{ color: 'var(--text)' }}>{v.label}</span>
        </button>
      ))}
    </div>
  )
}

interface WizStep { key: string; titre: string; sub?: string; optional?: boolean; valid: boolean }

function Observer({ etres, isOwner, myAutoDone, onSave }: { etres: Etre[]; isOwner: boolean; myAutoDone: boolean; onSave: (p: NewPortrait) => Promise<void> }) {
  // ── Réponses ──
  const [etreKey, setEtreKey] = useState<string>('')
  const etre = etres.find((x) => x.key === etreKey) ?? null
  const kind: EtreKind | null = etre?.kind ?? null
  const [regard, setRegard] = useState<'individuel' | 'auto'>('individuel')
  const [methode, setMethode] = useState<'manuel' | 'ia'>('manuel')
  const [espece, setEspece] = useState(''); const [especeCite, setEspeceCite] = useState('')
  const [hM, setHM] = useState(''); const [hC, setHC] = useState('')
  const [vM, setVM] = useState(0); const [vC, setVC] = useState(0)
  const [milieuLibre, setMilieuLibre] = useState(''); const [relation, setRelation] = useState('')
  const [signaux, setSignaux] = useState(''); const [dedicace, setDedicace] = useState(''); const [justif, setJustif] = useState('')
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [oa, setOa] = useState<Record<string, string>>({}); const [analysing, setAnalysing] = useState(false); const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [aiSecteur, setAiSecteur] = useState<AiSecteur | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  // ── Parcours ──
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [planche, setPlanche] = useState<string | null>(null)

  const tags = Object.values(answers).flat()
  const suggested = new Set(suggererEspeces(tags).map((s) => s.id))
  const etreLabel = etre?.label ?? 'cet être'

  function resetAll() {
    setEtreKey(''); setRegard('individuel'); setMethode('manuel')
    setEspece(''); setEspeceCite(''); setHM(''); setHC(''); setVM(0); setVC(0)
    setMilieuLibre(''); setRelation(''); setSignaux(''); setDedicace(''); setJustif('')
    setAnswers({}); setOa({}); setAiSecteur(null); setAiSuggestion(null); setAiMsg(null)
    setStep(0); setDone(false)
  }

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
      setAiMsg("✓ Proposition appliquée — les étapes suivantes sont pré-remplies, vous gardez la main pour ajuster.")
    } catch {
      setAiMsg("Erreur lors de l'analyse.")
    }
    setAnalysing(false)
  }

  // ── Définition des étapes selon l'être ──
  const steps: WizStep[] = [
    { key: 'etre', titre: 'Que peignez-vous ?', sub: "Chaque entité est un animal vivant dans un milieu. Choisissez l'être à décrire.", valid: Boolean(etreKey) },
  ]
  if (kind === 'entreprise') {
    if (methode === 'ia') steps.push({ key: 'ia', titre: "Décrire l'activité à l'IA", sub: "Quelques éléments suffisent ; l'IA propose les deux animaux et leurs habitats — vous ajusterez.", optional: true, valid: Boolean(aiSuggestion) })
    steps.push(
      { key: 'espM', titre: "L'animal du MARCHÉ", sub: "Sur son marché (concurrents, clients, cadence), quel animal est cette entreprise ? Ouvrez les planches pour comparer.", valid: Boolean(espece) },
      { key: 'habM', titre: 'Son habitat économique', sub: 'Dans quel milieu cet animal vit-il ?', valid: Boolean(hM) },
      { key: 'vM', titre: 'Est-il armé pour ce milieu ?', sub: "L'espèce est-elle adaptée à ce milieu, tel qu'il évolue ?", valid: vM > 0 },
      { key: 'espC', titre: "L'animal de la CITÉ", sub: "Regardée comme habitante de la société (territoire, emploi, ce qu'elle prélève et rend), ce peut être un animal totalement différent. C'est aussi sa marque employeur réelle : a-t-on envie de rejoindre sa colonie, sa meute, sa ruche ?", valid: Boolean(especeCite) },
      { key: 'habC', titre: 'Son habitat social', sub: 'Dans quel milieu de la cité cet animal vit-il ?', valid: Boolean(hC) },
      { key: 'vC', titre: 'Est-il un habitant viable — et attractif ?', sub: 'Quelles valeurs et quelle raison d’être renvoie-t-il ?', valid: vC > 0 },
      { key: 'signaux', titre: 'Les signaux', sub: SIGNAUX_HINT, optional: true, valid: true },
    )
    if (!isOwner || regard === 'individuel') {
      steps.push({ key: 'dedicace', titre: 'La dédicace (anonyme)', sub: DEDICACE_HINT, optional: true, valid: true })
    }
  } else if (kind === 'service' || kind === 'poste') {
    steps.push(
      { key: 'esp', titre: kind === 'poste' ? "L'animal du poste" : "L'animal du service", sub: kind === 'poste' ? QUESTION_FILTRE_POSTE : 'Quel animal est ce service, tel que vous l’observez ?', valid: Boolean(espece) },
      { key: 'milieu', titre: kind === 'poste' ? 'Son milieu : la fonction' : "Son milieu : sa place dans l'entreprise", sub: kind === 'poste' ? MILIEU_POSTE_HINT : MILIEU_SERVICE_HINT, valid: Boolean(milieuLibre.trim()) },
      { key: 'v', titre: kind === 'poste' ? 'Le poste est-il adapté — et viable ?' : "Sert-il l'animal de l'entreprise ?", sub: kind === 'poste' ? "L'inadéquation ne dit jamais « mauvais manager » : elle dit poste mal rencontré ou mal conçu." : undefined, valid: vM > 0 },
      { key: 'signaux', titre: 'Les signaux', sub: SIGNAUX_HINT, optional: true, valid: true },
    )
  } else if (kind === 'partie_prenante') {
    steps.push(
      { key: 'esp', titre: `L'animal : ${etreLabel}`, sub: 'Quel animal est cette partie prenante, vue depuis l’entreprise ?', valid: Boolean(espece) },
      { key: 'relation', titre: "La relation avec l'entreprise", sub: 'Qui nourrit qui, qui épuise qui ?', valid: Boolean(relation) },
      { key: 'v', titre: 'La relation est-elle viable pour les deux ?', valid: vM > 0 },
    )
  }
  if (kind) steps.push({ key: 'recap', titre: 'Relire et envoyer', sub: 'Vérifiez votre portrait — vous pouvez revenir en arrière pour ajuster.', valid: true })

  const cur = steps[Math.min(step, steps.length - 1)]
  const isLast = cur.key === 'recap'
  const canNext = cur.valid || cur.optional

  async function save() {
    setSaving(true)
    const promptClean = Object.fromEntries(Object.entries(oa).filter(([, v]) => v && v.trim()))
    await onSave({
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
    })
    setSaving(false); setDone(true)
  }

  // ── Écran de confirmation ──
  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-14">
        <div className="text-5xl mb-4">🪞</div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Votre portrait a été envoyé</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Merci. Il rejoint le miroir de façon anonyme — il sera restitué avec les autres regards, jamais seul (seuil de {SEUIL_RESTITUTION} regards).
        </p>
        <button onClick={resetAll} className="px-5 py-2.5 rounded-lg text-white" style={{ backgroundColor: 'var(--accent)' }}>
          Peindre un autre être
        </button>
      </div>
    )
  }

  const textarea = (value: string, set: (v: string) => void, rows = 3, placeholder = '') => (
    <textarea rows={rows} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm max-w-2xl" style={card} />
  )

  const recapEspece = (id: string) => {
    const e = especeById(id)
    return e ? (
      <span className="inline-flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={especeImg(id)} alt={e.nom} className="w-9 h-9 rounded object-cover" />
        <span>{e.emoji} {e.nom}</span>
      </span>
    ) : <span>—</span>
  }
  const vLbl = (v: number) => VERDICTS.find((x) => x.value === v)?.label ?? '—'

  return (
    <div className="max-w-4xl">
      {planche && <PlancheModal especeId={planche} onClose={() => setPlanche(null)}
        onChoose={cur.key === 'espC' ? setEspeceCite : setEspece} />}

      {/* ── Barre de progression ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--text-subtle)' }}>
          <span>Étape {Math.min(step + 1, steps.length)} sur {steps.length}</span>
          <span>{etre ? etreLabel : ''}</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ backgroundColor: 'var(--accent)', width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* ── Question courante ── */}
      <div className="rounded-2xl border p-5 mb-4" style={card}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
          {cur.titre}{cur.optional && <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-subtle)' }}>(facultatif)</span>}
        </h2>
        {cur.sub && <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{cur.sub}</p>}

        {cur.key === 'etre' && (
          <div className="space-y-4">
            {(['entreprise', 'service', 'poste', 'partie_prenante'] as EtreKind[]).map((k) => {
              const list = etres.filter((e) => e.kind === k)
              if (!list.length) return null
              return (
                <div key={k}>
                  <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>{ETRE_KIND_LABELS[k].toUpperCase()}
                    {k === 'entreprise' && ' — DEUX MILIEUX : MARCHÉ ET CITÉ'}
                    {k === 'poste' && ' — LE POSTE, JAMAIS LA PERSONNE'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((e) => (
                      <button key={e.key} onClick={() => setEtreKey(e.key)} className="px-4 py-2.5 rounded-lg border text-sm" style={chipStyle(etreKey === e.key)}>
                        {etreKey === e.key ? '✓ ' : ''}{e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {kind === 'entreprise' && isOwner && (
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>VOTRE REGARD</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setRegard('individuel')} className="px-4 py-2.5 rounded-lg border text-sm" style={chipStyle(regard === 'individuel')}>Regard parmi les autres</button>
                  <button onClick={() => setRegard('auto')} className="px-4 py-2.5 rounded-lg border text-sm" style={chipStyle(regard === 'auto')}>
                    Portrait de référence du dirigeant {myAutoDone ? '✓' : ''}
                  </button>
                </div>
              </div>
            )}
            {kind === 'entreprise' && (
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>COMMENT CONSTRUIRE LE PORTRAIT ?</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setMethode('manuel')} className="px-4 py-2.5 rounded-lg border text-sm" style={chipStyle(methode === 'manuel')}>✋ Pas à pas (guidé)</button>
                  <button onClick={() => setMethode('ia')} className="px-4 py-2.5 rounded-lg border text-sm" style={chipStyle(methode === 'ia')}>🤖 Avec l&apos;IA (narratif)</button>
                </div>
              </div>
            )}
          </div>
        )}

        {cur.key === 'ia' && (
          <div className="space-y-3 max-w-2xl">
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
        )}

        {(cur.key === 'espM' || cur.key === 'esp') && (
          <>
            <QuizHelper answers={answers} setAnswers={setAnswers} espece={espece} setEspece={setEspece} />
            <EspeceGrid value={espece} onChange={setEspece} suggested={suggested} onPlanche={setPlanche} />
          </>
        )}
        {cur.key === 'espC' && (
          <EspeceGrid value={especeCite} onChange={setEspeceCite} onPlanche={setPlanche} />
        )}

        {cur.key === 'habM' && <HabitatChoices milieu="marché" value={hM} onChange={setHM} />}
        {cur.key === 'habC' && <HabitatChoices milieu="cité" value={hC} onChange={setHC} />}

        {(cur.key === 'vM' || cur.key === 'v') && <ScaleChoices value={vM} onChange={setVM} />}
        {cur.key === 'vC' && <ScaleChoices value={vC} onChange={setVC} />}

        {cur.key === 'milieu' && textarea(milieuLibre, setMilieuLibre, 4)}
        {cur.key === 'signaux' && textarea(signaux, setSignaux, 3)}
        {cur.key === 'dedicace' && textarea(dedicace, setDedicace, 3)}

        {cur.key === 'relation' && (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
            {RELATIONS.map((r) => (
              <button key={r.id} onClick={() => setRelation(r.id)} className="text-left rounded-lg border p-3"
                style={relation === r.id ? { backgroundColor: 'var(--bg)', borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)' } : card}>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{relation === r.id ? '✓ ' : ''}{r.emoji} {r.nom}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{r.sens}</div>
              </button>
            ))}
          </div>
        )}

        {cur.key === 'recap' && (
          <div className="space-y-2 text-sm max-w-2xl" style={{ color: 'var(--text-muted)' }}>
            <RecapRow label="Être">{etreLabel}{kind === 'entreprise' && isOwner && regard === 'auto' ? ' — portrait de référence du dirigeant' : ''}</RecapRow>
            {kind === 'entreprise' ? (
              <>
                <RecapRow label="Animal du marché">{recapEspece(espece)}</RecapRow>
                <RecapRow label="Habitat marché">{(() => { const h = habitatById(hM); return h ? `${h.emoji} ${h.nom}` : '—' })()} · {vLbl(vM)}</RecapRow>
                <RecapRow label="Animal de la cité">{recapEspece(especeCite)}</RecapRow>
                <RecapRow label="Habitat cité">{(() => { const h = habitatById(hC); return h ? `${h.emoji} ${h.nom}` : '—' })()} · {vLbl(vC)}</RecapRow>
                {espece && especeCite && espece !== especeCite && (
                  <div className="text-xs rounded-lg border p-2.5" style={{ ...card, color: 'var(--text-subtle)' }}>
                    ⚖️ Vous avez peint deux animaux différents selon le milieu — c&apos;est souvent le cœur du diagnostic.
                  </div>
                )}
              </>
            ) : (
              <>
                <RecapRow label="Animal">{recapEspece(espece)}</RecapRow>
                {milieuLibre.trim() && <RecapRow label="Milieu">{milieuLibre}</RecapRow>}
                {relation && <RecapRow label="Relation">{(() => { const r = relationById(relation); return r ? `${r.emoji} ${r.nom}` : '—' })()}</RecapRow>}
                <RecapRow label={kind === 'partie_prenante' ? 'Relation viable ?' : 'Adéquation'}>{vLbl(vM)}</RecapRow>
              </>
            )}
            {signaux.trim() && <RecapRow label="Signaux">{signaux}</RecapRow>}
            {dedicace.trim() && <RecapRow label="Dédicace">« {dedicace} »</RecapRow>}
            <div className="pt-2">
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Un dernier mot ? (facultatif)</div>
              {textarea(justif, setJustif, 2, 'Justification, contexte, nuance…')}
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex items-center gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="px-4 py-2 rounded-lg border text-sm" style={{ ...card, color: 'var(--text)' }}>
            ← Précédent
          </button>
        )}
        {!isLast ? (
          <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="px-5 py-2 rounded-lg text-white text-sm disabled:opacity-40" style={{ backgroundColor: 'var(--accent)' }}>
            {cur.optional && !cur.valid ? 'Passer →' : 'Suivant →'}
          </button>
        ) : (
          <button disabled={saving} onClick={save} className="px-5 py-2 rounded-lg text-white text-sm disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {saving ? 'Envoi…' : '✓ Envoyer mon portrait'}
          </button>
        )}
        {!cur.valid && !cur.optional && cur.key !== 'etre' && (
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Répondez pour continuer.</span>
        )}
      </div>
    </div>
  )
}

function RecapRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start rounded-lg border p-2.5" style={card}>
      <span className="text-xs font-semibold w-32 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{children}</span>
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
