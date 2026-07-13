'use client'

/**
 * Iso53001PDFReport — composant visuel pour export html2canvas → jsPDF
 * (moteur générique : src/lib/pdf/exportReport.ts).
 *
 * Modèle « Diagnostic ISO/UNDP 53001 » : diagnostic de MATURITÉ du système de
 * management des ODD (base PAS 53002:2024) — un SCORE DE MATURITÉ /100 et des
 * NIVEAUX (NC / 1 / 2 / 3 / 4).
 *
 * Architecture de capture :
 *  - Pages fixes (couverture, vue d'ensemble) : data-pdf-page
 *  - Cartes par axe individuelles             : data-pdf-card
 *    → packées par exportReport() sans coupure.
 *
 * IMPORTANT : styles UNIQUEMENT inline — html2canvas ne lit pas Tailwind.
 * Le conteneur racine reçoit un `id` paramétrable (rendu hors-écran par le parent).
 */

import React from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

/** Un axe tel qu'exporté par Iso53001DiagnosticApp (ISO53001_AXES) */
export interface Iso53001PdfAxe {
  id: string
  label: string
  icon: string
  color: string
  colorLight: string
  weight: number
  description: string
  criteres: { id: string; label: string; description: string }[]
}

/** Un niveau de maturité (ISO53001_NIVEAUX) */
export interface Iso53001PdfNiveau {
  value: number
  shortLabel: string
  label: string
  description: string
  pct: number
  color: string
}

/** Une action ODD */
export interface Iso53001PdfAction {
  id: string
  critere_id: string
  titre: string
  description: string | null
  priorite: 'haute' | 'moyenne' | 'basse'
  statut: 'a_faire' | 'en_cours' | 'termine'
  echeance: string | null
  responsable: string | null
}

/** Données complètes passées au composant PDF */
export interface Iso53001PdfData {
  organisation: string | null
  siren: string | null
  ville: string | null
  year: number
  date: string // ex: "13 juillet 2026"
  scoreLabel: string // "Score de maturité"
  scoreValue: number // 0-100
  badge: { label: string; emoji: string; color: string }
  axes: Iso53001PdfAxe[]
  niveaux: Iso53001PdfNiveau[]
  /** critere_id → niveau (0-4) */
  reponses: Record<string, number>
  /** critere_id → commentaire */
  commentaires: Record<string, string>
  actions: Iso53001PdfAction[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITE_LABEL: Record<Iso53001PdfAction['priorite'], string> = {
  haute: '🔴 Haute',
  moyenne: '🟡 Moyenne',
  basse: '🟢 Basse',
}
const STATUT_LABEL: Record<Iso53001PdfAction['statut'], string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
}
const STATUT_COLOR: Record<Iso53001PdfAction['statut'], string> = {
  a_faire: '#64748b',
  en_cours: '#2563eb',
  termine: '#16a34a',
}

/** % de maturité moyen d'un axe (moyenne des pct des critères) */
function axePct(axe: Iso53001PdfAxe, data: Iso53001PdfData): number {
  const total = axe.criteres.length || 1
  const sum = axe.criteres.reduce((s, c) => {
    const n = data.reponses[c.id] ?? 0
    return s + (data.niveaux[n]?.pct ?? 0)
  }, 0)
  return Math.round((sum / total) * 100)
}

function niveauOf(data: Iso53001PdfData, critereId: string): Iso53001PdfNiveau {
  const n = data.reponses[critereId] ?? 0
  return data.niveaux[n] ?? data.niveaux[0]
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Page 1 — Couverture ───────────────────────────────────────────────────

function CoverPage({ data }: { data: Iso53001PdfData }) {
  const badge = data.badge
  return (
    <div
      data-pdf-page="0-cover"
      style={{
        width: 794, height: 1123,
        background: 'linear-gradient(148deg, #134e4a 0%, #0d9488 48%, #115e59 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        color: 'white', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'absolute', bottom: 60, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: 280, right: 80, width: 130, height: 130, borderRadius: '50%', background: 'rgba(45,212,191,0.22)' }} />

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
        <div style={{ fontSize: 76, marginBottom: 24, lineHeight: 1 }}>🎯</div>
        <div style={{ fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
          Management des ODD — Diagnostic
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1, letterSpacing: '-1.5px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
          ISO/UNDP 53001
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 46, fontStyle: 'italic', fontFamily: 'Georgia, serif', maxWidth: 520 }}>
          Systeme de management des ODD (base PAS 53002:2024)
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
            {[data.siren ? `SIREN ${data.siren}` : null, data.ville].filter(Boolean).join(' · ') || '—'}
          </div>
          <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', margin: '14px auto', borderRadius: 2 }} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>
            Annee {data.year}
          </div>
        </div>

        {/* Grand score de maturité + badge */}
        <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          {data.scoreValue}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 16, fontFamily: 'Arial, sans-serif', letterSpacing: 1 }}>
          SCORE DE MATURITE /100
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '9px 22px', borderRadius: 999,
          background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.32)',
          fontSize: 16, fontWeight: 800, fontFamily: 'Arial, Helvetica, sans-serif',
        }}>
          <span>{badge.emoji}</span>
          <span>{badge.label}</span>
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

function OverviewPage({ data }: { data: Iso53001PdfData }) {
  const badge = data.badge
  const totalActions = data.actions.length
  const enCours = data.actions.filter(a => a.statut === 'en_cours').length
  const terminees = data.actions.filter(a => a.statut === 'termine').length
  const aFaire = data.actions.filter(a => a.statut === 'a_faire').length

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
      <div style={{ background: '#115e59', padding: '18px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 3, fontFamily: 'Arial, sans-serif' }}>
            ISO/UNDP 53001 — Management des ODD (base PAS 53002:2024)
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            Vue d&apos;ensemble
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {data.scoreValue}
            <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.6)', fontFamily: 'Arial, sans-serif' }}>/100</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Arial, sans-serif' }}>
            Score de maturite
          </div>
        </div>
      </div>

      {/* Barre badge */}
      <div style={{ height: 5, background: badge.color }} />

      <div style={{ flex: 1, padding: '26px 52px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Badge global */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', borderRadius: 12,
          background: `${badge.color}12`, border: `1.5px solid ${badge.color}40`,
        }}>
          <span style={{ fontSize: 30 }}>{badge.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: badge.color, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {badge.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
              Score de maturite : {data.scoreValue}/100
            </div>
          </div>
          <div style={{ width: 180, height: 9, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${data.scoreValue}%`, height: '100%', background: badge.color, borderRadius: 5 }} />
          </div>
        </div>

        {/* Maturité par axe */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Maturite par axe
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.axes.map(axe => {
              const pct = axePct(axe, data)
              return (
                <div key={axe.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{axe.icon}</span>
                  <div style={{ width: 230, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', fontFamily: 'Arial, Helvetica, sans-serif' }}>{axe.label}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>Poids {Math.round(axe.weight * 100)}%</div>
                  </div>
                  <div style={{ flex: 1, height: 9, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: axe.color, borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: axe.color, minWidth: 40, textAlign: 'right', fontFamily: 'Arial, Helvetica, sans-serif' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Légende des niveaux */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Niveaux de maturite
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.niveaux.map(n => (
              <div key={n.value} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 12px', background: `${n.color}10`,
                borderRadius: 8, border: `1px solid ${n.color}28`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `${n.color}20`, border: `2px solid ${n.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: n.color, fontFamily: 'Arial Black, Arial, sans-serif' }}>{n.shortLabel}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>{n.label}</span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8, fontFamily: 'Arial, sans-serif' }}>— {n.description}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: n.color, fontFamily: 'Arial, sans-serif' }}>{Math.round(n.pct * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Synthèse plan d'actions */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Plan d&apos;actions — synthese
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total', value: totalActions, color: '#0f172a' },
              { label: 'A faire', value: aFaire, color: '#64748b' },
              { label: 'En cours', value: enCours, color: '#2563eb' },
              { label: 'Terminees', value: terminees, color: '#16a34a' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: 'Arial Black, Arial, sans-serif' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 52px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
          Diagnostic ISO/UNDP 53001 · {data.organisation ?? ''} · {data.year}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>Page 2</span>
      </div>
    </div>
  )
}

// ─── Carte par axe (capturée séparément) ─────────────────────────────────────

function AxeCard({ axe, data, cardIndex }: { axe: Iso53001PdfAxe; data: Iso53001PdfData; cardIndex: number }) {
  const pct = axePct(axe, data)
  const axeActions = data.actions.filter(a => axe.criteres.some(c => c.id === a.critere_id))

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
        {/* Header axe */}
        <div style={{ background: axe.color, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{axe.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Arial Black, Arial, sans-serif' }}>{axe.label}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.78)', fontFamily: 'Arial, sans-serif' }}>Poids {Math.round(axe.weight * 100)}%</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>{pct}<span style={{ fontSize: 13, opacity: 0.7 }}>%</span></div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial, sans-serif' }}>maturite</div>
          </div>
        </div>

        {/* Critères */}
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {axe.criteres.map(c => {
            const niv = niveauOf(data, c.id)
            const comment = (data.commentaires[c.id] ?? '').trim()
            return (
              <div key={c.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Badge niveau */}
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    background: `${niv.color}1a`, border: `1.5px solid ${niv.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: niv.color, fontFamily: 'Arial, sans-serif' }}>{niv.shortLabel}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: '#1e293b', lineHeight: 1.4, fontWeight: 600, fontFamily: 'Arial, Helvetica, sans-serif' }}>{c.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: niv.color, fontFamily: 'Arial, sans-serif' }}>{niv.label}</span>
                      <div style={{ width: 90, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(niv.pct * 100)}%`, height: '100%', background: niv.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: niv.color, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>{Math.round(niv.pct * 100)}%</span>
                    </div>
                    {comment && (
                      <div style={{ marginTop: 5, background: '#f0fdfa', borderLeft: '3px solid #0d9488', borderRadius: '0 6px 6px 0', padding: '5px 9px' }}>
                        <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'Arial, Helvetica, sans-serif' }}>{comment}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions de l'axe */}
        {axeActions.length > 0 && (
          <div style={{ padding: '8px 16px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Arial, sans-serif' }}>
              Actions ODD ({axeActions.filter(a => a.statut === 'termine').length}/{axeActions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {axeActions.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    flexShrink: 0, marginTop: 1, fontSize: 9, fontWeight: 700, color: 'white',
                    background: STATUT_COLOR[a.statut], borderRadius: 4, padding: '2px 6px',
                    fontFamily: 'Arial, sans-serif',
                  }}>{STATUT_LABEL[a.statut]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: a.statut === 'termine' ? '#9ca3af' : '#1e293b', textDecoration: a.statut === 'termine' ? 'line-through' : 'none', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 600 }}>{a.titre}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
                      <span style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>{PRIORITE_LABEL[a.priorite]}</span>
                      {a.echeance && <span style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>📅 {fmtDate(a.echeance)}</span>}
                      {a.responsable && <span style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>👤 {a.responsable}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal (rendu hors-écran par le parent) ─────────────────────

export default function Iso53001PDFReport({ id, data }: { id: string; data: Iso53001PdfData }) {
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
        {data.axes.map(axe => (
          <AxeCard key={axe.id} axe={axe} data={data} cardIndex={cardIndex++} />
        ))}
      </div>
    </div>
  )
}
