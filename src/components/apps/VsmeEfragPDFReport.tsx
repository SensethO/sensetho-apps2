'use client'

/**
 * VsmeEfragPDFReport — composant visuel pour export html2canvas → jsPDF
 * (moteur générique : src/lib/pdf/exportReport.ts).
 *
 * Modèle « VSME EFRAG » : reporting de durabilité PME — PROGRESSION de
 * renseignement (%) et STATUTS par datapoint (Non évalué / Non applicable /
 * Non renseigné / En cours / Renseigné).
 *
 * Architecture de capture :
 *  - Pages fixes (couverture, vue d'ensemble) : data-pdf-page
 *  - Cartes par section individuelles         : data-pdf-card
 *    → packées par exportReport() sans coupure.
 *
 * IMPORTANT : styles UNIQUEMENT inline — html2canvas ne lit pas Tailwind.
 * Le conteneur racine reçoit un `id` paramétrable (rendu hors-écran par le parent).
 */

import React from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

export type VsmePdfStatus = 'non_evalue' | 'non_applicable' | 'non_renseigne' | 'en_cours' | 'renseigne'

export interface VsmePdfDatapoint {
  code: string
  title: string
  mandatory: boolean
  type: 'text' | 'number' | 'boolean'
  unit?: string
}

export interface VsmePdfSection {
  id: string
  title: string
  icon: string
  datapoints: VsmePdfDatapoint[]
}

export interface VsmePdfResponse {
  status: VsmePdfStatus
  value_text: string | null
  value_number: number | null
}

export interface VsmePdfCorrespondance {
  section: string
  label: string
  esrs: string
  gri: string
  iso: string
}

/** Données complètes passées au composant PDF */
export interface VsmeEfragPdfData {
  organisation: string | null
  siret: string | null
  ville: string | null
  year: number
  date: string // ex: "16 mai 2026"
  baseSections: VsmePdfSection[]
  completSections: VsmePdfSection[]
  /** datapoint_code → réponse */
  responses: Record<string, VsmePdfResponse>
  correspondances: VsmePdfCorrespondance[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<VsmePdfStatus, { label: string; color: string; bg: string }> = {
  non_evalue:     { label: 'Non évalué',     color: '#64748b', bg: '#f1f5f9' },
  non_applicable: { label: 'Non applicable', color: '#475569', bg: '#e2e8f0' },
  non_renseigne:  { label: 'Non renseigné',  color: '#92400e', bg: '#fef9c3' },
  en_cours:       { label: 'En cours',       color: '#d97706', bg: '#fef3c7' },
  renseigne:      { label: 'Renseigné',      color: '#16a34a', bg: '#dcfce7' },
}

function statusOf(data: VsmeEfragPdfData, code: string): VsmePdfStatus {
  return data.responses[code]?.status ?? 'non_evalue'
}

function valueOf(data: VsmeEfragPdfData, dp: VsmePdfDatapoint): string {
  const resp = data.responses[dp.code]
  if (!resp) return ''
  if (dp.type === 'number') {
    if (resp.value_number === null || resp.value_number === undefined) return ''
    return dp.unit ? `${resp.value_number} ${dp.unit}` : String(resp.value_number)
  }
  return (resp.value_text ?? '').trim()
}

function sectionPct(data: VsmeEfragPdfData, section: VsmePdfSection): number {
  const total = section.datapoints.length || 1
  const done = section.datapoints.filter(dp => statusOf(data, dp.code) === 'renseigne').length
  return Math.round((done / total) * 100)
}

function modulePct(data: VsmeEfragPdfData, sections: VsmePdfSection[]): number {
  const codes = sections.flatMap(s => s.datapoints.map(dp => dp.code))
  if (codes.length === 0) return 0
  const done = codes.filter(c => statusOf(data, c) === 'renseigne').length
  return Math.round((done / codes.length) * 100)
}

function countByStatus(data: VsmeEfragPdfData, status: VsmePdfStatus): number {
  const codes = [...data.baseSections, ...data.completSections].flatMap(s => s.datapoints.map(dp => dp.code))
  return codes.filter(c => statusOf(data, c) === status).length
}

// ─── Page 1 — Couverture ───────────────────────────────────────────────────

function CoverPage({ data }: { data: VsmeEfragPdfData }) {
  const allCodes = [...data.baseSections, ...data.completSections].flatMap(s => s.datapoints.map(dp => dp.code))
  const done = allCodes.filter(c => statusOf(data, c) === 'renseigne').length
  const globalPct = allCodes.length > 0 ? Math.round((done / allCodes.length) * 100) : 0

  return (
    <div
      data-pdf-page="0-cover"
      style={{
        width: 794, height: 1123,
        background: 'linear-gradient(148deg, #14532d 0%, #16a34a 48%, #1e40af 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        color: 'white', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'absolute', bottom: 60, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: 280, right: 80, width: 130, height: 130, borderRadius: '50%', background: 'rgba(74,222,128,0.22)' }} />

      {/* En-tête */}
      <div style={{ padding: '28px 52px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            Sens&apos;ethO
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.25)', margin: '0 6px' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase' }}>Apps</span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Arial, sans-serif' }}>{data.date}</span>
      </div>

      {/* Contenu central */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 52px', textAlign: 'center' }}>
        <div style={{ fontSize: 76, marginBottom: 24, lineHeight: 1 }}>🌱</div>
        <div style={{ fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
          Reporting de durabilite — Standard PME
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1, letterSpacing: '-1.5px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
          VSME EFRAG
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 46, fontStyle: 'italic', fontFamily: 'Georgia, serif', maxWidth: 520 }}>
          Voluntary Sustainability Reporting Standard — modules de Base et Complet
        </div>

        {/* Bloc organisation */}
        <div style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: '22px 48px', marginBottom: 44, minWidth: 360 }}>
          {data.organisation ? (
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {data.organisation}
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              Organisation
            </div>
          )}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>
            {[data.siret ? `SIRET ${data.siret}` : null, data.ville].filter(Boolean).join(' · ') || '—'}
          </div>
          <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', margin: '14px auto', borderRadius: 2 }} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>
            Annee de reporting {data.year}
          </div>
        </div>

        {/* Grande progression globale */}
        <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          {globalPct}<span style={{ fontSize: 40, fontWeight: 700 }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 16, fontFamily: 'Arial, sans-serif', letterSpacing: 1 }}>
          PROGRESSION GLOBALE — {done}/{allCodes.length} DATAPOINTS RENSEIGNES
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 16,
          padding: '9px 22px', borderRadius: 999,
          background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.32)',
          fontSize: 14, fontWeight: 800, fontFamily: 'Arial, Helvetica, sans-serif',
        }}>
          <span>🌿 Base {modulePct(data, data.baseSections)}%</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>🏆 Complet {modulePct(data, data.completSections)}%</span>
        </div>
      </div>

      {/* Pied */}
      <div style={{ padding: '16px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Arial, sans-serif' }}>
          Genere avec Sens&apos;ethO Apps · apps.sensetho.com
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Arial, sans-serif' }}>Page 1</span>
      </div>
    </div>
  )
}

// ─── Page 2 — Vue d'ensemble ─────────────────────────────────────────────────

function OverviewPage({ data }: { data: VsmeEfragPdfData }) {
  const allCodes = [...data.baseSections, ...data.completSections].flatMap(s => s.datapoints.map(dp => dp.code))
  const done = allCodes.filter(c => statusOf(data, c) === 'renseigne').length
  const globalPct = allCodes.length > 0 ? Math.round((done / allCodes.length) * 100) : 0

  const statuses: VsmePdfStatus[] = ['non_evalue', 'non_applicable', 'non_renseigne', 'en_cours', 'renseigne']

  return (
    <div
      data-pdf-page="1-overview"
      style={{
        width: 794, height: 1123,
        background: '#ffffff',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ background: '#14532d', padding: '18px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 3, fontFamily: 'Arial, sans-serif' }}>
            VSME EFRAG — Reporting de durabilite PME
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            Vue d&apos;ensemble
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {globalPct}
            <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Arial, sans-serif' }}>
            Progression globale
          </div>
        </div>
      </div>

      {/* Barre verte */}
      <div style={{ height: 5, background: '#16a34a' }} />

      <div style={{ flex: 1, padding: '26px 52px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Modules */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: '🌿 Module de Base', sections: data.baseSections, color: '#16a34a' },
            { label: '🏆 Module Complet', sections: data.completSections, color: '#7c3aed' },
          ].map(m => {
            const codes = m.sections.flatMap(s => s.datapoints.map(dp => dp.code))
            const mDone = codes.filter(c => statusOf(data, c) === 'renseigne').length
            const pct = codes.length > 0 ? Math.round((mDone / codes.length) * 100) : 0
            return (
              <div key={m.label} style={{ padding: '14px 18px', borderRadius: 12, background: `${m.color}0d`, border: `1.5px solid ${m.color}40` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>{m.label}</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: m.color, fontFamily: 'Arial Black, Arial, sans-serif' }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 5 }} />
                </div>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
                  {mDone}/{codes.length} datapoints renseignes
                </div>
              </div>
            )
          })}
        </div>

        {/* Progression par section */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Progression par section
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...data.baseSections.map(s => ({ s, color: '#16a34a' })), ...data.completSections.map(s => ({ s, color: '#7c3aed' }))].map(({ s, color }) => {
              const pct = sectionPct(data, s)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, flexShrink: 0, width: 22, textAlign: 'center' }}>{s.icon}</span>
                  <div style={{ width: 280, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', fontFamily: 'Arial, Helvetica, sans-serif' }}>{s.title}</div>
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 38, textAlign: 'right', fontFamily: 'Arial, Helvetica, sans-serif' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Répartition des statuts */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Repartition des statuts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
            {statuses.map(st => {
              const meta = STATUS_META[st]
              return (
                <div key={st} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, border: '1px solid #e2e8f0', background: meta.bg }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: meta.color, fontFamily: 'Arial Black, Arial, sans-serif' }}>{countByStatus(data, st)}</div>
                  <div style={{ fontSize: 9, color: meta.color, fontFamily: 'Arial, sans-serif' }}>{meta.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Correspondances */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
            Correspondances CSRD/ESRS · GRI 2021 · ISO 26000
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1.3fr 1.3fr 1fr 0.7fr', gap: 0, background: '#f8fafc', padding: '6px 10px' }}>
              {['Section', 'Intitule', 'CSRD / ESRS', 'GRI 2021', 'ISO 26000'].map(h => (
                <span key={h} style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{h}</span>
              ))}
            </div>
            {data.correspondances.map((c, i) => (
              <div key={c.section} style={{ display: 'grid', gridTemplateColumns: '70px 1.3fr 1.3fr 1fr 0.7fr', gap: 0, padding: '4px 10px', background: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: c.section.startsWith('C') ? '#7c3aed' : '#16a34a', fontFamily: 'Arial, sans-serif' }}>{c.section}</span>
                <span style={{ fontSize: 8.5, color: '#1e293b', fontFamily: 'Arial, sans-serif' }}>{c.label}</span>
                <span style={{ fontSize: 8, color: '#475569', fontFamily: 'Arial, sans-serif' }}>{c.esrs}</span>
                <span style={{ fontSize: 8, color: '#475569', fontFamily: 'Arial, sans-serif' }}>{c.gri}</span>
                <span style={{ fontSize: 8, color: '#475569', fontFamily: 'Arial, sans-serif' }}>{c.iso}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 52px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
          VSME EFRAG · {data.organisation ?? ''} · {data.year}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>Page 2</span>
      </div>
    </div>
  )
}

// ─── Carte par section (capturée séparément) ─────────────────────────────────

function SectionCard({ section, moduleColor, data, cardIndex }: { section: VsmePdfSection; moduleColor: string; data: VsmeEfragPdfData; cardIndex: number }) {
  const pct = sectionPct(data, section)
  const done = section.datapoints.filter(dp => statusOf(data, dp.code) === 'renseigne').length

  return (
    <div
      data-pdf-card={String(cardIndex).padStart(4, '0')}
      style={{
        width: 794,
        padding: '0 50px',
        paddingBottom: 10,
        boxSizing: 'border-box',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        background: '#ffffff',
      }}
    >
      <div style={{
        border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {/* Header section */}
        <div style={{ background: moduleColor, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{section.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Arial Black, Arial, sans-serif' }}>{section.title}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.78)', fontFamily: 'Arial, sans-serif' }}>{done}/{section.datapoints.length} datapoints renseignes</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>{pct}<span style={{ fontSize: 13, opacity: 0.7 }}>%</span></div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial, sans-serif' }}>progression</div>
          </div>
        </div>

        {/* Datapoints */}
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {section.datapoints.map(dp => {
            const st = statusOf(data, dp.code)
            const meta = STATUS_META[st]
            const value = valueOf(data, dp)
            return (
              <div key={dp.code} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: moduleColor, fontFamily: 'Courier New, monospace' }}>{dp.code}</span>
                      {dp.mandatory && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '1px 6px', fontFamily: 'Arial, sans-serif' }}>
                          OBLIGATOIRE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#1e293b', lineHeight: 1.4, fontWeight: 600, fontFamily: 'Arial, Helvetica, sans-serif', marginTop: 2 }}>{dp.title}</div>
                    {value && (
                      <div style={{ marginTop: 5, background: '#f0fdf4', borderLeft: `3px solid ${moduleColor}`, borderRadius: '0 6px 6px 0', padding: '5px 9px' }}>
                        <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'Arial, Helvetica, sans-serif' }}>{value}</div>
                      </div>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0, marginTop: 2, fontSize: 9, fontWeight: 700,
                    color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`,
                    borderRadius: 999, padding: '3px 9px', fontFamily: 'Arial, sans-serif',
                  }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal (rendu hors-écran par le parent) ─────────────────────

export default function VsmeEfragPDFReport({ id, data }: { id: string; data: VsmeEfragPdfData }) {
  let cardIndex = 0
  return (
    <div
      id={id}
      aria-hidden="true"
      style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}
    >
      <CoverPage data={data} />
      <OverviewPage data={data} />
      <div style={{ width: 794, boxSizing: 'border-box' }}>
        {data.baseSections.map(section => (
          <SectionCard key={section.id} section={section} moduleColor="#16a34a" data={data} cardIndex={cardIndex++} />
        ))}
        {data.completSections.map(section => (
          <SectionCard key={section.id} section={section} moduleColor="#7c3aed" data={data} cardIndex={cardIndex++} />
        ))}
      </div>
    </div>
  )
}
