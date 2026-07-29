'use client'

/**
 * LeMiroirPDFReport — rapport PDF exhaustif du miroir collectif
 * (moteur générique : src/lib/pdf/exportReport.ts, html2canvas → jsPDF).
 *
 * Structure :
 *  - Couverture + synthèse (data-pdf-page)
 *  - Cartes packées sans coupure (data-pdf-card, ordonnées "01"…"99") :
 *    entreprise (2 portraits + écarts + paire), dédicaces, signaux,
 *    services, postes, parties prenantes, image cible & engagements,
 *    indicateurs, contrat de règles.
 *
 * IMPORTANT : styles UNIQUEMENT inline (html2canvas ne lit pas Tailwind).
 * Le seuil de restitution est respecté : les êtres sous le seuil
 * n'exposent aucun contenu, seulement leur statut.
 */

import React from 'react'

// ─── Palette Sens'ethO ────────────────────────────────────────────────────────
const TEAL = '#1D3D4C'
const SAGE = '#5E7A50'
const CREAM = '#F2EEE3'
const GRAY = '#555555'
const LIGHT = '#f4f6f3'
const BORDER = '#d9e0da'
const ALERT_BG = '#f6e7df'
const ALERT_FG = '#a85b3b'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfPortraitMilieu {
  especeLabel: string | null
  habitatLabel: string | null
  verdict: number | null
  dirigeantEspeceLabel: string | null
  dirigeantVerdict: number | null
  ecartEspece: boolean
  ecartVerdict: boolean
}

export interface PdfEtreAgg {
  label: string
  nRegards: number
  sousSeuil: boolean
  especeLabel: string | null
  relationLabel: string | null
  verdict: number | null
  verdictTitre: string
  milieux: string[]
  signaux: string[]
  justifications: string[]
}

export interface PdfEngagement {
  qui: string; quoi: string; echeance: string | null; comportement: string; statutLabel: string; constate: boolean
}

export interface LeMiroirPdfData {
  organisation: string
  year: number
  date: string
  statutLabel: string
  entreprise: {
    nRegards: number
    sousSeuil: boolean
    marche: PdfPortraitMilieu
    cite: PdfPortraitMilieu
    paireDiff: boolean
    dedicaces: string[]
    signaux: string[]
  } | null
  services: PdfEtreAgg[]
  postes: PdfEtreAgg[]
  partiesPrenantes: PdfEtreAgg[]
  imageCible: { especeLabel: string | null; note: string | null } | null
  engagements: PdfEngagement[]
  indicateurs: { label: string; value: string }[]
  regles: string[]
  seuil: number
}

// ─── Helpers visuels ──────────────────────────────────────────────────────────

const verdictLabel = (v: number | null) =>
  v === null ? '—' : ['', 'Inadéquat', 'Plutôt inadéquat', 'Plutôt adéquat', 'Pleinement adéquat'][Math.round(v)] ?? '—'

function Dots({ v }: { v: number | null }) {
  const n = v ? Math.round(v) : 0
  return (
    <span>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{
          display: 'inline-block', width: 9, height: 9, borderRadius: 5, marginRight: 3,
          backgroundColor: i <= n ? SAGE : BORDER, verticalAlign: 'middle',
        }} />
      ))}
      <span style={{ fontSize: 10, color: GRAY, marginLeft: 4 }}>{verdictLabel(v)}{v ? ` (${v}/4)` : ''}</span>
    </span>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 9,
      backgroundColor: ALERT_BG, color: ALERT_FG, marginRight: 4, verticalAlign: 'middle',
    }}>{children}</span>
  )
}

function CardShell({ order, title, children }: { order: string; title: string; children: React.ReactNode }) {
  return (
    <div data-pdf-card={order} style={{
      width: 794, boxSizing: 'border-box', padding: '10px 40px 14px 40px',
      fontFamily: 'Calibri, Arial, sans-serif', backgroundColor: '#ffffff',
    }}>
      <div style={{
        border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, backgroundColor: '#ffffff',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEAL, marginBottom: 8, borderBottom: `2px solid ${SAGE}`, paddingBottom: 5 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

function SousSeuil({ n, seuil }: { n: number; seuil: number }) {
  return (
    <div style={{
      border: `1px dashed ${BORDER}`, borderRadius: 8, padding: 10, fontSize: 10, color: GRAY,
      backgroundColor: LIGHT,
    }}>
      🔒 Sous le seuil de restitution : {n}/{seuil} regards — rien n&apos;est restitué en dessous de {seuil} regards (contrat de règles).
    </div>
  )
}

function Quotes({ items }: { items: string[] }) {
  return (
    <div>
      {items.map((s, i) => (
        <div key={i} style={{ fontSize: 10.5, color: GRAY, marginBottom: 4, paddingLeft: 10, borderLeft: `3px solid ${SAGE}` }}>
          « {s} »
        </div>
      ))}
    </div>
  )
}

function EtreBlock({ e, seuil }: { e: PdfEtreAgg; seuil: number }) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, marginBottom: 3 }}>
        {e.label} <span style={{ fontWeight: 400, fontSize: 9.5, color: GRAY }}>· {e.nRegards} regard(s)</span>
      </div>
      {e.sousSeuil ? <SousSeuil n={e.nRegards} seuil={seuil} /> : (
        <>
          <div style={{ fontSize: 11.5, color: '#222', marginBottom: 3 }}>
            {e.especeLabel ?? '—'}
            {e.relationLabel && <span style={{ marginLeft: 10, color: GRAY }}>Relation : <b>{e.relationLabel}</b></span>}
          </div>
          <div style={{ fontSize: 10, color: GRAY, marginBottom: 5 }}>{e.verdictTitre} : <Dots v={e.verdict} /></div>
          {e.milieux.length > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: SAGE, marginBottom: 2 }}>LE MILIEU DÉCRIT</div>
              <Quotes items={e.milieux} />
            </div>
          )}
          {e.signaux.length > 0 && (
            <div style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: SAGE, marginBottom: 2 }}>SIGNAUX (peur / blessure / angle mort)</div>
              <Quotes items={e.signaux} />
            </div>
          )}
          {e.justifications.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: SAGE, marginBottom: 2 }}>JUSTIFICATIONS</div>
              <Quotes items={e.justifications} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MilieuBox({ titre, m }: { titre: string; m: PdfPortraitMilieu }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, backgroundColor: LIGHT }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: SAGE, marginBottom: 4 }}>{titre}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, marginBottom: 2 }}>{m.especeLabel ?? '—'}</div>
      <div style={{ fontSize: 10, color: GRAY, marginBottom: 4 }}>
        {m.habitatLabel ? `${m.habitatLabel} · ` : ''}<Dots v={m.verdict} />
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 5, fontSize: 10, color: GRAY }}>
        Portrait du dirigeant : <b style={{ color: '#222' }}>{m.dirigeantEspeceLabel ?? '—'}</b> · {verdictLabel(m.dirigeantVerdict)}
        <div style={{ marginTop: 3 }}>
          {m.ecartEspece && <Badge>écart d&apos;espèce</Badge>}
          {m.ecartVerdict && <Badge>écart d&apos;adéquation</Badge>}
          {!m.ecartEspece && !m.ecartVerdict && <span style={{ fontSize: 9, color: SAGE }}>✓ aligné</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function LeMiroirPDFReport({ id, data }: { id: string; data: LeMiroirPdfData }) {
  let order = 0
  const next = () => String(++order).padStart(2, '0')

  return (
    <div id={id} style={{ width: 794, backgroundColor: '#ffffff', fontFamily: 'Calibri, Arial, sans-serif' }}>

      {/* ═══ Page 1 : couverture + synthèse ═══ */}
      <div data-pdf-page="01" style={{ width: 794, height: 1123, boxSizing: 'border-box', padding: '60px 56px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: TEAL, letterSpacing: 1 }}>SENS&apos;ETHO</div>
          <div style={{ fontSize: 13, color: SAGE, marginTop: 2 }}>Éthologue d&apos;entreprise pour apporter du sens</div>
          <div style={{ margin: '30px auto 0', width: 120, borderTop: `3px solid ${SAGE}` }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: TEAL, marginTop: 30 }}>Le Miroir — restitution du miroir collectif</div>
          <div style={{ fontSize: 16, color: GRAY, marginTop: 10 }}>{data.organisation} · Campagne {data.year}</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 6 }}>{data.date} · {data.statutLabel}</div>
        </div>

        <div style={{ marginTop: 44, backgroundColor: CREAM, borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, marginBottom: 6 }}>La méthode en une phrase</div>
          <div style={{ fontSize: 10.5, color: GRAY, lineHeight: 1.5 }}>
            Chaque entité est décrite comme un animal vivant dans un milieu : l&apos;entreprise (deux portraits — son marché et sa
            place dans la cité), ses services, ses postes d&apos;encadrement (le poste, jamais la personne) et ses parties prenantes.
            Le diagnostic tient dans deux questions : voyons-nous la même chose (les écarts) — et ce que nous voyons est-il adapté
            (l&apos;adéquation animal-milieu) ?
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, marginBottom: 8 }}>Les indicateurs standard de la mission</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {data.indicateurs.map((ind, i) => (
                <tr key={i}>
                  <td style={{ border: `1px solid ${BORDER}`, padding: '5px 8px', fontSize: 10, fontWeight: 700, color: TEAL, width: 220, backgroundColor: LIGHT }}>{ind.label}</td>
                  <td style={{ border: `1px solid ${BORDER}`, padding: '5px 8px', fontSize: 10, color: GRAY }}>{ind.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 9, color: '#999999' }}>
          Document confidentiel — restitution garantie à tous les participants · aucune donnée nominative ·
          seuil de restitution ≥ {data.seuil} regards · étanchéité RH absolue (contrat de règles)
        </div>
      </div>

      {/* ═══ Cartes ═══ */}

      {data.entreprise && (
        <CardShell order={next()} title={`L'entreprise — deux animaux, deux milieux (${data.entreprise.nRegards} regards + le portrait de référence du dirigeant)`}>
          {data.entreprise.sousSeuil ? <SousSeuil n={data.entreprise.nRegards} seuil={data.seuil} /> : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <MilieuBox titre="🏹 SUR SON MARCHÉ" m={data.entreprise.marche} />
                <MilieuBox titre="🏛️ DANS LA CITÉ (marque employeur réelle)" m={data.entreprise.cite} />
              </div>
              {data.entreprise.paireDiff && (
                <div style={{ fontSize: 10.5, color: GRAY, backgroundColor: CREAM, borderRadius: 8, padding: 10 }}>
                  <b style={{ color: TEAL }}>⚖️ La paire des deux animaux :</b> deux animaux différents selon le milieu — tension féconde
                  ou écartèlement ? Les deux peuvent-ils être portés par le même corps ? C&apos;est souvent là que la perte de sens se loge.
                </div>
              )}
            </>
          )}
        </CardShell>
      )}

      {data.entreprise && !data.entreprise.sousSeuil && data.entreprise.dedicaces.length > 0 && (
        <CardShell order={next()} title="💬 Les dédicaces (anonymes) — « si cet animal pouvait dire une chose au dirigeant… »">
          <Quotes items={data.entreprise.dedicaces} />
        </CardShell>
      )}

      {data.entreprise && !data.entreprise.sousSeuil && data.entreprise.signaux.length > 0 && (
        <CardShell order={next()} title="📡 Les signaux de l'entreprise (peur / blessure / angle mort)">
          <Quotes items={data.entreprise.signaux} />
        </CardShell>
      )}

      {data.services.length > 0 && (
        <CardShell order={next()} title="Les services">
          {data.services.map((e, i) => <EtreBlock key={i} e={e} seuil={data.seuil} />)}
        </CardShell>
      )}

      {data.postes.length > 0 && (
        <CardShell order={next()} title="Les postes d'encadrement — le poste, jamais la personne">
          <div style={{ fontSize: 9.5, color: GRAY, marginBottom: 8, fontStyle: 'italic' }}>
            « Si le titulaire changeait demain, qu&apos;est-ce qui resterait vrai ? » — en mission réelle, chaque portrait de poste
            est restitué au titulaire avant toute discussion collective (méthode §6.4).
          </div>
          {data.postes.map((e, i) => <EtreBlock key={i} e={e} seuil={data.seuil} />)}
        </CardShell>
      )}

      {data.partiesPrenantes.length > 0 && (
        <CardShell order={next()} title="Les parties prenantes — les espèces qui peuplent les milieux">
          {data.partiesPrenantes.map((e, i) => <EtreBlock key={i} e={e} seuil={data.seuil} />)}
        </CardShell>
      )}

      {(data.imageCible || data.engagements.length > 0) && (
        <CardShell order={next()} title="🎯 L'image cible et les engagements">
          {data.imageCible && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>{data.imageCible.especeLabel ?? '—'}</div>
              {data.imageCible.note && <div style={{ fontSize: 10.5, color: GRAY, marginTop: 3 }}>« {data.imageCible.note} »</div>}
            </div>
          )}
          {data.engagements.map((e, i) => (
            <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, marginBottom: 6, backgroundColor: LIGHT }}>
              <div style={{ fontSize: 10.5 }}>
                <b style={{ color: TEAL }}>Engagement {i + 1}</b>
                <span style={{
                  marginLeft: 8, fontSize: 9, padding: '1px 8px', borderRadius: 10,
                  backgroundColor: e.constate ? '#e6efe6' : '#eef1f6', color: e.constate ? '#3d6b3d' : '#4a5a78',
                }}>{e.statutLabel}</span>
              </div>
              <div style={{ fontSize: 10.5, color: GRAY, marginTop: 3 }}>
                <b style={{ color: '#222' }}>{e.qui}</b> — {e.quoi}{e.echeance ? ` · à partir de ${e.echeance}` : ''}
              </div>
              <div style={{ fontSize: 9.5, color: SAGE, marginTop: 2 }}>👁 On le verra à : {e.comportement}</div>
            </div>
          ))}
        </CardShell>
      )}

      <CardShell order={next()} title="📜 Le contrat de règles de la campagne">
        {data.regles.map((r, i) => (
          <div key={i} style={{ fontSize: 9.5, color: GRAY, marginBottom: 3, paddingLeft: 10 }}>• {r}</div>
        ))}
      </CardShell>
    </div>
  )
}
