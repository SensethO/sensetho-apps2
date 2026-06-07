'use client'

/**
 * GuidedDiagnosticPDFReport — composant visuel pour export html2canvas → jsPDF.
 * Adapté depuis ISO26000GuidedPDFReport.tsx (sensetho-apps) pour les 13 domaines
 * du Diagnostic Initial Guidé de sensetho-apps2.
 *
 * Architecture de capture :
 *  - Pages fixes (couverture, vue d'ensemble) : data-guided-pdf-page
 *  - Cartes domaines individuelles : data-guided-pdf-card
 *    → packées par exportGuidedPDF() avec suivi de Y, jamais coupées.
 *
 * IMPORTANT : Styles UNIQUEMENT inline — html2canvas ne lit pas Tailwind.
 */

import React from 'react'

// ─── Types exportés ──────────────────────────────────────────────────────────

/** Données d'une action focus dans le PDF */
export interface GuidedFocusAction {
  key: string
  text: string
  progress: number  // 0–10
  na: boolean
  note?: string     // texte brut (plain text, pas rich text)
}

/** Données d'un domaine dans le PDF */
export interface GuidedDomainReport {
  domainId: string
  domainName: string
  isoRef: string
  qcNom: string
  qcIcone: string
  phase: 1 | 2 | 3 | 4
  score: number           // 0–5
  maturityName: string
  rationale: string
  focusActions: GuidedFocusAction[]
  // Phase context — présent si premier domaine de la phase
  isFirstInPhase: boolean
  phaseLabel?: string
  phaseColor?: string
  phaseBgColor?: string
  phaseAvgScore?: number
  phaseEvaluated?: number
  phaseTotal?: number
}

/** Données d'une phase dans le PDF */
export interface GuidedPhaseReport {
  id: 1 | 2 | 3 | 4
  label: string
  color: string
  bgColor: string
  domains: GuidedDomainReport[]
}

/** Données complètes passées au composant PDF */
export interface GuidedPDFData {
  organisation: string | null
  year: number
  date: string           // ex: "16 mai 2026"
  evaluatedCount: number
  totalCount: number
  avgScore: number       // moyenne 0–5 des domaines évalués
  phases: GuidedPhaseReport[]
  aiAnalysis?: string | null
}

// ─── Helper : htmlToText (pour rich text éventuel) ───────────────────────────

/** Convertit du HTML en texte lisible avec sauts de lignes préservés */
export function htmlToText(html: string): string {
  if (!html || html === '<p></p>') return ''
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Helpers couleur ─────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s === 0) return '#9ca3af'
  if (s <= 1) return '#ef4444'
  if (s <= 2) return '#f97316'
  if (s <= 3) return '#eab308'
  if (s <= 4) return '#22c55e'
  return '#4ade80'
}

function progressColor(p: number): string {
  if (p === 0) return '#d1d5db'
  if (p <= 2) return '#ef4444'
  if (p <= 4) return '#f97316'
  if (p <= 6) return '#eab308'
  if (p <= 8) return '#22c55e'
  return '#4ade80'
}

// ─── Score Ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const filled = (score / 5) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
      {score > 0 && (
        <circle cx="60" cy="60" r={r} fill="none" stroke="white" strokeWidth="9"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 60 60)" />
      )}
      <text x="60" y="52" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold" fontFamily="Arial, sans-serif">
        {score.toFixed(1)}
      </text>
      <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily="Arial, sans-serif">/5</text>
      <text x="60" y="85" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="9" fontFamily="Arial, sans-serif">moy.</text>
    </svg>
  )
}

// ─── Page 1 — Couverture ──────────────────────────────────────────────────────

export function CoverPage({ data }: { data: GuidedPDFData }) {
  return (
    <div
      data-guided-pdf-page="0-cover"
      style={{
        width: 794, height: 1123,
        background: 'linear-gradient(148deg, #1e1b4b 0%, #3730a3 45%, #1e40af 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        color: 'white', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', top: -120, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', bottom: 60, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: 280, right: 80, width: 130, height: 130, borderRadius: '50%', background: 'rgba(99,102,241,0.22)' }} />

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
        <div style={{ fontSize: 80, marginBottom: 28, lineHeight: 1 }}>🧭</div>
        <div style={{ fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
          ISO 26000 — Diagnostic initial guide
        </div>
        <div style={{ fontSize: 46, fontWeight: 900, margin: '0 0 6px', lineHeight: 1.1, letterSpacing: '-1.5px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
          Rapport RSE
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.58)', marginBottom: 52, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          Evaluation de maturite
        </div>

        {/* Bloc organisation */}
        <div style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: '22px 48px', marginBottom: 52, minWidth: 340 }}>
          {data.organisation ? (
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {data.organisation}
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              Organisation
            </div>
          )}
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.58)', marginBottom: 4, fontFamily: 'Arial, sans-serif' }}>
            Annee {data.year}
          </div>
          <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', margin: '14px auto', borderRadius: 2 }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: 'Arial, sans-serif' }}>
            {data.evaluatedCount} / {data.totalCount} domaines prioritaires evalues
          </div>
        </div>

        {/* Score ring */}
        <ScoreRing score={data.avgScore} size={160} />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 10, fontFamily: 'Arial, sans-serif' }}>
          Score moyen — domaines evalues
        </div>
      </div>

      {/* Barre phases */}
      <div style={{ height: 5, display: 'flex' }}>
        {data.phases.map(p => (
          <div key={p.id} style={{ flex: 1, background: p.color }} />
        ))}
      </div>

      {/* Pied */}
      <div style={{ padding: '16px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial, sans-serif' }}>
          Genere avec Sens&apos;ethO Apps · apps.sensetho.com
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial, sans-serif' }}>Page 1</span>
      </div>
    </div>
  )
}

// ─── Page 2 — Vue d'ensemble par phase ───────────────────────────────────────

export function OverviewPage({ data }: { data: GuidedPDFData }) {
  const maturityLevels = [
    { n: 0, label: 'Non evalue',  desc: 'Domaine non encore considere' },
    { n: 1, label: 'Initiale',    desc: 'Actions ponctuelles, pas de demarche structuree' },
    { n: 2, label: 'Engagee',     desc: 'Initiatives en cours, conscientisation de l\'enjeu' },
    { n: 3, label: 'Structuree',  desc: 'Processus formels, objectifs definis et mesures' },
    { n: 4, label: 'Avancee',     desc: 'RSE ancree dans la strategie, indicateurs partages' },
    { n: 5, label: 'Exemplaire',  desc: 'Leadership RSE, innovation et transparence totale' },
  ]

  return (
    <div
      data-guided-pdf-page="1-overview"
      style={{
        width: 794, height: 1123,
        background: '#ffffff',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '18px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 3, fontFamily: 'Arial, sans-serif' }}>
            Rapport RSE — Diagnostic Initial Guide
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            Vue d&apos;ensemble
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: scoreColor(Math.round(data.avgScore)), fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {data.avgScore.toFixed(1)}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#475569', fontFamily: 'Arial, sans-serif' }}>/5</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'Arial, sans-serif' }}>
            Score moyen global
          </div>
        </div>
      </div>

      {/* Barre phases colorée */}
      <div style={{ height: 4, display: 'flex' }}>
        {data.phases.map(p => (
          <div key={p.id} style={{ flex: 1, background: p.color }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: '26px 52px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        {/* Grille 2×2 — synthèse par phase */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, fontFamily: 'Arial, sans-serif' }}>
            Synthese par phase
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {data.phases.map(phase => {
              const ev = phase.domains.filter(d => d.score > 0)
              const avg = ev.length ? ev.reduce((s, d) => s + d.score, 0) / ev.length : 0
              return (
                <div key={phase.id} style={{ border: `2px solid ${phase.color}28`, borderRadius: 12 }}>
                  {/* En-tête de phase */}
                  <div style={{ background: phase.color, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.24)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 12, color: 'white', flexShrink: 0,
                      fontFamily: 'Arial Black, Arial, sans-serif',
                    }}>
                      {phase.id}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'white', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {phase.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontFamily: 'Arial, sans-serif' }}>
                      {ev.length}/{phase.domains.length}
                    </div>
                  </div>

                  {/* Domaines */}
                  <div style={{ background: phase.bgColor, padding: '8px 12px' }}>
                    {phase.domains.map(domain => (
                      <div key={domain.domainId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{domain.qcIcone}</span>
                        <div style={{ flex: 1, fontSize: 10, color: '#1e293b', lineHeight: 1.4, fontFamily: 'Arial, sans-serif' }}>
                          {domain.domainName}
                        </div>
                        {domain.score > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 1 }}>
                            <div style={{ width: 42, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${(domain.score / 5) * 100}%`, height: '100%', background: scoreColor(domain.score), borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(domain.score), minWidth: 22, fontFamily: 'Arial, sans-serif' }}>
                              {domain.score}/5
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>—</span>
                        )}
                      </div>
                    ))}
                    {ev.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: 'Arial, sans-serif' }}>Moyenne phase</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: scoreColor(Math.round(avg)), fontFamily: 'Arial Black, Arial, sans-serif' }}>
                          {avg.toFixed(1)}/5
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Echelle de maturité */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Echelle de maturite ISO 26000
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {maturityLevels.map(level => (
              <div key={level.n} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 12px', background: `${scoreColor(level.n)}10`,
                borderRadius: 8, border: `1px solid ${scoreColor(level.n)}28`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `${scoreColor(level.n)}20`,
                  border: `2px solid ${scoreColor(level.n)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor(level.n), fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {level.n}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    {level.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8, fontFamily: 'Arial, sans-serif' }}>
                    — {level.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 52px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
          Diagnostic Initial RSE — ISO 26000 · {data.organisation ?? ''} · {data.year}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>Page 2</span>
      </div>
    </div>
  )
}

// ─── Carte domaine individuelle (capturée séparément) ─────────────────────────

export function DomainCard({
  domain,
  cardIndex,
}: {
  domain: GuidedDomainReport
  cardIndex: number
}) {
  const color = scoreColor(domain.score)

  return (
    <div
      data-guided-pdf-card={String(cardIndex).padStart(4, '0')}
      style={{
        width: 794,           // même largeur que Cover/Overview → mmPerPx cohérent
        padding: '0 50px',    // marges latérales
        paddingBottom: 8,     // marge basse
        boxSizing: 'border-box',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        background: '#ffffff',
      }}
    >
      {/* ── En-tête de phase (uniquement pour le 1er domaine de la phase) ── */}
      {domain.isFirstInPhase && domain.phaseColor && (
        <div style={{
          background: domain.phaseColor, padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 0, borderRadius: '10px 10px 0 0',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            border: '2px solid rgba(255,255,255,0.44)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: 'white', flexShrink: 0,
            fontFamily: 'Arial Black, Arial, sans-serif',
          }}>
            {domain.phase}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              Phase {domain.phase}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {domain.phaseLabel}
            </div>
          </div>
          {domain.phaseEvaluated !== undefined && (
            <div style={{ textAlign: 'right' }}>
              {(domain.phaseAvgScore ?? 0) > 0 && (
                <div style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                  {(domain.phaseAvgScore ?? 0).toFixed(1)}
                  <span style={{ fontSize: 12, opacity: 0.6 }}>/5</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'Arial, sans-serif' }}>
                {domain.phaseEvaluated}/{domain.phaseTotal} evalues
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Carte domaine ── */}
      <div style={{
        border: '1.5px solid #e2e8f0',
        borderTop: domain.isFirstInPhase ? 'none' : '1.5px solid #e2e8f0',
        borderRadius: domain.isFirstInPhase ? '0 0 10px 10px' : 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {/* Header domaine */}
        <div style={{ background: '#f8fafc', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{domain.qcIcone}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 2, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {domain.domainName}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
              {domain.qcNom} · ISO {domain.isoRef} · {domain.domainId}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {domain.score > 0 ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                  {domain.score}
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, fontFamily: 'Arial, sans-serif' }}>/5</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
                  {domain.maturityName}
                </div>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
                Non evalue
              </span>
            )}
          </div>
        </div>

        {/* Rationale */}
        <div style={{ padding: '8px 16px 6px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.55, fontFamily: 'Arial, Helvetica, sans-serif', fontStyle: 'italic' }}>
            {domain.rationale}
          </div>
        </div>

        {/* Barre de maturité */}
        {domain.score > 0 && domain.phaseBgColor && (
          <div style={{ padding: '6px 16px', background: domain.phaseBgColor, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, width: 64, flexShrink: 0, fontFamily: 'Arial, sans-serif' }}>Maturite</span>
            <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(domain.score / 5) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 28, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {domain.score}/5
            </span>
          </div>
        )}

        {/* Actions clés focus */}
        {domain.focusActions.length > 0 && (
          <div style={{ padding: '10px 16px 12px' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Arial, sans-serif' }}>
              Actions cles pour demarrer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {domain.focusActions.map(action => {
                const isDone = action.na || action.progress >= 10
                const pColor = progressColor(action.progress)
                return (
                  <div key={action.key} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Ligne action */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      {/* Badge état */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                        background: action.na ? '#f1f5f9' : action.progress >= 10 ? '#dcfce7' : action.progress > 0 ? `${pColor}1a` : '#f1f5f9',
                        border: `1.5px solid ${action.na ? '#cbd5e1' : action.progress >= 10 ? '#86efac' : action.progress > 0 ? pColor : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: action.na ? '#94a3b8' : action.progress >= 10 ? '#16a34a' : action.progress > 0 ? pColor : '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
                          {action.na ? '—' : action.progress >= 10 ? '✓' : action.progress > 0 ? String(action.progress) : '·'}
                        </span>
                      </div>
                      {/* Texte de l'action */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: isDone ? '#9ca3af' : '#1e293b', lineHeight: 1.45, textDecoration: isDone ? 'line-through' : 'none', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                          {action.text}
                        </div>
                        {action.progress > 0 && !action.na && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                            <div style={{ width: 90, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${action.progress * 10}%`, height: '100%', background: pColor, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, color: pColor, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                              {action.progress}/10
                            </span>
                            {action.progress >= 10 && (
                              <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Terminee</span>
                            )}
                          </div>
                        )}
                        {action.na && (
                          <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
                            Non applicable
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Note texte brut (si présente) */}
                    {action.note && action.note.trim() && (
                      <div style={{ marginLeft: 29, marginTop: 5 }}>
                        <div style={{
                          background: '#f5f3ff', borderLeft: '3px solid #6366f1',
                          borderRadius: '0 7px 7px 0', padding: '7px 11px',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', marginBottom: 4, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            Notes
                          </div>
                          <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {action.note.trim()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Container des cartes (rendu hors-écran, capturé par exportGuidedPDF) ────

export function DomainCardsContainer({ phases }: { phases: GuidedPhaseReport[] }) {
  let cardIndex = 0
  return (
    <div
      id="guided-pdf-cards"
      style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 794, boxSizing: 'border-box' }}
    >
      {phases.map(phase =>
        phase.domains.map(domain => {
          const idx = cardIndex++
          return <DomainCard key={domain.domainId} domain={domain} cardIndex={idx} />
        })
      )}
    </div>
  )
}

// ─── Page(s) Analyse IA — pagination automatique ──────────────────────────────

/** Estime la hauteur en pixels d'un paragraphe (police 11px, ~115 chars/ligne) */
function estimateParaHeightPx(para: string): number {
  const LINE_H = 18.7
  const CHARS_PER_LINE = 115
  const isBold = /^\*\*.+?\*\*/.test(para)
  if (isBold) {
    const body = para.replace(/^\*\*.+?\*\*/, '').trim()
    const bodyLines = Math.max(1, Math.ceil(body.length / CHARS_PER_LINE))
    return 36 + bodyLines * LINE_H + 20
  }
  const lines = Math.max(1, Math.ceil(para.length / CHARS_PER_LINE))
  return lines * LINE_H + 16
}

/** Répartit les paragraphes en groupes tenant sur une page A4.
 *  Un titre gras (**…**) reste toujours avec le paragraphe suivant (orphan control). */
function packAIParagraphs(paragraphs: string[]): string[][] {
  const FIRST_PAGE_CONTENT_H = 820
  const NEXT_PAGE_CONTENT_H  = 950
  const isBoldTitle = (p: string) => /^\*\*.+?\*\*/.test(p)

  const pages: string[][] = []
  let current: string[] = []
  let usedH = 0
  let maxH = FIRST_PAGE_CONTENT_H

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const h = estimateParaHeightPx(para)
    const nextH = (isBoldTitle(para) && i + 1 < paragraphs.length)
      ? estimateParaHeightPx(paragraphs[i + 1])
      : 0

    if (usedH + h + nextH > maxH && current.length > 0) {
      pages.push(current)
      current = [para]
      usedH = h
      maxH = NEXT_PAGE_CONTENT_H
    } else {
      current.push(para)
      usedH += h
    }
  }
  if (current.length > 0) pages.push(current)
  return pages
}

/** Rendu d'un paragraphe IA (bold titre ou texte simple) */
function AIParaBlock({ para, idx }: { para: string; idx: number }) {
  const text = para.trim()
  const boldMatch = text.match(/^\*\*(.+?)\*\*([\s\S]*)$/)
  if (boldMatch) {
    const title = boldMatch[1].trim()
    const body  = boldMatch[2].trim()
    return (
      <div key={idx} style={{ marginBottom: 20 }}>
        <div style={{
          display: 'inline-block', background: '#ede9fe', color: '#5b21b6',
          fontSize: 11, fontWeight: 700, fontFamily: 'Arial, Helvetica, sans-serif',
          padding: '4px 12px', borderRadius: 6, marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: 1,
        }}>{title}</div>
        {body && (
          <div style={{ fontSize: 11, lineHeight: 1.7, color: '#1f2937', fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'justify' }}>
            {body}
          </div>
        )}
      </div>
    )
  }
  return (
    <div key={idx} style={{ fontSize: 11, lineHeight: 1.7, color: '#1f2937', fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'justify', marginBottom: 16 }}>
      {text}
    </div>
  )
}

export function AIAnalysisPages({ data }: { data: GuidedPDFData }) {
  if (!data.aiAnalysis) return null

  const allParas = data.aiAnalysis.split(/\n\n+/).filter(p => p.trim())
  const pageGroups = packAIParagraphs(allParas)

  return (
    <>
      {pageGroups.map((paras, pageIdx) => (
        <div
          key={pageIdx}
          data-guided-pdf-page={`4-ai-p${String(pageIdx).padStart(2, '0')}`}
          style={{
            width: 794, height: 1123,
            background: '#fff',
            fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
            color: '#111827',
            boxSizing: 'border-box',
            padding: '48px 52px 40px',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header — plein sur la première page, compact sur les suivantes */}
          {pageIdx === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, paddingBottom: 16, borderBottom: '2px solid #e0e7ff', flexShrink: 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed, #4338ca)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
                  Analyse RSE — Intelligence artificielle
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
                  Analyse generee par Claude (Anthropic) · {data.organisation ?? ''} · {data.year}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid #e0e7ff', flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'linear-gradient(135deg, #7c3aed, #4338ca)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Analyse IA (suite {pageIdx + 1}/{pageGroups.length})
              </div>
            </div>
          )}

          {/* Contenu */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {paras.map((para, i) => <AIParaBlock key={i} para={para} idx={i} />)}
          </div>

          {/* Footer */}
          <div style={{ paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: '#cbd5e1', fontFamily: 'Arial, sans-serif' }}>
              Genere avec Sens&apos;ethO Apps · apps.sensetho.com
            </span>
            <span style={{ fontSize: 9, color: '#cbd5e1', fontFamily: 'Arial, sans-serif' }}>
              Analyse IA{pageGroups.length > 1 ? ` · ${pageIdx + 1}/${pageGroups.length}` : ''}
            </span>
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Composant principal (rendu hors-écran) ───────────────────────────────────

export default function GuidedDiagnosticPDFReport({ data }: { data: GuidedPDFData }) {
  return (
    <div
      id="guided-pdf-report"
      aria-hidden="true"
      style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}
    >
      <CoverPage data={data} />
      <OverviewPage data={data} />
      <DomainCardsContainer phases={data.phases} />
      {data.aiAnalysis && <AIAnalysisPages data={data} />}
    </div>
  )
}

// ─── Fonction d'export PDF ────────────────────────────────────────────────────

/**
 * Capture le DOM rendu hors-écran via html2canvas et assemble les pages
 * en un fichier PDF A4 avec jsPDF.
 *
 * Architecture :
 *  1. Pages fixes  : [data-guided-pdf-page]   → capturées en pleine hauteur
 *  2. Cartes dom.  : [data-guided-pdf-card]   → capturées séparément, packées
 *     verticalement pour remplir les pages sans jamais couper une carte.
 *
 * @param data  - Données GuidedPDFData pour le rapport
 * @param filename - Nom du fichier PDF (défaut: "diagnostic-rse.pdf")
 */
export async function exportGuidedPDF(
  data: GuidedPDFData,
  filename = 'diagnostic-rse.pdf',
): Promise<void> {
  // Import dynamique pour éviter le bundle côté serveur
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  // ── Paramètres A4 ───────────────────────────────────────────────────────────
  const PDF_W_MM  = 210
  const PDF_H_MM  = 297
  const SCALE     = 2       // résolution ×2 pour qualité print
  const PX_WIDTH  = 794     // largeur des pages DOM (= A4 @ 96dpi)

  // mm par pixel source (avant scale)
  const mmPerPx = PDF_W_MM / PX_WIDTH

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let pageNum = 0

  /** Capture un élément DOM et ajoute une page PDF.
   *  @param el         Élément à capturer
   *  @param heightMM   Hauteur à utiliser dans le PDF (défaut : pleine page A4)
   */
  async function addElementAsPage(el: HTMLElement, heightMM = PDF_H_MM): Promise<void> {
    const canvas = await html2canvas(el, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const imgData = canvas.toDataURL('image/png')
    const imgH = (canvas.height / SCALE) * mmPerPx

    if (pageNum > 0) pdf.addPage()
    pageNum++
    pdf.addImage(imgData, 'PNG', 0, 0, PDF_W_MM, Math.min(imgH, heightMM))
  }

  // ── 1. Pages fixes (couverture, vue d'ensemble, analyse IA) ─────────────────
  const fixedPages = Array.from(
    document.querySelectorAll<HTMLElement>('[data-guided-pdf-page]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-guided-pdf-page') ?? ''
    const kb = b.getAttribute('data-guided-pdf-page') ?? ''
    return ka.localeCompare(kb)
  })

  for (const page of fixedPages) {
    await addElementAsPage(page)
  }

  // ── 2. Cartes domaines — packing sans coupure ────────────────────────────────
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-guided-pdf-card]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-guided-pdf-card') ?? ''
    const kb = b.getAttribute('data-guided-pdf-card') ?? ''
    return ka.localeCompare(kb)
  })

  if (cards.length > 0) {
    // Hauteur disponible par page de cartes (marges haut + bas = 12mm chacune)
    const MARGIN_MM  = 12
    const AVAIL_H_MM = PDF_H_MM - MARGIN_MM * 2

    // Grouper les cartes par page en respectant la hauteur max
    type CardGroup = HTMLElement[]
    const groups: CardGroup[] = []
    let currentGroup: CardGroup = []
    let currentHMM = 0

    for (const card of cards) {
      const cardHPx  = card.getBoundingClientRect().height || card.offsetHeight
      const cardHMM  = cardHPx * mmPerPx

      if (currentHMM + cardHMM > AVAIL_H_MM && currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = [card]
        currentHMM   = cardHMM
      } else {
        currentGroup.push(card)
        currentHMM  += cardHMM
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup)

    // Pour chaque groupe : créer un wrapper temporaire, capturer, supprimer
    for (const group of groups) {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'width:794px',
        'background:#ffffff',
        'box-sizing:border-box',
        'padding:12px 0',
      ].join(';')

      // Cloner les cartes dans le wrapper (pour ne pas déplacer les originaux)
      group.forEach(card => {
        const clone = card.cloneNode(true) as HTMLElement
        wrapper.appendChild(clone)
      })

      document.body.appendChild(wrapper)
      await addElementAsPage(wrapper)
      document.body.removeChild(wrapper)
    }
  }

  // ── 3. Téléchargement ────────────────────────────────────────────────────────
  pdf.save(filename)
}
