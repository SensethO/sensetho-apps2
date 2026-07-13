'use client'

/**
 * ISO26000PDFReport — composant visuel pour export html2canvas → jsPDF.
 * Rapport dédié du Diagnostic RSE ISO 26000 (7 questions centrales,
 * 37 domaines d'action), aligné sur GuidedDiagnosticPDFReport.
 *
 * Architecture de capture :
 *  - Pages fixes (couverture, vue d'ensemble, analyse IA) : data-iso-pdf-page
 *  - Cartes domaines + plan d'actions : data-iso-pdf-card
 *    → packées par exportIsoPDF() avec suivi de Y, jamais coupées.
 *
 * IMPORTANT : Styles UNIQUEMENT inline — html2canvas ne lit pas Tailwind.
 */

import React from 'react'

// ─── Types exportés ──────────────────────────────────────────────────────────

/** Action d'un domaine (progression 0–10) */
export interface IsoPDFAction {
  key: string
  text: string
  progress: number   // 0–10
  na: boolean
  note?: string      // texte brut (plain text)
}

/** Domaine d'action ISO 26000 */
export interface IsoPDFDomain {
  id: string
  isoRef: string
  nom: string
  description: string
  score: number        // 0–5
  scoreLabel: string
  actions: IsoPDFAction[]
  kpis: string[]
  ods: string[]
  note?: string        // note du domaine (texte brut)
  // Contexte QC — présent si premier domaine de la question centrale
  isFirstInQc: boolean
  qcNom?: string
  qcIsoRef?: string
  qcIcone?: string
  qcCouleur?: string
  qcScore?: number
  qcEvaluated?: number
  qcTotal?: number
}

/** Question centrale ISO 26000 */
export interface IsoPDFQc {
  id: string
  isoRef: string
  nom: string
  icone: string
  pilier: 'G' | 'E' | 'S'
  couleur: string
  score: number        // moyenne 0–5 des domaines évalués
  evaluated: number
  total: number
  domaines: IsoPDFDomain[]
}

/** Action assignée du plan d'actions (IsoActionPlanBlock) */
export interface IsoPlanAction {
  id: string
  titre: string
  description: string | null
  priorite: string
  statut: string
  echeance: string | null
  responsable: string | null
}

/** Score par pilier G / E / S */
export interface IsoPilierScore {
  pilier: 'G' | 'E' | 'S'
  label: string
  avg: number
  count: number
  total: number
}

/** Données complètes passées au composant PDF */
export interface IsoPDFData {
  organisation: string | null
  year: number
  date: string             // ex : "13 juillet 2026"
  evaluatedCount: number
  totalCount: number
  globalScore: number      // 0–100 (%)
  pilierScores: IsoPilierScore[]
  oddCovered: string[]
  qcs: IsoPDFQc[]
  planActions: IsoPlanAction[]
  aiAnalysis?: string | null
}

// ─── Helper : htmlToText (notes rich text → texte brut) ──────────────────────

export function isoHtmlToText(html: string): string {
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

/** Couleurs de maturité 0–5 — alignées sur les niveaux affichés dans l'app */
const MATURITY_COLORS = ['#9ca3af', '#94a3b8', '#fb923c', '#facc15', '#34d399', '#6366f1']

function scoreColor(s: number): string {
  const idx = Math.max(0, Math.min(5, Math.round(s)))
  return MATURITY_COLORS[idx]
}

/** Couleur de progression 0–10 — même logique que le questionnaire */
function progressColor(p: number): string {
  if (p >= 9) return '#22c55e'
  if (p >= 7) return '#84cc16'
  if (p >= 5) return '#eab308'
  if (p >= 3) return '#f97316'
  if (p >= 1) return '#ef4444'
  return '#d1d5db'
}

const ODD_COLORS: Record<string, string> = {
  ODD1: '#E5243B', ODD2: '#DDA63A', ODD3: '#4C9F38', ODD4: '#C5192D', ODD5: '#FF3A21',
  ODD6: '#26BDE2', ODD7: '#FCC30B', ODD8: '#A21942', ODD9: '#FD6925', ODD10: '#DD1367',
  ODD11: '#FD9D24', ODD12: '#BF8B2E', ODD13: '#3F7E44', ODD14: '#0A97D9', ODD15: '#56C02B',
  ODD16: '#00689D', ODD17: '#19486A',
}

const PILIER_COLORS: Record<'G' | 'E' | 'S', string> = {
  G: '#60a5fa',
  E: '#4ade80',
  S: '#f87171',
}

const SCORE_LABELS_PDF = ['Non évalué', 'Inexistant', 'Initié', 'En développement', 'Maîtrisé', 'Exemplaire']
const SCORE_DESCS_PDF = [
  'Domaine non encore considéré',
  'Aucune action engagée sur ce domaine',
  'Premières actions ponctuelles engagées',
  'Démarche en construction, actions partielles',
  'Processus formalisés et suivis régulièrement',
  'Pratique exemplaire, amélioration continue',
]

// ─── Score Ring SVG (score global en %) ──────────────────────────────────────

function GlobalScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
      {score > 0 && (
        <circle cx="60" cy="60" r={r} fill="none" stroke="white" strokeWidth="9"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 60 60)" />
      )}
      <text x="60" y="56" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="Arial, sans-serif">
        {score}%
      </text>
      <text x="60" y="76" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="Arial, sans-serif">
        score global
      </text>
    </svg>
  )
}

// ─── Page 1 — Couverture ──────────────────────────────────────────────────────

export function IsoCoverPage({ data }: { data: IsoPDFData }) {
  return (
    <div
      data-iso-pdf-page="0-cover"
      style={{
        width: 794, height: 1123,
        background: 'linear-gradient(148deg, #1e1b4b 0%, #4f46e5 45%, #312e81 100%)',
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
        <div style={{ fontSize: 80, marginBottom: 28, lineHeight: 1 }}>🔍</div>
        <div style={{ fontSize: 12, letterSpacing: 4, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
          ISO 26000 — Responsabilité sociétale
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, margin: '0 0 6px', lineHeight: 1.1, letterSpacing: '-1.5px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
          Diagnostic RSE ISO 26000
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.58)', marginBottom: 46, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          7 questions centrales · 37 domaines d&rsquo;action
        </div>

        {/* Bloc organisation */}
        <div style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: '22px 48px', marginBottom: 46, minWidth: 340 }}>
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
            Année {data.year}
          </div>
          <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', margin: '14px auto', borderRadius: 2 }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: 'Arial, sans-serif' }}>
            {data.evaluatedCount} / {data.totalCount} domaines d&rsquo;action évalués
          </div>
        </div>

        {/* Score ring */}
        <GlobalScoreRing score={data.globalScore} size={160} />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 10, fontFamily: 'Arial, sans-serif' }}>
          Score global RSE — domaines évalués
        </div>
      </div>

      {/* Barre questions centrales */}
      <div style={{ height: 5, display: 'flex' }}>
        {data.qcs.map(qc => (
          <div key={qc.id} style={{ flex: 1, background: qc.couleur }} />
        ))}
      </div>

      {/* Pied */}
      <div style={{ padding: '16px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial, sans-serif' }}>
          Généré avec Sens&apos;ethO Apps · apps.sensetho.com
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'Arial, sans-serif' }}>Page 1</span>
      </div>
    </div>
  )
}

// ─── Page 2 — Vue d'ensemble ─────────────────────────────────────────────────

export function IsoOverviewPage({ data }: { data: IsoPDFData }) {
  return (
    <div
      data-iso-pdf-page="1-overview"
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
            Diagnostic RSE ISO 26000
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            Vue d&rsquo;ensemble
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#a5b4fc', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {data.globalScore}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'Arial, sans-serif' }}>
            Score global RSE
          </div>
        </div>
      </div>

      {/* Barre QC colorée */}
      <div style={{ height: 4, display: 'flex' }}>
        {data.qcs.map(qc => (
          <div key={qc.id} style={{ flex: 1, background: qc.couleur }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: '24px 52px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Synthèse par question centrale */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Synthèse par question centrale
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.qcs.map(qc => (
              <div key={qc.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 10,
                border: `1.5px solid ${qc.couleur}40`, background: `${qc.couleur}0d`,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{qc.icone}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    {qc.nom}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
                    ISO {qc.isoRef} · {qc.evaluated}/{qc.total} domaines évalués
                  </div>
                </div>
                <div style={{ width: 120, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ width: `${(qc.score / 5) * 100}%`, height: '100%', background: qc.couleur, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: qc.evaluated > 0 ? qc.couleur : '#9ca3af', minWidth: 44, textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
                  {qc.evaluated > 0 ? `${qc.score.toFixed(1)}/5` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Score par pilier */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Score par pilier
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {data.pilierScores.map(p => (
              <div key={p.pilier} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>{p.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: PILIER_COLORS[p.pilier], fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {p.count > 0 ? `${p.avg.toFixed(1)}/5` : '—'}
                  </span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ width: `${(p.avg / 5) * 100}%`, height: '100%', background: PILIER_COLORS[p.pilier], borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
                  {p.count}/{p.total} domaines évalués
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ODD adressés */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            ODD adressés ({data.oddCovered.length}/17)
          </div>
          {data.oddCovered.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.oddCovered.map(odd => (
                <div key={odd} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: ODD_COLORS[odd] ?? '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: 'white', fontFamily: 'Arial, sans-serif' }}>
                    {odd.replace('ODD', '')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
              Aucun domaine évalué pour le moment
            </div>
          )}
        </div>

        {/* Échelle de maturité */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
            Échelle de maturité
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SCORE_LABELS_PDF.map((label, n) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '5px 12px', background: `${scoreColor(n)}10`,
                borderRadius: 8, border: `1px solid ${scoreColor(n)}28`,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: `${scoreColor(n)}20`,
                  border: `2px solid ${scoreColor(n)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: scoreColor(n), fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {n}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 10.5, color: '#64748b', marginLeft: 8, fontFamily: 'Arial, sans-serif' }}>
                    — {SCORE_DESCS_PDF[n]}
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
          Diagnostic RSE ISO 26000 · {data.organisation ?? ''} · {data.year}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>Page 2</span>
      </div>
    </div>
  )
}

// ─── Carte domaine individuelle (capturée séparément) ─────────────────────────

export function IsoDomainCard({
  domain,
  cardIndex,
}: {
  domain: IsoPDFDomain
  cardIndex: number
}) {
  const color = scoreColor(domain.score)
  const visibleActions = domain.actions

  return (
    <div
      data-iso-pdf-card={String(cardIndex).padStart(4, '0')}
      style={{
        width: 794,
        padding: '0 50px',
        paddingBottom: 8,
        boxSizing: 'border-box',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',
        background: '#ffffff',
      }}
    >
      {/* ── En-tête de question centrale (1er domaine de la QC uniquement) ── */}
      {domain.isFirstInQc && domain.qcCouleur && (
        <div style={{
          background: domain.qcCouleur, padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 0, borderRadius: '10px 10px 0 0',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            border: '2px solid rgba(255,255,255,0.44)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, flexShrink: 0,
          }}>
            {domain.qcIcone}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              Question centrale · ISO {domain.qcIsoRef}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {domain.qcNom}
            </div>
          </div>
          {domain.qcEvaluated !== undefined && (
            <div style={{ textAlign: 'right' }}>
              {(domain.qcScore ?? 0) > 0 && (
                <div style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                  {(domain.qcScore ?? 0).toFixed(1)}
                  <span style={{ fontSize: 12, opacity: 0.6 }}>/5</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: 'Arial, sans-serif' }}>
                {domain.qcEvaluated}/{domain.qcTotal} évalués
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Carte domaine ── */}
      <div style={{
        border: '1.5px solid #e2e8f0',
        borderTop: domain.isFirstInQc ? 'none' : '1.5px solid #e2e8f0',
        borderRadius: domain.isFirstInQc ? '0 0 10px 10px' : 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {/* Header domaine */}
        <div style={{ background: '#f8fafc', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginBottom: 2, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {domain.nom}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
              ISO {domain.isoRef} · {domain.id}
              {domain.ods.length > 0 && ` · ${domain.ods.map(o => o.replace('ODD', 'ODD ')).join(', ')}`}
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
                  {domain.scoreLabel}
                </div>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>
                Non évalué
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '7px 16px 6px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
          <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.5, fontFamily: 'Arial, Helvetica, sans-serif', fontStyle: 'italic' }}>
            {domain.description}
          </div>
        </div>

        {/* Barre de maturité */}
        {domain.score > 0 && (
          <div style={{ padding: '6px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, width: 64, flexShrink: 0, fontFamily: 'Arial, sans-serif' }}>Maturité</span>
            <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(domain.score / 5) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 28, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              {domain.score}/5
            </span>
          </div>
        )}

        {/* Actions */}
        {visibleActions.length > 0 && (
          <div style={{ padding: '9px 16px 10px' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7, fontFamily: 'Arial, sans-serif' }}>
              Actions à évaluer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleActions.map(action => {
                const isDone = action.na || action.progress >= 10
                const pColor = progressColor(action.progress)
                return (
                  <div key={action.key} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      {/* Badge état */}
                      <div style={{
                        width: 19, height: 19, borderRadius: 5, flexShrink: 0, marginTop: 1,
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
                        <div style={{ fontSize: 11, color: isDone ? '#9ca3af' : '#1e293b', lineHeight: 1.4, textDecoration: isDone ? 'line-through' : 'none', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                          {action.text}
                        </div>
                        {action.progress > 0 && !action.na && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                            <div style={{ width: 90, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${action.progress * 10}%`, height: '100%', background: pColor, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, color: pColor, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                              {action.progress}/10
                            </span>
                            {action.progress >= 10 && (
                              <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Terminée</span>
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
                      <div style={{ marginLeft: 28, marginTop: 4 }}>
                        <div style={{
                          background: '#f5f3ff', borderLeft: '3px solid #6366f1',
                          borderRadius: '0 7px 7px 0', padding: '6px 11px',
                        }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#4338ca', marginBottom: 3, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            Notes
                          </div>
                          <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'Arial, Helvetica, sans-serif' }}>
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

        {/* KPIs */}
        {domain.kpis.length > 0 && (
          <div style={{ padding: '8px 16px 10px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Arial, sans-serif' }}>
              Indicateurs clés (KPIs)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {domain.kpis.map((kpi, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', flexShrink: 0, fontFamily: 'Arial, sans-serif' }}>→</span>
                  <span style={{ fontSize: 10, color: '#475569', lineHeight: 1.45, fontFamily: 'Arial, Helvetica, sans-serif' }}>{kpi}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note de domaine (si présente) */}
        {domain.note && domain.note.trim() && (
          <div style={{ padding: '8px 16px 10px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{
              background: '#f5f3ff', borderLeft: '3px solid #6366f1',
              borderRadius: '0 7px 7px 0', padding: '7px 11px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', marginBottom: 4, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Notes du domaine
              </div>
              <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                {domain.note.trim()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Plan d'actions assignées — cartes packées ────────────────────────────────

const PLAN_STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PLAN_STATUT_COLORS: Record<string, string> = { a_faire: '#94a3b8', en_cours: '#f59e0b', termine: '#22c55e' }
const PLAN_PRIO_LABELS: Record<string, string> = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
const PLAN_PRIO_COLORS: Record<string, string> = { haute: '#ef4444', moyenne: '#f59e0b', basse: '#64748b' }

function formatPlanDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function IsoPlanHeaderCard({ cardIndex, count }: { cardIndex: number; count: number }) {
  return (
    <div
      data-iso-pdf-card={String(cardIndex).padStart(4, '0')}
      style={{
        width: 794, padding: '0 50px', paddingBottom: 8, boxSizing: 'border-box',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif', background: '#ffffff',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #6366f1, #4338ca)', padding: '13px 16px',
        display: 'flex', alignItems: 'center', gap: 14, borderRadius: 10,
      }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
            Plan d&rsquo;actions
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '-0.3px', fontFamily: 'Arial Black, Arial, sans-serif' }}>
            Actions assignées
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Arial, sans-serif' }}>
          {count} action{count > 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

export function IsoPlanActionCard({ action, cardIndex }: { action: IsoPlanAction; cardIndex: number }) {
  const statutColor = PLAN_STATUT_COLORS[action.statut] ?? '#94a3b8'
  const prioColor = PLAN_PRIO_COLORS[action.priorite] ?? '#64748b'
  return (
    <div
      data-iso-pdf-card={String(cardIndex).padStart(4, '0')}
      style={{
        width: 794, padding: '0 50px', paddingBottom: 6, boxSizing: 'border-box',
        fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif', background: '#ffffff',
      }}
    >
      <div style={{
        border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {action.titre}
          </div>
          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
            Responsable : {action.responsable ?? '—'} · Échéance : {formatPlanDate(action.echeance)}
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, color: prioColor, border: `1.5px solid ${prioColor}`,
          padding: '2px 8px', borderRadius: 20, flexShrink: 0, fontFamily: 'Arial, sans-serif',
        }}>
          {PLAN_PRIO_LABELS[action.priorite] ?? action.priorite}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'white', background: statutColor,
          padding: '3px 9px', borderRadius: 20, flexShrink: 0, fontFamily: 'Arial, sans-serif',
        }}>
          {PLAN_STATUT_LABELS[action.statut] ?? action.statut}
        </span>
      </div>
    </div>
  )
}

// ─── Container des cartes (rendu hors-écran, capturé par exportIsoPDF) ────────

export function IsoCardsContainer({ data }: { data: IsoPDFData }) {
  let cardIndex = 0
  return (
    <div
      id="iso-pdf-cards"
      style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 794, boxSizing: 'border-box' }}
    >
      {data.qcs.map(qc =>
        qc.domaines.map(domain => {
          const idx = cardIndex++
          return <IsoDomainCard key={domain.id} domain={domain} cardIndex={idx} />
        })
      )}
      {data.planActions.length > 0 && (
        <>
          <IsoPlanHeaderCard cardIndex={cardIndex++} count={data.planActions.length} />
          {data.planActions.map(action => {
            const idx = cardIndex++
            return <IsoPlanActionCard key={action.id} action={action} cardIndex={idx} />
          })}
        </>
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

/** Répartit les paragraphes en groupes tenant sur une page A4. */
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

export function IsoAIAnalysisPages({ data }: { data: IsoPDFData }) {
  if (!data.aiAnalysis) return null

  const allParas = data.aiAnalysis.split(/\n\n+/).filter(p => p.trim())
  const pageGroups = packAIParagraphs(allParas)

  return (
    <>
      {pageGroups.map((paras, pageIdx) => (
        <div
          key={pageIdx}
          data-iso-pdf-page={`4-ai-p${String(pageIdx).padStart(2, '0')}`}
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
                  Analyse générée par Claude (Anthropic) · {data.organisation ?? ''} · {data.year}
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

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {paras.map((para, i) => <AIParaBlock key={i} para={para} idx={i} />)}
          </div>

          <div style={{ paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: '#cbd5e1', fontFamily: 'Arial, sans-serif' }}>
              Généré avec Sens&apos;ethO Apps · apps.sensetho.com
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

export default function ISO26000PDFReport({ data }: { data: IsoPDFData }) {
  return (
    <div
      id="iso-pdf-report"
      aria-hidden="true"
      style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}
    >
      <IsoCoverPage data={data} />
      <IsoOverviewPage data={data} />
      <IsoCardsContainer data={data} />
      {data.aiAnalysis && <IsoAIAnalysisPages data={data} />}
    </div>
  )
}

// ─── Fonction d'export PDF ────────────────────────────────────────────────────

/**
 * Capture le DOM rendu hors-écran via html2canvas et assemble les pages
 * en un fichier PDF A4 avec jsPDF.
 *
 * Architecture :
 *  1. Pages fixes  : [data-iso-pdf-page]  → capturées en pleine hauteur
 *  2. Cartes       : [data-iso-pdf-card]  → capturées séparément, packées
 *     verticalement pour remplir les pages sans jamais couper une carte.
 */
export async function exportIsoPDF(
  data: IsoPDFData,
  filename = 'diagnostic-iso26000.pdf',
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

  const mmPerPx = PDF_W_MM / PX_WIDTH

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let pageNum = 0

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
    document.querySelectorAll<HTMLElement>('[data-iso-pdf-page]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-iso-pdf-page') ?? ''
    const kb = b.getAttribute('data-iso-pdf-page') ?? ''
    return ka.localeCompare(kb)
  })

  for (const page of fixedPages) {
    await addElementAsPage(page)
  }

  // ── 2. Cartes — packing sans coupure ─────────────────────────────────────────
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-iso-pdf-card]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-iso-pdf-card') ?? ''
    const kb = b.getAttribute('data-iso-pdf-card') ?? ''
    return ka.localeCompare(kb)
  })

  if (cards.length > 0) {
    const MARGIN_MM  = 12
    const AVAIL_H_MM = PDF_H_MM - MARGIN_MM * 2

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
