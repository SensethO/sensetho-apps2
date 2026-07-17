'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'
import QontoImportModal from './QontoImportModal'

// ─── Budget entreprise — variante entreprise de l'app « Budget association » ──
// Plan comptable GÉNÉRAL (classes 1 à 7, comptes typés charge / produit / actif
// / passif), « Centres de coût » à la place des « actions », et deux vues
// comptables supplémentaires : Compte de résultat et Bilan (calculées côté
// client à partir des lignes consolidées).
// API : /api/budget-entreprise/* — la « structure » = l'organisation courante
// du RseAppShell (structure_id = org.id).

const API = '/api/budget-entreprise'

// ── Types (formes des réponses des handlers) ─────────────────────────────────

type CompteType = 'charge' | 'produit' | 'actif' | 'passif'

interface Compte {
  id: string
  numero: string
  libelle: string
  type: CompteType
  parent_id: string | null
  sort_order: number
}
interface Detail {
  id: string
  ligne_id: string
  commentaire: string
  montant_previsionnel: number
  montant_realise: number
  sort_order: number
  draft?: boolean // brouillon local uniquement — non persisté en base
}
interface Ligne {
  id: string
  exercice_id: string
  compte_id: string
  affectation_type: 'general' | 'centre_cout'
  centre_cout_id: string | null
  montant_previsionnel: number
  montant_realise: number
  notes: string | null
  contribue_budget_general: boolean
  compte: Compte
  details: Detail[]
}
interface Structure { id: string; raison_sociale: string }
interface Exercice {
  id: string
  nom: string
  date_debut: string
  date_fin: string
  statut: 'ouvert' | 'cloture' | 'archive'
  notes: string | null
  structure_id: string | null
  structure: Structure | null
  deleted_at?: string | null
}
interface CentreCout {
  id: string
  code: string
  nom: string
  statut: 'actif' | 'clos'
}
interface CentreCoutSub extends CentreCout {
  total_charges_prev: number
  total_produits_prev: number
  total_realise: number
}
interface Modification {
  id: string
  ligne_id: string
  champ: string
  ancienne_valeur: string | null
  nouvelle_valeur: string | null
  motif: string | null
  modified_at: string
  modified_by: string | null
}
interface SousBudget {
  key: string
  label: string
  icon: string
  affectation_type: 'general' | 'centre_cout'
  centre_cout_id?: string
}

const SOUS_BUDGET_GENERAL: SousBudget = {
  key: 'general',
  label: 'Budget général',
  icon: '🏢',
  affectation_type: 'general',
}

function centreIcon(statut: CentreCout['statut']): string {
  return statut === 'clos' ? '📦' : '🎯'
}
function centreLabel(c: CentreCout): string {
  return c.code ? `${c.code} · ${c.nom}` : c.nom
}
function centreToSB(c: CentreCout): SousBudget {
  return { key: c.id, label: centreLabel(c), icon: centreIcon(c.statut), affectation_type: 'centre_cout', centre_cout_id: c.id }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
function months(d1: string, d2: string): number {
  const a = new Date(d1), b = new Date(d2)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}
function parseAmt(s: string): number {
  return parseFloat(s.replace(',', '.').replace(/\s/g, '')) || 0
}

// ── Couleurs sémantiques (compatibles clair / sombre via rgba) ────────────────

const RED = '#dc2626'
const RED_BG = 'rgba(220,38,38,0.08)'
const GREEN = '#16a34a'
const GREEN_BG = 'rgba(22,163,74,0.08)'
const AMBER = '#d97706'
const AMBER_BG = 'rgba(217,119,6,0.12)'
const BLUE = '#2563eb'
const BLUE_BG = 'rgba(37,99,235,0.08)'
const VIOLET = '#7c3aed'
const VIOLET_BG = 'rgba(124,58,237,0.08)'

const SECTION_STYLE: Record<CompteType, { color: string; bg: string }> = {
  charge: { color: RED, bg: RED_BG },
  produit: { color: GREEN, bg: GREEN_BG },
  actif: { color: BLUE, bg: BLUE_BG },
  passif: { color: VIOLET, bg: VIOLET_BG },
}

const STATUT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  ouvert: { label: 'Ouvert', color: 'var(--accent)', bg: 'rgba(99,102,241,0.12)' },
  cloture: { label: 'Clôturé', color: AMBER, bg: AMBER_BG },
  archive: { label: 'Archivé', color: 'var(--text-subtle)', bg: 'rgba(148,163,184,0.15)' },
}

// ── Styles réutilisables (variables CSS du thème apps2) ──────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.6rem',
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text)', fontSize: '0.88rem',
}
const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1.1rem', borderRadius: '0.6rem', background: 'var(--accent)',
  color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
}
const btnGhost: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: '0.6rem', background: 'var(--bg)',
  color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
}
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
}
const modalCard: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border)',
  width: '100%', maxWidth: 640, maxHeight: '85vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

// ══════════════════════════════════════════════════════════════════════════════
// Import Excel / CSV (format standard : Compte ; Commentaire ; Prévisionnel ; Réalisé)
// ══════════════════════════════════════════════════════════════════════════════

interface ImportRow {
  rowNum: number
  compteNumero: string
  commentaire: string
  previsionnel: number
  realise: number
  compte: Compte | null
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

function parseImportRows(raw: unknown[][], compteByNumero: Map<string, Compte>): ImportRow[] {
  if (raw.length === 0) return []
  const first = raw[0]
  const isHeader = typeof first[0] === 'string' && isNaN(Number(String(first[0]).trim()))

  let colCompte = 0, colComment = 1, colPrev = 2, colReal = 3
  if (isHeader) {
    first.forEach((h, i) => {
      if (typeof h !== 'string') return
      const n = normalizeHeader(h)
      if (n.startsWith('compte') || n === 'no' || n === 'num' || n.startsWith('numero')) colCompte = i
      else if (n.startsWith('comment') || n.startsWith('libelle') || n.startsWith('design') || n.startsWith('label')) colComment = i
      else if (n.startsWith('prev') || n.startsWith('mont') || n === 'budget' || n === 'ht') colPrev = i
      else if (n.startsWith('real') || n.startsWith('exec') || n.startsWith('engag')) colReal = i
    })
  }

  const dataRows = isHeader ? raw.slice(1) : raw
  return dataRows
    .filter(row => {
      const v = row[colCompte]
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
    .map((r, i) => {
      const compteNumero = String(r[colCompte] ?? '').trim()
      const commentaire = String(r[colComment] ?? '').trim()
      const previsionnel = parseFloat(String(r[colPrev] ?? '0').replace(/\s/g, '').replace(',', '.')) || 0
      const realise = parseFloat(String(r[colReal] ?? '0').replace(/\s/g, '').replace(',', '.')) || 0
      return {
        rowNum: isHeader ? i + 2 : i + 1,
        compteNumero,
        commentaire,
        previsionnel,
        realise,
        compte: compteByNumero.get(compteNumero) ?? null,
      }
    })
}

/** Valeur de cellule ExcelJS → chaîne (gère richText / formules). */
function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] }
    if (Array.isArray(o.richText)) return o.richText.map(r => r.text).join('')
    if (o.result !== undefined) return String(o.result)
    if (o.text !== undefined) return String(o.text)
    return ''
  }
  return String(v)
}

function parseCsvText(text: string): unknown[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return []
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  return lines.map(l => l.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1')))
}

function ImportModal({ activeSB, exerciceId, comptes, onClose, onImported }: {
  activeSB: SousBudget
  exerciceId: string
  comptes: Compte[]
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<'select' | 'preview' | 'result'>('select')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const compteByNumero = new Map<string, Compte>()
  for (const c of comptes) compteByNumero.set(c.numero, c)

  // Comptes groupes = ceux qui ont au moins un enfant
  const groupCompteIds = new Set<string>()
  for (const c of comptes) { if (c.parent_id) groupCompteIds.add(c.parent_id) }

  async function handleFile(file: File) {
    setParseError(null)
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
      let raw: unknown[][]
      if (isCsv) {
        raw = parseCsvText(await file.text())
      } else {
        const ExcelJS = await import('exceljs')
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await file.arrayBuffer())
        const ws = wb.worksheets[0]
        if (!ws) { setParseError('Classeur vide.'); return }
        const collected: unknown[][] = []
        ws.eachRow({ includeEmpty: false }, (row) => {
          const vals = (row.values as unknown[]).slice(1) // ExcelJS : index 1-based
          collected.push(vals.map(v => (typeof v === 'number' ? v : cellToString(v))))
        })
        raw = collected
      }
      const parsed = parseImportRows(raw, compteByNumero)
      if (parsed.length === 0) { setParseError('Aucune ligne trouvée dans le fichier.'); return }
      setRows(parsed)
      setStep('preview')
    } catch (e) {
      setParseError(`Erreur de lecture : ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function downloadTemplate() {
    const csv = '﻿' +
      'Compte;Commentaire;Prévisionnel;Réalisé\n' +
      '601;Exemple achats matières premières;1000;0\n' +
      '6061;Fournitures non stockables;500;200\n' +
      '706;Prestations de services;12000;3500\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'modele_import_budget_entreprise.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const isGroupCompte = (r: ImportRow) => r.compte !== null && groupCompteIds.has(r.compte.id)
  const validCount = rows.filter(r => r.compte !== null && !isGroupCompte(r)).length
  const notFoundCount = rows.filter(r => r.compte === null).length
  const groupCount = rows.filter(r => isGroupCompte(r)).length

  async function doImport() {
    setImporting(true)
    const validRows = rows.filter(r => r.compte !== null && !isGroupCompte(r))
    const r = await fetch(`${API}/import-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercice_id: exerciceId,
        affectation_type: activeSB.affectation_type,
        centre_cout_id: activeSB.centre_cout_id ?? null,
        rows: validRows.map(v => ({
          compte_id: v.compte!.id,
          commentaire: v.commentaire,
          montant_previsionnel: v.previsionnel,
          montant_realise: v.realise,
        })),
      }),
    })
    const d = await r.json()
    setResult(d)
    setStep('result')
    setImporting(false)
    if (d.imported > 0) onImported()
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalCard}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
              📥 Import Excel — {activeSB.label}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {step === 'select' ? 'Sélectionner un fichier Excel ou CSV' : step === 'preview' ? `${rows.length} ligne(s) détectée(s)` : 'Import terminé'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>

          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Format attendu (colonnes dans l’ordre)</div>
                <table style={{ fontSize: '0.78rem', width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Colonne', 'Nom reconnu', 'Obligatoire', 'Exemple'].map(h => (
                        <th key={h} style={{ padding: '0.25rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['A', 'Compte / Numéro', '✅', '601'],
                      ['B', 'Commentaire / Libellé', '—', 'Achats matières premières'],
                      ['C', 'Prévisionnel / Montant', '✅', '1500'],
                      ['D', 'Réalisé / Exécuté', '—', '0'],
                    ].map(([col, name, req, ex]) => (
                      <tr key={col} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.3rem 0.5rem', fontWeight: 700, color: 'var(--accent)' }}>{col}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text)' }}>{name}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>{req}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  La 1ère ligne peut être un en-tête — il sera détecté automatiquement. Les séparateurs virgule et point-virgule sont acceptés.
                </div>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                onDrop={e => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                style={{
                  border: '2px dashed var(--accent)', borderRadius: '0.75rem',
                  padding: '2rem', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s',
                }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.88rem' }}>Cliquer ou glisser un fichier ici</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.25rem' }}>Excel (.xlsx) ou CSV (.csv)</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

              {parseError && (
                <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.6rem 0.85rem', fontSize: '0.82rem', border: `1px solid ${RED}40` }}>
                  ⚠️ {parseError}
                </div>
              )}

              <button onClick={downloadTemplate}
                style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                📄 Télécharger le modèle CSV
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ background: GREEN_BG, border: `1px solid ${GREEN}40`, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 700, color: GREEN }}>{validCount}</span> <span style={{ color: GREEN }}>ligne(s) valide(s)</span>
                </div>
                {notFoundCount > 0 && (
                  <div style={{ background: RED_BG, border: `1px solid ${RED}40`, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 700, color: RED }}>{notFoundCount}</span> <span style={{ color: RED }}>compte(s) non trouvé(s)</span>
                  </div>
                )}
                {groupCount > 0 && (
                  <div style={{ background: AMBER_BG, border: `1px solid ${AMBER}40`, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 700, color: AMBER }}>{groupCount}</span> <span style={{ color: AMBER }}>compte(s) groupe — ignoré(s)</span>
                  </div>
                )}
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Compte', 'Commentaire', 'Prévisionnel', 'Réalisé', ''].map((h, i) => (
                        <th key={i} style={{ padding: '0.35rem 0.6rem', textAlign: i >= 3 && i <= 4 ? 'right' : 'left', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const isGrp = isGroupCompte(row)
                      const isInvalid = !row.compte || isGrp
                      const rowBg = !row.compte ? RED_BG : isGrp ? AMBER_BG : 'transparent'
                      return (
                        <tr key={row.rowNum} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                          <td style={{ padding: '0.3rem 0.6rem', color: 'var(--text-muted)' }}>{row.rowNum}</td>
                          <td style={{ padding: '0.3rem 0.6rem' }}>
                            <span style={{ fontWeight: 600, fontFamily: 'monospace', color: !row.compte ? RED : isGrp ? AMBER : 'var(--accent)' }}>{row.compteNumero}</span>
                            {row.compte && <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{row.compte.libelle}</span>}
                            {!row.compte && <span style={{ color: RED, marginLeft: '0.4rem', fontSize: '0.72rem' }}>introuvable</span>}
                            {isGrp && <span style={{ color: AMBER, marginLeft: '0.4rem', fontSize: '0.72rem' }}>compte groupe</span>}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', color: isInvalid ? 'var(--text-muted)' : 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.commentaire || <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right', fontWeight: 600, color: isInvalid ? 'var(--text-muted)' : 'var(--text)' }}>{fmt(row.previsionnel)}</td>
                          <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right', color: isInvalid ? 'var(--text-muted)' : 'var(--text)' }}>{fmt(row.realise)}</td>
                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                            {!row.compte ? '⚠️' : isGrp ? '🚫' : '✅'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg)' }}>
                      <td colSpan={3} style={{ padding: '0.4rem 0.6rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        TOTAL ({validCount} lignes valides)
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                        {fmt(rows.filter(r => r.compte && !isGroupCompte(r)).reduce((s, r) => s + r.previsionnel, 0))}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                        {fmt(rows.filter(r => r.compte && !isGroupCompte(r)).reduce((s, r) => s + r.realise, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {notFoundCount > 0 && (
                <div style={{ fontSize: '0.78rem', color: RED, background: RED_BG, borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                  ⚠️ Les {notFoundCount} ligne(s) avec un numéro de compte inconnu seront ignorées. Vérifiez que le numéro correspond à un compte du plan comptable général.
                </div>
              )}
              {groupCount > 0 && (
                <div style={{ fontSize: '0.78rem', color: AMBER, background: AMBER_BG, borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                  🚫 Les {groupCount} ligne(s) avec un compte groupe seront ignorées. Saisissez le numéro d’un sous-compte (feuille) et non d’un compte parent.
                </div>
              )}
            </div>
          )}

          {step === 'result' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
              <div style={{
                background: result.imported > 0 ? GREEN_BG : RED_BG,
                border: `1px solid ${result.imported > 0 ? GREEN : RED}40`,
                borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{result.imported > 0 ? '✅' : '⚠️'}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: result.imported > 0 ? GREEN : RED }}>
                  {result.imported} ligne(s) importée(s) avec succès
                </div>
                {result.errors.length > 0 && (
                  <div style={{ color: RED, fontSize: '0.82rem', marginTop: '0.5rem' }}>
                    {result.errors.length} erreur(s) rencontrée(s)
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize: '0.78rem', color: RED, background: RED_BG, borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                  {result.errors.map((e, i) => <div key={i}>Ligne {e.row} : {e.message}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {step === 'select' && <button onClick={onClose} style={btnGhost}>Annuler</button>}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('select')} style={btnGhost}>← Retour</button>
              <button onClick={doImport} disabled={validCount === 0 || importing}
                style={{ ...btnPrimary, opacity: validCount === 0 || importing ? 0.5 : 1, cursor: validCount === 0 || importing ? 'not-allowed' : 'pointer' }}>
                {importing ? 'Import en cours…' : `📥 Importer ${validCount} ligne(s)`}
              </button>
            </>
          )}
          {step === 'result' && <button onClick={onClose} style={btnPrimary}>Fermer</button>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Modale de gestion des centres de coût (table budget_centres_cout — CRUD org-keyed)
// ══════════════════════════════════════════════════════════════════════════════

const CENTRE_STATUTS: { value: CentreCout['statut']; label: string }[] = [
  { value: 'actif', label: '🎯 Actif' },
  { value: 'clos', label: '📦 Clos' },
]

function CentresCoutModal({ organisationId, centres, onClose, onChanged }: {
  organisationId: string
  centres: CentreCout[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [newCode, setNewCode] = useState('')
  const [newNom, setNewNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Édition inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editNom, setEditNom] = useState('')

  async function createCentre() {
    if (!newNom.trim()) { setError('Le nom est requis.'); return }
    setSaving(true); setError(null)
    const r = await fetch(`${API}/centres-cout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisation_id: organisationId,
        code: newCode.trim(),
        nom: newNom.trim(),
        statut: 'actif',
      }),
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setError(d.error ?? 'Erreur lors de la création.'); return }
    setNewCode(''); setNewNom('')
    await onChanged()
  }

  async function patchCentre(id: string, fields: Partial<CentreCout>) {
    setError(null)
    const r = await fetch(`${API}/centres-cout/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organisation_id: organisationId, ...fields }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'Erreur lors de la mise à jour.')
      return
    }
    await onChanged()
  }

  async function saveRename() {
    if (!editId || !editNom.trim()) { setEditId(null); return }
    await patchCentre(editId, { code: editCode.trim(), nom: editNom.trim() })
    setEditId(null)
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 560 }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>⚙️ Centres de coût de l’organisation</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Chaque centre de coût peut porter un sous-budget dans les exercices.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Création */}
          <div style={{ border: '1px dashed var(--border)', borderRadius: '0.75rem', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✚ Nouveau centre de coût</div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input style={{ ...inp, width: 110, flexShrink: 0, fontFamily: 'monospace' }} value={newCode} placeholder="Code"
                onChange={e => setNewCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCentre() }} />
              <input style={{ ...inp, flex: 1 }} value={newNom} placeholder="Nom du centre de coût (ex : Atelier production)"
                onChange={e => setNewNom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCentre() }} />
              <button onClick={createCentre} disabled={saving}
                style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: saving ? 0.6 : 1 }}>
                {saving ? '…' : 'Créer'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: RED_BG, color: RED, borderRadius: '0.5rem', padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}>⚠️ {error}</div>
          )}

          {/* Liste */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            {centres.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Aucun centre de coût pour cette organisation.
              </div>
            )}
            {centres.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flexShrink: 0 }}>{centreIcon(c.statut)}</span>
                {editId === c.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: '0.4rem', minWidth: 0 }}>
                    <input style={{ ...inp, width: 90, flexShrink: 0, padding: '0.3rem 0.55rem', fontFamily: 'monospace' }} value={editCode}
                      placeholder="Code"
                      onChange={e => setEditCode(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditId(null) }} />
                    <input autoFocus style={{ ...inp, flex: 1, padding: '0.3rem 0.55rem' }} value={editNom}
                      onChange={e => setEditNom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditId(null) }}
                      onBlur={saveRename} />
                  </div>
                ) : (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {c.code && (
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
                        background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
                        borderRadius: '0.35rem', padding: '0.1rem 0.4rem',
                      }}>{c.code}</span>
                    )}
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                  </div>
                )}
                <select value={c.statut}
                  onChange={e => patchCentre(c.id, { statut: e.target.value as CentreCout['statut'] })}
                  style={{ ...inp, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.78rem', flexShrink: 0 }}>
                  {CENTRE_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={() => { setEditId(c.id); setEditCode(c.code ?? ''); setEditNom(c.nom) }} title="Renommer"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>✏️</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Journal d'audit d'une ligne (budget_modifications)
// ══════════════════════════════════════════════════════════════════════════════

function AuditModal({ ligne, onClose }: { ligne: Ligne; onClose: () => void }) {
  const [entries, setEntries] = useState<Modification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/modifications?ligne_id=${ligne.id}`)
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ligne.id])

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...modalCard, maxWidth: 560 }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>🕑 Journal d’audit</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {ligne.compte?.numero} {ligne.compte?.libelle}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Chargement…</div>}
          {!loading && entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Aucune modification enregistrée pour cette ligne.
            </div>
          )}
          {entries.map(m => (
            <div key={m.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{m.champ}</span>
                <span style={{ color: 'var(--text-subtle)', fontSize: '0.72rem' }}>
                  {new Date(m.modified_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{m.ancienne_valeur ?? '—'}</span>
                {' → '}
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{m.nouvelle_valeur ?? '—'}</span>
              </div>
              {m.motif && <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', marginTop: '0.15rem' }}>Motif : {m.motif}</div>}
            </div>
          ))}
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DetailRow — sous-ligne commentée (édition inline, drag & drop, transfert)
// ══════════════════════════════════════════════════════════════════════════════

function DetailRow({ detail, editable, compteType, onUpdate, onDelete, onTransfer, onReorder }: {
  detail: Detail
  editable: boolean
  compteType?: CompteType
  onUpdate: (id: string, field: 'commentaire' | 'montant_previsionnel' | 'montant_realise', value: string | number) => void
  onDelete: (id: string) => void
  onTransfer?: (detailId: string) => void
  onReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void
}) {
  const isDraft = !!detail.draft
  const [comEditing, setComEditing] = useState(isDraft)
  const [editPrev, setEditPrev] = useState(false)
  const [editReal, setEditReal] = useState(false)
  const [com, setCom] = useState(detail.commentaire)
  const [prev, setPrev] = useState(detail.montant_previsionnel === 0 ? '' : String(detail.montant_previsionnel))
  const [real, setReal] = useState(detail.montant_realise === 0 ? '' : String(detail.montant_realise))

  const prevRef = useRef<HTMLInputElement>(null)
  const realRef = useRef<HTMLInputElement>(null)
  const comRef = useRef<HTMLTextAreaElement>(null)
  const discardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (editPrev) prevRef.current?.focus() }, [editPrev])
  useEffect(() => { if (editReal) realRef.current?.focus() }, [editReal])
  useEffect(() => { if (comEditing) comRef.current?.focus() }, [comEditing])

  // Supprime le brouillon si tout est resté vide après le blur
  function scheduleDiscard() {
    if (!isDraft) return
    if (discardTimer.current) clearTimeout(discardTimer.current)
    discardTimer.current = setTimeout(() => {
      if (com.trim() === '' && parseAmt(prev || '0') === 0 && parseAmt(real || '0') === 0)
        onDelete(detail.id)
    }, 200)
  }
  function cancelDiscard() {
    if (discardTimer.current) { clearTimeout(discardTimer.current); discardTimer.current = null }
  }

  const amountInp: React.CSSProperties = {
    width: 90, textAlign: 'right', padding: '0.2rem 0.4rem',
    border: '1px solid var(--accent)', borderRadius: '0.3rem',
    background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.82rem',
  }

  const isEmptyCom = com.trim() === ''
  const [insertPos, setInsertPos] = useState<'before' | 'after' | null>(null)

  return (
    <tr
      draggable={!!editable && !isDraft && !comEditing}
      onDragStart={e => {
        e.dataTransfer.setData('budget-detail', JSON.stringify({ detailId: detail.id, fromLigneId: detail.ligne_id, compteType }))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={e => {
        if (!onReorder) return
        try {
          const raw = e.dataTransfer.getData('budget-detail')
          const d = raw ? JSON.parse(raw) : {}
          if (d.fromLigneId !== detail.ligne_id) return // laisser CompteRow gérer
        } catch { return }
        e.preventDefault()
        e.stopPropagation()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setInsertPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
      }}
      onDragLeave={() => setInsertPos(null)}
      onDrop={e => {
        setInsertPos(null)
        if (!onReorder) return
        try {
          const d = JSON.parse(e.dataTransfer.getData('budget-detail'))
          if (d.fromLigneId !== detail.ligne_id) return
          if (d.detailId === detail.id) return
          e.preventDefault()
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          onReorder(d.detailId, detail.id, pos)
        } catch { /* ignore */ }
      }}
      style={{
        borderBottom: insertPos === 'after' ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderTop: insertPos === 'before' ? '2px solid var(--accent)' : undefined,
        background: isDraft ? 'rgba(99,102,241,0.04)' : 'transparent',
        cursor: editable && !isDraft && !comEditing ? 'grab' : 'default',
        verticalAlign: comEditing ? 'top' : 'middle',
      }}
    >
      {/* Col 1 : libellé — affichage OU éditeur inline */}
      <td style={{ padding: comEditing ? '0.5rem 0.75rem 0.5rem 2rem' : '0.35rem 0.75rem 0.35rem 1rem' }}>
        {comEditing && editable ? (
          <div onFocus={cancelDiscard}>
            <textarea
              ref={comRef}
              value={com}
              placeholder="Libellé / description de la ligne…"
              rows={Math.max(1, com.split('\n').length)}
              onChange={e => setCom(e.target.value)}
              onBlur={() => { onUpdate(detail.id, 'commentaire', com); setComEditing(false); scheduleDiscard() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLTextAreaElement).blur() }
                if (e.key === 'Escape') { setCom(detail.commentaire); setComEditing(false) }
              }}
              style={{
                width: '100%', padding: '0.3rem 0.5rem', border: '1px solid var(--accent)',
                borderRadius: '0.35rem', background: 'var(--bg-card)', color: 'var(--text)',
                fontSize: '0.82rem', resize: 'vertical',
              }}
            />
            {/* Pièces justificatives : non portées en v1 */}
            {!isDraft && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                📎 Pièces justificatives : bientôt disponible
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
            {editable && !isDraft && (
              <span
                title="Glisser pour réordonner ou déplacer"
                style={{ color: 'var(--border)', fontSize: '0.9rem', lineHeight: 1.4, cursor: 'grab', userSelect: 'none', flexShrink: 0, marginTop: '0.1rem' }}>
                ⠿
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                onClick={() => editable && setComEditing(true)}
                style={{
                  fontSize: '0.82rem',
                  cursor: editable ? 'text' : 'default',
                  minHeight: '1.2rem',
                  whiteSpace: 'pre-wrap',
                  color: isEmptyCom ? 'var(--text-muted)' : 'var(--text)',
                  fontStyle: isEmptyCom ? 'italic' : 'normal',
                }}>
                {isEmptyCom ? 'Libellé…' : com}
              </div>
            </div>
          </div>
        )}
      </td>
      {/* Col 2 : Prévisionnel */}
      <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}
        onClick={() => editable && !editPrev && setEditPrev(true)}>
        {editPrev && editable
          ? <input ref={prevRef} value={prev} onChange={e => setPrev(e.target.value)}
              onFocus={cancelDiscard}
              onBlur={() => { setEditPrev(false); onUpdate(detail.id, 'montant_previsionnel', parseAmt(prev || '0')); scheduleDiscard() }}
              onKeyDown={e => {
                if (e.key === 'Enter') { setEditPrev(false); onUpdate(detail.id, 'montant_previsionnel', parseAmt(prev || '0')) }
                if (e.key === 'Tab') { e.preventDefault(); setEditPrev(false); onUpdate(detail.id, 'montant_previsionnel', parseAmt(prev || '0')); setEditReal(true) }
                if (e.key === 'Escape') { setPrev(String(detail.montant_previsionnel)); setEditPrev(false) }
              }}
              style={amountInp} />
          : <span style={{ fontSize: '0.82rem', fontWeight: 600, cursor: editable ? 'text' : 'default',
              color: isDraft && !prev ? 'var(--text-muted)' : detail.montant_previsionnel !== 0 ? 'var(--text)' : 'var(--text-muted)',
              fontStyle: isDraft && !prev ? 'italic' : 'normal' }}>
              {isDraft && !prev ? 'Prév…' : fmt(detail.montant_previsionnel)}
            </span>}
      </td>
      {/* Col 3 : Réalisé */}
      <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}
        onClick={() => editable && !editReal && setEditReal(true)}>
        {editReal && editable
          ? <input ref={realRef} value={real} onChange={e => setReal(e.target.value)}
              onFocus={cancelDiscard}
              onBlur={() => { setEditReal(false); onUpdate(detail.id, 'montant_realise', parseAmt(real || '0')); scheduleDiscard() }}
              onKeyDown={e => {
                if (e.key === 'Enter') { setEditReal(false); onUpdate(detail.id, 'montant_realise', parseAmt(real || '0')) }
                if (e.key === 'Escape') { setReal(String(detail.montant_realise)); setEditReal(false) }
              }}
              style={amountInp} />
          : <span style={{ fontSize: '0.82rem', fontWeight: 600, cursor: editable ? 'text' : 'default',
              color: isDraft && !real ? 'var(--text-muted)' : detail.montant_realise !== 0 ? 'var(--text)' : 'var(--text-muted)',
              fontStyle: isDraft && !real ? 'italic' : 'normal' }}>
              {isDraft && !real ? 'Réal…' : fmt(detail.montant_realise)}
            </span>}
      </td>
      {/* Col 4 : écart — masqué sur les lignes de détail */}
      <td style={{ padding: '0.35rem 0.75rem' }} />
      {/* Col 5 : boutons */}
      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.1rem' }}>
          {editable && (
            <>
              {!isDraft && onTransfer && (
                <button onClick={() => onTransfer(detail.id)}
                  title="Transférer vers un autre sous-budget"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.1rem 0.25rem', opacity: 0.6 }}>⇄</button>
              )}
              <button onClick={() => onDelete(detail.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0.1rem 0.3rem' }}>×</button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CompteRow — ligne du plan comptable (hiérarchie, sous-comptes, drag cible)
// ══════════════════════════════════════════════════════════════════════════════

function CompteRow({ compte, ligne, isGroup, childTotal, childRealTotal, expanded, editable,
  flipEcart, nextChildNumero,
  onToggle, onAddDetail, onUpdateDetail, onDeleteDetail, onTransfer, onAddSubCompte, onMoveDetail, onReorderDetail,
  onToggleBudgetGeneral, onShowAudit }: {
  compte: Compte; ligne: Ligne | undefined; isGroup: boolean
  childTotal: number; childRealTotal: number; expanded: boolean; editable: boolean
  flipEcart?: boolean; nextChildNumero: string
  onToggle: () => void
  onAddDetail: (compteId: string) => void
  onUpdateDetail: (detailId: string, ligneId: string, field: 'commentaire' | 'montant_previsionnel' | 'montant_realise', value: string | number) => void
  onDeleteDetail: (detailId: string, ligneId: string) => void
  onTransfer?: (detailId: string, fromLigneId: string, compteId: string) => void
  onAddSubCompte: (parentId: string, numero: string, libelle: string) => Promise<void>
  onMoveDetail?: (detailId: string, fromLigneId: string, toCompteId: string) => void
  onReorderDetail?: (ligneId: string, draggedId: string, targetId: string, position: 'before' | 'after') => void
  onToggleBudgetGeneral?: (ligneId: string, currentValue: boolean) => void
  onShowAudit?: (ligne: Ligne) => void
}) {
  const [showSubForm, setShowSubForm] = useState(false)
  const [subNumero, setSubNumero] = useState('')
  const [subLibelle, setSubLibelle] = useState('')
  const [savingSub, setSavingSub] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragForbidden, setIsDragForbidden] = useState(false)

  const prev = isGroup ? childTotal : (ligne?.montant_previsionnel ?? 0)
  const real = isGroup ? childRealTotal : (ligne?.montant_realise ?? 0)
  const ecart = flipEcart ? prev - real : real - prev
  const hasDetails = (ligne?.details?.length ?? 0) > 0
  const depth = compte.numero.length <= 2 ? 0 : compte.numero.length <= 3 ? 1 : compte.numero.length <= 4 ? 2 : 3
  const pad = ['0.75rem', '1.4rem', '2.1rem', '2.8rem'][depth] ?? '2.8rem'
  const rowBg = depth === 0 ? 'var(--bg)' : 'var(--bg-card)'
  const fontW = depth === 0 ? 700 : depth === 1 ? 600 : 400
  const fontSize = depth === 0 ? '0.88rem' : '0.84rem'
  const isExcluded = !isGroup && ligne?.contribue_budget_general === false

  async function handleSaveSubForm() {
    if (!subNumero.trim() || !subLibelle.trim()) return
    setSavingSub(true)
    await onAddSubCompte(compte.id, subNumero.trim(), subLibelle.trim())
    setSavingSub(false)
    setShowSubForm(false)
  }

  function openSubForm() {
    setSubNumero(nextChildNumero)
    setSubLibelle('')
    setShowSubForm(true)
  }

  return (
    <>
      <tr onClick={isGroup || hasDetails ? onToggle : undefined}
        onDragOver={e => {
          if (!isGroup && editable && onMoveDetail) {
            e.preventDefault()
            try {
              const d = JSON.parse(e.dataTransfer.getData('budget-detail') || '{}')
              const forbidden = d.compteType && d.compteType !== compte.type
              setIsDragForbidden(!!forbidden)
              setIsDragOver(!forbidden)
              e.dataTransfer.dropEffect = forbidden ? 'none' : 'move'
            } catch {
              setIsDragOver(true)
            }
          }
        }}
        onDragLeave={() => { setIsDragOver(false); setIsDragForbidden(false) }}
        onDrop={e => {
          e.preventDefault(); setIsDragOver(false); setIsDragForbidden(false)
          if (!isGroup && editable && onMoveDetail) {
            try {
              const d = JSON.parse(e.dataTransfer.getData('budget-detail'))
              if (d.compteType && d.compteType !== compte.type) return
              if (d.fromLigneId !== ligne?.id) onMoveDetail(d.detailId, d.fromLigneId, compte.id)
            } catch { /* ignore */ }
          }
        }}
        style={{
          background: isDragForbidden ? RED_BG : isDragOver ? 'rgba(99,102,241,0.12)' : isExcluded ? 'rgba(217,119,6,0.05)' : rowBg,
          cursor: isGroup || hasDetails ? 'pointer' : 'default',
          borderBottom: '1px solid var(--border)',
          borderLeft: isExcluded ? `3px solid ${AMBER}` : undefined,
          outline: isDragForbidden ? `2px dashed ${RED}` : isDragOver ? '2px dashed var(--accent)' : 'none',
          outlineOffset: '-2px',
          opacity: isExcluded ? 0.7 : 1,
        }}>
        <td style={{ padding: `0.55rem 0.75rem 0.55rem ${pad}`, width: '38%' }}>
          <div className="flex items-center gap-2">
            {(isGroup || hasDetails) && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            )}
            <span style={{ fontSize, fontWeight: fontW, color: 'var(--text)' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem' }}>{compte.numero}</span>
              {compte.libelle}
            </span>
            {isExcluded && (
              <span title="Cette ligne n’est pas incluse dans la consolidation" style={{
                fontSize: '0.62rem', fontWeight: 700, background: AMBER_BG, color: AMBER,
                borderRadius: '0.3rem', padding: '0.05rem 0.38rem', border: `1px solid ${AMBER}40`, flexShrink: 0,
              }}>⊘ Hors conso</span>
            )}
          </div>
        </td>
        {/* Prévisionnel — lecture seule, calculé depuis les détails */}
        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', width: '20%' }}>
          <span style={{ fontSize, fontWeight: fontW, color: prev !== 0 ? 'var(--text)' : 'var(--text-subtle)' }}>{fmt(prev)}</span>
        </td>
        {/* Réalisé — lecture seule */}
        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', width: '20%' }}>
          <span style={{ fontSize, fontWeight: fontW, color: real !== 0 ? 'var(--text)' : 'var(--text-subtle)' }}>{fmt(real)}</span>
        </td>
        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', width: '17%' }}>
          {(prev !== 0 || real !== 0) && (
            <span style={{ fontSize, fontWeight: fontW, color: ecart > 0 ? GREEN : ecart < 0 ? RED : 'var(--text-muted)' }}>
              {ecart > 0 ? '+' : ''}{fmt(ecart)}
            </span>
          )}
        </td>
        <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center', width: '5%' }}>
          {editable && (
            <div style={{ display: 'flex', gap: '0.1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
              {/* + détail : seulement sur comptes feuilles */}
              {!isGroup && (
                <button onClick={e => { e.stopPropagation(); onAddDetail(compte.id) }}
                  title="Ajouter une écriture de détail"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '1rem', lineHeight: 1, padding: '0 0.18rem' }}>+</button>
              )}
              {/* ⊕ sous-compte : sur tous les comptes */}
              <button onClick={e => { e.stopPropagation(); openSubForm() }}
                title="Créer un sous-compte"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1, padding: '0 0.18rem', opacity: 0.7 }}>⊕</button>
              {/* Toggle consolidation — comptes feuilles avec ligne existante */}
              {!isGroup && ligne && onToggleBudgetGeneral && (
                <button
                  onClick={e => { e.stopPropagation(); onToggleBudgetGeneral(ligne.id, ligne.contribue_budget_general ?? true) }}
                  title={ligne.contribue_budget_general !== false
                    ? 'Inclus dans la consolidation — cliquer pour exclure'
                    : 'Exclu de la consolidation — cliquer pour inclure'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', lineHeight: 1, padding: '0 0.18rem',
                    color: ligne.contribue_budget_general !== false ? 'var(--text-muted)' : AMBER,
                    opacity: ligne.contribue_budget_general !== false ? 0.5 : 1,
                  }}>
                  {ligne.contribue_budget_general !== false ? '🌐' : '⊘'}
                </button>
              )}
              {/* Journal d'audit */}
              {!isGroup && ligne && onShowAudit && (
                <button onClick={e => { e.stopPropagation(); onShowAudit(ligne) }}
                  title="Journal d’audit de la ligne"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1, padding: '0 0.18rem', opacity: 0.6 }}>🕑</button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Formulaire inline de création de sous-compte */}
      {showSubForm && (
        <tr style={{ background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border)' }}>
          <td colSpan={5} style={{ padding: '0.5rem 0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: pad }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Nouveau sous-compte</span>
              <input
                value={subNumero}
                onChange={e => setSubNumero(e.target.value)}
                placeholder="Numéro"
                autoFocus
                style={{ width: 72, padding: '0.28rem 0.5rem', border: '1px solid var(--accent)', borderRadius: '0.3rem', fontSize: '0.82rem', background: 'var(--bg-card)', color: 'var(--text)' }}
              />
              <input
                value={subLibelle}
                onChange={e => setSubLibelle(e.target.value)}
                placeholder="Libellé…"
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSubForm(); if (e.key === 'Escape') setShowSubForm(false) }}
                style={{ flex: 1, padding: '0.28rem 0.5rem', border: '1px solid var(--accent)', borderRadius: '0.3rem', fontSize: '0.82rem', background: 'var(--bg-card)', color: 'var(--text)' }}
              />
              <button
                onClick={handleSaveSubForm}
                disabled={savingSub || !subNumero.trim() || !subLibelle.trim()}
                style={{ padding: '0.28rem 0.7rem', background: savingSub || !subNumero.trim() || !subLibelle.trim() ? 'var(--text-subtle)' : 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {savingSub ? '…' : 'Créer'}
              </button>
              <button
                onClick={() => setShowSubForm(false)}
                style={{ padding: '0.28rem 0.5rem', background: 'var(--bg)', color: 'var(--text)', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                ✕
              </button>
            </div>
          </td>
        </tr>
      )}

      {expanded && ligne && (ligne.details?.length ?? 0) > 0 && (
        ligne.details.map(d => (
          <DetailRow key={d.id} detail={d} editable={editable} compteType={compte.type}
            onUpdate={(detailId, field, value) => onUpdateDetail(detailId, ligne.id, field, value)}
            onDelete={detailId => onDeleteDetail(detailId, ligne.id)}
            onTransfer={onTransfer ? (detailId) => onTransfer(detailId, ligne.id, compte.id) : undefined}
            onReorder={onReorderDetail ? (draggedId, targetId, pos) => onReorderDetail(ligne.id, draggedId, targetId, pos) : undefined} />
        ))
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BudgetSection — tableau d'un type de compte (arbre par classe de compte)
// charge / produit / actif / passif
// ══════════════════════════════════════════════════════════════════════════════

function BudgetSection({ title, type, comptes, lignes, editable,
  onAddDetail, onUpdateDetail, onDeleteDetail, onTransfer, onAddSubCompte, onMoveDetail, onReorderDetail,
  onToggleBudgetGeneral, onShowAudit }: {
  title: string; type: CompteType
  comptes: Compte[]; lignes: Ligne[]; editable: boolean
  onAddDetail: (compteId: string) => Promise<void>
  onUpdateDetail: (detailId: string, ligneId: string, field: 'commentaire' | 'montant_previsionnel' | 'montant_realise', value: string | number) => Promise<void>
  onDeleteDetail: (detailId: string, ligneId: string) => Promise<void>
  onTransfer?: (detailId: string, fromLigneId: string, compteId: string) => void
  onAddSubCompte: (parentId: string, numero: string, libelle: string) => Promise<void>
  onMoveDetail?: (detailId: string, fromLigneId: string, toCompteId: string) => void
  onReorderDetail?: (ligneId: string, draggedId: string, targetId: string, position: 'before' | 'after') => void
  onToggleBudgetGeneral?: (ligneId: string, currentValue: boolean) => void
  onShowAudit?: (ligne: Ligne) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setExpanded(prevSet => {
    const n = new Set(prevSet)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const [showTuto, setShowTuto] = useState(false)
  const filtered = comptes.filter(c => c.type === type)
  const roots = filtered.filter(c => !c.parent_id)
  const byParent = new Map<string, Compte[]>()
  for (const c of filtered) if (c.parent_id) {
    if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, [])
    byParent.get(c.parent_id)!.push(c)
  }
  const ligneByCompte = new Map<string, Ligne>()
  for (const l of lignes) ligneByCompte.set(l.compte_id, l)

  function getTotal(c: Compte): number {
    const children = byParent.get(c.id) ?? []
    return children.length > 0 ? children.reduce((s, ch) => s + getTotal(ch), 0) : (ligneByCompte.get(c.id)?.montant_previsionnel ?? 0)
  }
  function getRealTotal(c: Compte): number {
    const children = byParent.get(c.id) ?? []
    return children.length > 0 ? children.reduce((s, ch) => s + getRealTotal(ch), 0) : (ligneByCompte.get(c.id)?.montant_realise ?? 0)
  }

  function nextChildNumero(c: Compte): string {
    const childLen = c.numero.length + 1
    const children = filtered.filter(ch => ch.numero.length === childLen && ch.numero.startsWith(c.numero))
    if (children.length === 0) return c.numero + '1'
    const maxNum = Math.max(...children.map(ch => parseInt(ch.numero, 10)))
    return String(maxNum + 1)
  }

  const grandPrev = roots.reduce((s, c) => s + getTotal(c), 0)
  const grandReal = roots.reduce((s, c) => s + getRealTotal(c), 0)
  const grandEcart = type === 'charge' ? grandPrev - grandReal : grandReal - grandPrev

  const rows: React.ReactNode[] = []
  function renderCompte(c: Compte) {
    const children = byParent.get(c.id) ?? []
    const isGroup = children.length > 0
    const ligne = ligneByCompte.get(c.id)
    const exp = expanded.has(c.id)
    rows.push(
      <CompteRow key={c.id} compte={c} ligne={ligne} isGroup={isGroup}
        childTotal={isGroup ? getTotal(c) : 0} childRealTotal={isGroup ? getRealTotal(c) : 0}
        expanded={exp} editable={editable} flipEcart={type === 'charge'}
        nextChildNumero={nextChildNumero(c)}
        onToggle={() => toggle(c.id)}
        onAddDetail={async (compteId) => { await onAddDetail(compteId); if (!exp) toggle(c.id) }}
        onUpdateDetail={onUpdateDetail} onDeleteDetail={onDeleteDetail}
        onTransfer={onTransfer}
        onAddSubCompte={onAddSubCompte}
        onMoveDetail={onMoveDetail}
        onReorderDetail={onReorderDetail}
        onToggleBudgetGeneral={onToggleBudgetGeneral}
        onShowAudit={onShowAudit} />
    )
    if (isGroup && exp) children.forEach(ch => renderCompte(ch))
  }
  roots.forEach(r => renderCompte(r))

  const hColor = SECTION_STYLE[type].color
  const hBg = SECTION_STYLE[type].bg

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: hBg, borderBottom: '1px solid var(--border)' }}>
        <span className="font-bold text-sm uppercase tracking-widest" style={{ color: hColor }}>{title}</span>
        {editable && (
          <button
            onClick={() => setShowTuto(v => !v)}
            title="Aide drag & drop"
            style={{ background: 'none', border: `1px solid ${hColor}`, borderRadius: '0.4rem', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700, color: hColor, cursor: 'pointer', opacity: 0.75 }}>
            {showTuto ? '✕ Fermer l’aide' : '? Aide'}
          </button>
        )}
      </div>

      {editable && showTuto && (
        <div style={{ background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--accent)' }}>🖱 Drag &amp; drop — comment ça marche</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem' }}>
            <div>
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: '0.3rem' }}>⠿</span>
              Glisser le symbole pour <strong>réordonner</strong> les lignes <em>dans le même compte</em>
            </div>
            <div>
              <span style={{ marginRight: '0.3rem' }}>↔</span>
              Glisser vers un <strong>autre compte</strong> (même type) pour <strong>déplacer</strong> la ligne
            </div>
            <div>
              <span style={{ color: 'var(--accent)', marginRight: '0.3rem' }}>▬</span>
              Bordure <span style={{ color: 'var(--accent)', fontWeight: 700 }}>accent</span> = insertion autorisée (avant ou après)
            </div>
            <div>
              <span style={{ color: RED, marginRight: '0.3rem' }}>▬</span>
              Bordure <span style={{ color: RED, fontWeight: 700 }}>rouge</span> = dépôt interdit (type incompatible)
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <colgroup><col style={{ width: '38%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '17%' }} /><col style={{ width: '5%' }} /></colgroup>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {['Compte', 'Prévisionnel', 'Réalisé', 'Écart R−P', ''].map((h, i) => (
                <th key={h + i} style={{ padding: '0.4rem 0.75rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
          <tfoot>
            <tr style={{ background: hBg, borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.88rem', color: hColor }}>TOTAL {title.toUpperCase()}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: hColor }}>{fmt(grandPrev)}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: hColor }}>{fmt(grandReal)}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: grandEcart > 0 ? GREEN : grandEcart < 0 ? RED : 'var(--text-muted)' }}>
                {grandEcart > 0 ? '+' : ''}{fmt(grandEcart)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Agrège les lignes de tous les sous-budgets par compte (vue consolidée) ────
function mergeGlobalLignes(lignes: Ligne[]): Ligne[] {
  const byCompte = new Map<string, Ligne>()
  for (const l of lignes) {
    if (l.contribue_budget_general === false) continue
    const existing = byCompte.get(l.compte_id)
    if (!existing) {
      byCompte.set(l.compte_id, { ...l, details: [...(l.details ?? [])] })
    } else {
      existing.montant_previsionnel += l.montant_previsionnel
      existing.montant_realise += l.montant_realise
      existing.details = [...existing.details, ...(l.details ?? [])]
    }
  }
  return Array.from(byCompte.values())
}

// ══════════════════════════════════════════════════════════════════════════════
// Vue « Compte de résultat » — présentation comptable française en deux colonnes
// (calculée côté client depuis les lignes consolidées, feuilles uniquement)
// ══════════════════════════════════════════════════════════════════════════════

interface CrRubrique { label: string; prefixes: string[] }

const CR_CHARGES: CrRubrique[] = [
  { label: '60 · Achats', prefixes: ['60'] },
  { label: '61-62 · Services extérieurs', prefixes: ['61', '62'] },
  { label: '63 · Impôts, taxes et versements assimilés', prefixes: ['63'] },
  { label: '64 · Charges de personnel', prefixes: ['64'] },
  { label: '65 · Autres charges de gestion courante', prefixes: ['65'] },
  { label: '66 · Charges financières', prefixes: ['66'] },
  { label: '67 · Charges exceptionnelles', prefixes: ['67'] },
  { label: '68 · Dotations aux amortissements et provisions', prefixes: ['68'] },
  { label: '69 · Impôt sur les bénéfices', prefixes: ['69'] },
]

const CR_PRODUITS: CrRubrique[] = [
  { label: '70 · Ventes de produits et prestations', prefixes: ['70'] },
  { label: '71-72 · Production stockée et immobilisée', prefixes: ['71', '72', '73'] },
  { label: '74 · Subventions d’exploitation', prefixes: ['74'] },
  { label: '75 · Autres produits de gestion courante', prefixes: ['75'] },
  { label: '76 · Produits financiers', prefixes: ['76'] },
  { label: '77 · Produits exceptionnels', prefixes: ['77'] },
  { label: '78 · Reprises sur amortissements et provisions', prefixes: ['78'] },
  { label: '79 · Transferts de charges', prefixes: ['79'] },
]

interface CrBucket { label: string; prev: number; real: number }

/** Regroupe les lignes d'un type (charge/produit) par sous-classe comptable. */
function bucketize(lignes: Ligne[], type: 'charge' | 'produit', defs: CrRubrique[]): CrBucket[] {
  const buckets = defs.map(d => ({ label: d.label, prev: 0, real: 0 }))
  const autres = { label: 'Autres', prev: 0, real: 0 }
  for (const l of lignes) {
    if (l.compte?.type !== type) continue
    const prefix = l.compte.numero.slice(0, 2)
    const idx = defs.findIndex(d => d.prefixes.includes(prefix))
    const target = idx >= 0 ? buckets[idx] : autres
    target.prev += l.montant_previsionnel
    target.real += l.montant_realise
  }
  const out = buckets.filter(b => b.prev !== 0 || b.real !== 0)
  if (autres.prev !== 0 || autres.real !== 0) out.push(autres)
  return out
}

function CrColonne({ title, color, bg, buckets, total, resultatLigne }: {
  title: string
  color: string
  bg: string
  buckets: CrBucket[]
  total: { prev: number; real: number }
  /** Ligne d'équilibre (résultat) injectée en bas de colonne — null si aucune. */
  resultatLigne: { label: string; prev: number | null; real: number | null } | null
}) {
  const totalEquilibre = {
    prev: total.prev + (resultatLigne?.prev ?? 0),
    real: total.real + (resultatLigne?.real ?? 0),
  }
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div className="px-4 py-3" style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
        <span className="font-bold text-sm uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {['Rubrique', 'Prévisionnel', 'Réalisé'].map((h, i) => (
                <th key={h} style={{ padding: '0.4rem 0.75rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '1.25rem 0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Aucun montant sur cette colonne.
                </td>
              </tr>
            )}
            {buckets.map(b => (
              <tr key={b.label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.84rem', color: 'var(--text)' }}>{b.label}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.84rem', fontWeight: 600, color: b.prev !== 0 ? 'var(--text)' : 'var(--text-subtle)', whiteSpace: 'nowrap' }}>{fmt(b.prev)}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.84rem', fontWeight: 600, color: b.real !== 0 ? 'var(--text)' : 'var(--text-subtle)', whiteSpace: 'nowrap' }}>{fmt(b.real)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: bg, borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, fontSize: '0.84rem', color }}>TOTAL {title.toUpperCase()}</td>
              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{fmt(total.prev)}</td>
              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{fmt(total.real)}</td>
            </tr>
            {resultatLigne && (
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>{resultatLigne.label}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {resultatLigne.prev !== null ? fmt(resultatLigne.prev) : '—'}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {resultatLigne.real !== null ? fmt(resultatLigne.real) : '—'}
                </td>
              </tr>
            )}
            <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total équilibré</td>
              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(totalEquilibre.prev)}</td>
              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(totalEquilibre.real)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function CompteResultatView({ lignes, exerciceNom, loading }: {
  /** Lignes consolidées feuilles (contribuant au budget général). */
  lignes: Ligne[]
  exerciceNom: string
  loading: boolean
}) {
  const chargeBuckets = useMemo(() => bucketize(lignes, 'charge', CR_CHARGES), [lignes])
  const produitBuckets = useMemo(() => bucketize(lignes, 'produit', CR_PRODUITS), [lignes])

  const totalCharges = {
    prev: lignes.filter(l => l.compte?.type === 'charge').reduce((s, l) => s + l.montant_previsionnel, 0),
    real: lignes.filter(l => l.compte?.type === 'charge').reduce((s, l) => s + l.montant_realise, 0),
  }
  const totalProduits = {
    prev: lignes.filter(l => l.compte?.type === 'produit').reduce((s, l) => s + l.montant_previsionnel, 0),
    real: lignes.filter(l => l.compte?.type === 'produit').reduce((s, l) => s + l.montant_realise, 0),
  }
  const resultatPrev = totalProduits.prev - totalCharges.prev
  const resultatReal = totalProduits.real - totalCharges.real

  // Équilibre à la française : le bénéfice s'ajoute côté charges, la perte côté produits
  const beneficeLigne = (resultatPrev > 0 || resultatReal > 0)
    ? {
        label: 'Résultat de l’exercice (bénéfice)',
        prev: resultatPrev > 0 ? resultatPrev : null,
        real: resultatReal > 0 ? resultatReal : null,
      }
    : null
  const perteLigne = (resultatPrev < 0 || resultatReal < 0)
    ? {
        label: 'Résultat de l’exercice (perte)',
        prev: resultatPrev < 0 ? -resultatPrev : null,
        real: resultatReal < 0 ? -resultatReal : null,
      }
    : null

  if (loading) {
    return <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Consolidation en cours…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Bandeau d'entête + impression */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg">📈</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>Compte de résultat — {exerciceNom}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Charges (classe 6) et produits (classe 7) consolidés de tous les sous-budgets contribuant au budget général.
            </div>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="text-xs px-2.5 py-1 rounded-lg font-semibold"
          style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          🖨️ Imprimer
        </button>
      </div>

      {/* Deux colonnes : CHARGES | PRODUITS */}
      <div className="grid gap-6 items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <CrColonne title="Charges" color={RED} bg={RED_BG}
          buckets={chargeBuckets} total={totalCharges} resultatLigne={beneficeLigne} />
        <CrColonne title="Produits" color={GREEN} bg={GREEN_BG}
          buckets={produitBuckets} total={totalProduits} resultatLigne={perteLigne} />
      </div>

      {/* Résultat de l'exercice mis en évidence */}
      <div className="rounded-2xl p-5"
        style={{ background: resultatReal >= 0 ? GREEN_BG : RED_BG, border: `1px solid ${resultatReal >= 0 ? GREEN : RED}40` }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Résultat de l’exercice = Produits − Charges
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: resultatPrev >= 0 ? GREEN : RED, opacity: 0.8 }}>Résultat prévisionnel</div>
            <div className="text-2xl font-bold" style={{ color: resultatPrev >= 0 ? GREEN : RED }}>
              {resultatPrev >= 0 ? '+' : ''}{fmt(resultatPrev)}
            </div>
            <div className="text-xs mt-0.5 font-semibold" style={{ color: resultatPrev >= 0 ? GREEN : RED }}>
              {resultatPrev >= 0 ? 'Bénéfice prévisionnel' : 'Perte prévisionnelle'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: resultatReal >= 0 ? GREEN : RED, opacity: 0.8 }}>Résultat réalisé</div>
            <div className="text-2xl font-bold" style={{ color: resultatReal >= 0 ? GREEN : RED }}>
              {resultatReal >= 0 ? '+' : ''}{fmt(resultatReal)}
            </div>
            <div className="text-xs mt-0.5 font-semibold" style={{ color: resultatReal >= 0 ? GREEN : RED }}>
              {resultatReal >= 0 ? 'Bénéfice' : 'Perte'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Vue « Bilan » — ACTIF / PASSIF sur le réalisé, avec résultat injecté
// ══════════════════════════════════════════════════════════════════════════════

const ACTIF_RUBRIQUES = ['Immobilisations', 'Stocks et en-cours', 'Créances', 'Trésorerie', 'Autres éléments d’actif'] as const
const PASSIF_RUBRIQUES = ['Capitaux propres', 'Dettes financières', 'Dettes d’exploitation', 'Autres éléments de passif'] as const

function actifRubrique(numero: string): string {
  if (numero.startsWith('2')) return 'Immobilisations'
  if (numero.startsWith('3')) return 'Stocks et en-cours'
  if (numero.startsWith('4')) return 'Créances'
  if (numero.startsWith('5')) return 'Trésorerie'
  return 'Autres éléments d’actif'
}
function passifRubrique(numero: string): string {
  if (numero.startsWith('16') || numero.startsWith('519') || numero.startsWith('5')) return 'Dettes financières'
  if (numero.startsWith('1')) return 'Capitaux propres'
  if (numero.startsWith('4')) return 'Dettes d’exploitation'
  return 'Autres éléments de passif'
}

interface BilanLigne { numero: string; libelle: string; montant: number; injectee?: boolean }
interface BilanRubrique { label: string; lignes: BilanLigne[]; total: number }

/** Agrège les lignes d'un côté du bilan (réalisé) par rubrique, une ligne par compte. */
function buildBilanCote(
  lignes: Ligne[],
  type: 'actif' | 'passif',
  rubriqueOf: (numero: string) => string,
  ordre: readonly string[],
  injectees?: { rubrique: string; ligne: BilanLigne }[],
): { rubriques: BilanRubrique[]; total: number } {
  const parCompte = new Map<string, BilanLigne>()
  for (const l of lignes) {
    if (l.compte?.type !== type) continue
    const existing = parCompte.get(l.compte_id)
    if (existing) existing.montant += l.montant_realise
    else parCompte.set(l.compte_id, { numero: l.compte.numero, libelle: l.compte.libelle, montant: l.montant_realise })
  }
  const parRubrique = new Map<string, BilanLigne[]>()
  for (const bl of Array.from(parCompte.values())) {
    if (bl.montant === 0) continue
    const rub = rubriqueOf(bl.numero)
    if (!parRubrique.has(rub)) parRubrique.set(rub, [])
    parRubrique.get(rub)!.push(bl)
  }
  for (const inj of injectees ?? []) {
    if (!parRubrique.has(inj.rubrique)) parRubrique.set(inj.rubrique, [])
    parRubrique.get(inj.rubrique)!.push(inj.ligne)
  }
  const rubriques: BilanRubrique[] = []
  for (const label of ordre) {
    const ls = parRubrique.get(label)
    if (!ls || ls.length === 0) continue
    ls.sort((a, b) => a.numero.localeCompare(b.numero))
    rubriques.push({ label, lignes: ls, total: ls.reduce((s, x) => s + x.montant, 0) })
  }
  return { rubriques, total: rubriques.reduce((s, r) => s + r.total, 0) }
}

function BilanColonne({ title, color, bg, rubriques, total }: {
  title: string; color: string; bg: string
  rubriques: BilanRubrique[]; total: number
}) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div className="px-4 py-3" style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
        <span className="font-bold text-sm uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Poste</th>
              <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Réalisé</th>
            </tr>
          </thead>
          <tbody>
            {rubriques.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: '1.25rem 0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Aucun montant réalisé sur cette colonne.
                </td>
              </tr>
            )}
            {rubriques.map(rub => (
              <React.Fragment key={rub.label}>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{rub.label}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(rub.total)}</td>
                </tr>
                {rub.lignes.map(bl => (
                  <tr key={rub.label + bl.numero + bl.libelle} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.4rem 0.75rem 0.4rem 1.6rem', fontSize: '0.8rem', color: bl.injectee ? color : 'var(--text)', fontStyle: bl.injectee ? 'italic' : 'normal' }}>
                      {bl.numero && <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem', fontFamily: 'monospace' }}>{bl.numero}</span>}
                      {bl.libelle}
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', color: bl.injectee ? color : 'var(--text)', fontStyle: bl.injectee ? 'italic' : 'normal' }}>
                      {fmt(bl.montant)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: bg, borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.88rem', color }}>TOTAL {title.toUpperCase()}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function BilanView({ lignes, exerciceNom, loading }: {
  /** Lignes consolidées feuilles (contribuant au budget général). */
  lignes: Ligne[]
  exerciceNom: string
  loading: boolean
}) {
  // Résultat de l'exercice (réalisé) — injecté dans les capitaux propres
  const resultatReal = useMemo(() => {
    const produits = lignes.filter(l => l.compte?.type === 'produit').reduce((s, l) => s + l.montant_realise, 0)
    const charges = lignes.filter(l => l.compte?.type === 'charge').reduce((s, l) => s + l.montant_realise, 0)
    return produits - charges
  }, [lignes])

  const actif = useMemo(
    () => buildBilanCote(lignes, 'actif', actifRubrique, ACTIF_RUBRIQUES),
    [lignes],
  )
  const passif = useMemo(
    () => buildBilanCote(lignes, 'passif', passifRubrique, PASSIF_RUBRIQUES, [
      { rubrique: 'Capitaux propres', ligne: { numero: '', libelle: 'Résultat de l’exercice', montant: resultatReal, injectee: true } },
    ]),
    [lignes, resultatReal],
  )

  const ecart = actif.total - passif.total
  const equilibre = Math.abs(ecart) < 0.005

  if (loading) {
    return <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Consolidation en cours…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <span className="text-lg">⚖️</span>
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>Bilan — {exerciceNom}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Comptes de bilan (classes 1 à 5) sur le réalisé. La ligne « Résultat de l’exercice » des capitaux propres est
            reprise du compte de résultat.
          </div>
        </div>
      </div>

      <div className="grid gap-6 items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <BilanColonne title="Actif" color={BLUE} bg={BLUE_BG} rubriques={actif.rubriques} total={actif.total} />
        <BilanColonne title="Passif" color={VIOLET} bg={VIOLET_BG} rubriques={passif.rubriques} total={passif.total} />
      </div>

      {/* Indicateur d'équilibre */}
      <div className="rounded-2xl p-5"
        style={{
          background: equilibre ? GREEN_BG : AMBER_BG,
          border: `1px solid ${equilibre ? GREEN : AMBER}40`,
        }}>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: BLUE, opacity: 0.85 }}>Total Actif</div>
            <div className="text-xl font-bold" style={{ color: BLUE }}>{fmt(actif.total)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: VIOLET, opacity: 0.85 }}>Total Passif</div>
            <div className="text-xl font-bold" style={{ color: VIOLET }}>{fmt(passif.total)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: equilibre ? GREEN : AMBER, opacity: 0.85 }}>Équilibre</div>
            <div className="text-xl font-bold" style={{ color: equilibre ? GREEN : AMBER }}>
              {equilibre ? '✓ Équilibré' : `${ecart > 0 ? '+' : ''}${fmt(ecart)}`}
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm font-semibold" style={{ color: equilibre ? GREEN : AMBER }}>
          {equilibre
            ? '✓ Le bilan est équilibré : Actif = Passif.'
            : `⚠️ Écart Actif − Passif de ${fmt(ecart)} — vérifiez les saisies des comptes de bilan dans le budget général.`}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Détail d'un exercice (Synthèse + Compte de résultat + Bilan + sous-budgets)
// ══════════════════════════════════════════════════════════════════════════════

const VUES_CALCULEES = ['synthese', 'resultat', 'bilan'] as const

function ExerciceDetail({ exerciceId, organisationId, readOnly, onBack }: {
  exerciceId: string
  organisationId: string
  readOnly: boolean
  onBack: () => void
}) {
  const [exercice, setExercice] = useState<Exercice | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([]) // lignes du sous-budget actif
  const [comptes, setComptes] = useState<Compte[]>([])
  const [loading, setLoading] = useState(true)
  const [subLoading, setSubLoading] = useState(false)
  const [editMeta, setEditMeta] = useState(false)
  const [metaForm, setMetaForm] = useState({ nom: '', statut: 'ouvert', notes: '' })

  // Navigation : "synthese" = consolidé (lecture seule) | "resultat" | "bilan"
  // | "general" (Budget général éditable) | centre_cout_id
  const [activeView, setActiveView] = useState<string>('synthese')
  const [subTab, setSubTab] = useState<'charges' | 'produits' | 'bilan'>('charges')

  // Centres de coût (budget_centres_cout org-keyed)
  const [centres, setCentres] = useState<CentreCout[]>([])
  const [centreSubs, setCentreSubs] = useState<CentreCoutSub[]>([])
  const [openedCentreIds, setOpenedCentreIds] = useState<string[]>([])
  const [showCentrePicker, setShowCentrePicker] = useState(false)
  const [showCentresModal, setShowCentresModal] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Lignes consolidées (toujours chargées — KPI + compte de résultat + bilan)
  const [globalLignes, setGlobalLignes] = useState<Ligne[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showQontoImport, setShowQontoImport] = useState(false)
  const [auditLigne, setAuditLigne] = useState<Ligne | null>(null)

  // Transfert d'une ligne de détail vers un autre sous-budget
  const [transferState, setTransferState] = useState<{ detailId: string; fromLigneId: string; compteId: string } | null>(null)
  const [transferTarget, setTransferTarget] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  const isCalcView = (VUES_CALCULEES as readonly string[]).includes(activeView)

  // Sous-budgets disponibles
  const addedCentreIds = new Set([...centreSubs.map(c => c.id), ...openedCentreIds])
  const sousBudgets: SousBudget[] = [
    SOUS_BUDGET_GENERAL,
    ...centreSubs.map(c => centreToSB(c)),
    ...openedCentreIds
      .filter(cid => !centreSubs.find(c => c.id === cid))
      .flatMap(cid => { const c = centres.find(x => x.id === cid); return c ? [centreToSB(c)] : [] }),
  ]
  const availableCentres = centres.filter(c => !addedCentreIds.has(c.id) && c.statut !== 'clos')
  const activeSB = !isCalcView
    ? sousBudgets.find(sb => sb.key === activeView) ?? SOUS_BUDGET_GENERAL
    : null
  const editable = exercice?.statut === 'ouvert' && !readOnly

  // ── Load helpers ───────────────────────────────────────────────────────────

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true)
    const r = await fetch(`${API}/exercices/${exerciceId}?affectation=all`)
    const d = await r.json()
    setGlobalLignes(d.lignes ?? [])
    setGlobalLoading(false)
  }, [exerciceId])

  const loadSubLignes = useCallback(async (sbKey: string) => {
    setSubLoading(true)
    const params = sbKey === 'general'
      ? '?affectation=general'
      : `?affectation=centre_cout&centre_cout_id=${sbKey}`
    const r = await fetch(`${API}/exercices/${exerciceId}${params}`)
    const d = await r.json()
    setLignes(d.lignes ?? [])
    setSubLoading(false)
  }, [exerciceId])

  const loadCentres = useCallback(async () => {
    const r = await fetch(`${API}/centres-cout?organisation_id=${organisationId}`)
    const d = await r.json().catch(() => [])
    if (r.ok && Array.isArray(d)) setCentres(d)
  }, [organisationId])

  // Chargement initial en parallèle
  useEffect(() => {
    Promise.all([
      fetch(`${API}/exercices/${exerciceId}?affectation=general`).then(r => r.json()),
      fetch(`${API}/comptes`).then(r => r.json()),
      fetch(`${API}/exercices/${exerciceId}?affectation=all`).then(r => r.json()),
      fetch(`${API}/centres-cout?organisation_id=${organisationId}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/exercices/${exerciceId}/centre-cout-subs`).then(r => r.json()),
    ]).then(([exData, cptData, globalData, ccData, subsData]) => {
      if (exData.exercice) {
        setExercice(exData.exercice)
        setMetaForm({ nom: exData.exercice.nom, statut: exData.exercice.statut, notes: exData.exercice.notes ?? '' })
      }
      if (Array.isArray(exData.lignes)) setLignes(exData.lignes)
      setComptes(Array.isArray(cptData) ? cptData : [])
      setGlobalLignes(globalData.lignes ?? [])
      setGlobalLoading(false)
      if (Array.isArray(ccData)) setCentres(ccData)
      if (Array.isArray(subsData)) setCentreSubs(subsData)
      setLoading(false)
    })
  }, [exerciceId, organisationId])

  // Charger lignes du sous-budget quand activeView change
  useEffect(() => {
    if (!(VUES_CALCULEES as readonly string[]).includes(activeView)) loadSubLignes(activeView)
  }, [activeView, loadSubLignes])

  // Fermer picker sur clic extérieur
  useEffect(() => {
    if (!showCentrePicker) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowCentrePicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCentrePicker])

  const reloadComptes = useCallback(async () => {
    const r = await fetch(`${API}/comptes`)
    const d = await r.json()
    setComptes(Array.isArray(d) ? d : [])
  }, [])

  // ── Création d'un sous-compte ──────────────────────────────────────────────

  const addSubCompte = useCallback(async (parentId: string, numero: string, libelle: string) => {
    const parentCompte = comptes.find(c => c.id === parentId)
    if (!parentCompte) return
    const r = await fetch(`${API}/comptes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero, libelle,
        type: parentCompte.type,
        parent_id: parentId,
        sort_order: parseInt(numero, 10) || 0,
      }),
    })
    const d = await r.json()
    if (!r.ok) { setSaveError(d.error ?? 'Erreur lors de la création du sous-compte'); return }
    setSaveError(null)
    await reloadComptes()
  }, [comptes, reloadComptes])

  // ── Réordonnancement des détails (drag & drop) ─────────────────────────────

  const reorderDetails = useCallback(async (ligneId: string, draggedId: string, targetId: string, position: 'before' | 'after') => {
    const ligne = lignes.find(l => l.id === ligneId)
    if (!ligne || !ligne.details) return

    const details = [...ligne.details].filter(d => !d.draft)
    const draggedIdx = details.findIndex(d => d.id === draggedId)
    const targetIdx = details.findIndex(d => d.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1) return

    const reordered = details.filter(d => d.id !== draggedId)
    const insertAt = reordered.findIndex(d => d.id === targetId)
    reordered.splice(position === 'before' ? insertAt : insertAt + 1, 0, details[draggedIdx])

    const withNewOrder = reordered.map((d, i) => ({ ...d, sort_order: i }))
    setLignes(prevL => prevL.map(l => l.id === ligneId ? { ...l, details: withNewOrder } : l))

    await fetch(`${API}/lignes-details`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: withNewOrder.map(d => ({ id: d.id, sort_order: d.sort_order })) }),
    })
  }, [lignes])

  // ── Toggle contribue_budget_general (global) ───────────────────────────────

  const toggleAllBudgetGeneral = useCallback(async (newValue: boolean) => {
    if (lignes.length === 0) return
    setLignes(prevL => prevL.map(l => ({ ...l, contribue_budget_general: newValue })))
    const results = await Promise.all(
      lignes.map(l =>
        fetch(`${API}/lignes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: l.id, contribue_budget_general: newValue }),
        })
      )
    )
    if (results.some(r => !r.ok)) await loadSubLignes(activeView)
    loadGlobal()
  }, [lignes, activeView, loadSubLignes, loadGlobal])

  // ── Toggle contribue_budget_general (ligne individuelle, avec audit) ───────

  const toggleBudgetGeneral = useCallback(async (ligneId: string, currentValue: boolean) => {
    const newValue = !currentValue
    setLignes(prevL => prevL.map(l => l.id === ligneId ? { ...l, contribue_budget_general: newValue } : l))
    const r = await fetch(`${API}/lignes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ligneId,
        contribue_budget_general: newValue,
        // Journal d'audit
        champ: 'contribue_budget_general',
        old_value: String(currentValue),
        new_value: String(newValue),
      }),
    })
    if (!r.ok) {
      setLignes(prevL => prevL.map(l => l.id === ligneId ? { ...l, contribue_budget_general: currentValue } : l))
    } else {
      loadGlobal()
    }
  }, [loadGlobal])

  // ── Déplacement d'un détail vers un autre compte (drag & drop) ─────────────

  const moveDetail = useCallback(async (detailId: string, fromLigneId: string, toCompteId: string) => {
    if (!activeSB) return
    setSaveError(null)

    let toLigne = lignes.find(l => l.compte_id === toCompteId)
    if (!toLigne) {
      const r = await fetch(`${API}/lignes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercice_id: exerciceId,
          compte_id: toCompteId,
          affectation_type: activeSB.affectation_type,
          centre_cout_id: activeSB.centre_cout_id ?? null,
          montant_previsionnel: 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setSaveError(d.error ?? 'Erreur lors du déplacement'); return }
      toLigne = { ...d, details: [] } as Ligne
      setLignes(prevL => [...prevL, toLigne as Ligne])
    }

    const r = await fetch(`${API}/lignes-details`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailId, ligne_id: fromLigneId, move_to_ligne_id: toLigne!.id }),
    })
    if (!r.ok) {
      const d = await r.json()
      setSaveError(d.error ?? 'Erreur lors du déplacement')
      return
    }

    await loadSubLignes(activeView)
    loadGlobal()
  }, [exerciceId, lignes, activeSB, activeView, loadSubLignes, loadGlobal])

  // ── Ajout d'un brouillon local (persisté à la première saisie) ─────────────

  const addDetail = useCallback(async (compteId: string) => {
    if (!activeSB) return
    setSaveError(null)

    let ligne = lignes.find(l => l.compte_id === compteId)
    if (!ligne) {
      const r = await fetch(`${API}/lignes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercice_id: exerciceId,
          compte_id: compteId,
          affectation_type: activeSB.affectation_type,
          centre_cout_id: activeSB.centre_cout_id ?? null,
          montant_previsionnel: 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setSaveError(d.error ?? 'Erreur lors de la création de la ligne'); return }
      ligne = { ...d, details: [] } as Ligne
      setLignes(prevL => [...prevL, ligne as Ligne])
    }

    const ligneId = (ligne as Ligne).id
    const draftDetail: Detail = {
      id: `draft-${Date.now()}`,
      ligne_id: ligneId,
      commentaire: '',
      montant_previsionnel: 0,
      montant_realise: 0,
      sort_order: Date.now(),
      draft: true,
    }
    setLignes(prevL => prevL.map(l =>
      l.id === ligneId ? { ...l, details: [...(l.details ?? []), draftDetail] } : l
    ))
  }, [exerciceId, lignes, activeSB])

  const updateDetail = useCallback(async (detailId: string, ligneId: string, field: 'commentaire' | 'montant_previsionnel' | 'montant_realise', value: string | number) => {
    // ── Brouillon : mise à jour locale ou première sauvegarde ─────────────────
    if (detailId.startsWith('draft-')) {
      const ligne = lignes.find(l => l.id === ligneId)
      const draft = ligne?.details.find(d => d.id === detailId)
      if (!draft) return
      const updated: Detail = { ...draft, [field]: value }

      const hasContent = updated.commentaire.trim() !== '' || updated.montant_previsionnel !== 0 || updated.montant_realise !== 0
      if (!hasContent) {
        setLignes(prevL => prevL.map(l =>
          l.id !== ligneId ? l : { ...l, details: l.details.map(d => d.id === detailId ? updated : d) }
        ))
        return
      }

      const r = await fetch(`${API}/lignes-details`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ligne_id: ligneId,
          commentaire: updated.commentaire,
          montant_previsionnel: updated.montant_previsionnel,
          montant_realise: updated.montant_realise,
          sort_order: updated.sort_order,
        }),
      })
      const saved = await r.json()
      if (!r.ok) { setSaveError(saved.error ?? 'Erreur ajout détail'); return }
      setSaveError(null)
      setLignes(prevL => prevL.map(l => {
        if (l.id !== ligneId) return l
        const details = l.details.map(d => d.id === detailId ? saved : d)
        return {
          ...l, details,
          montant_previsionnel: details.filter(d => !d.draft).reduce((s, d) => s + (d.montant_previsionnel || 0), 0),
          montant_realise: details.filter(d => !d.draft).reduce((s, d) => s + (d.montant_realise || 0), 0),
        }
      }))
      loadGlobal()
      return
    }

    // ── Enregistrement existant — PATCH ────────────────────────────────────────
    const r = await fetch(`${API}/lignes-details`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailId, ligne_id: ligneId, [field]: value }),
    })
    if (r.ok) {
      const d = await r.json()
      setLignes(prevL => prevL.map(l => {
        if (l.id !== ligneId) return l
        const details = l.details.map(det => det.id === detailId ? d : det)
        return {
          ...l, details,
          montant_previsionnel: details.filter(dd => !dd.draft).reduce((s, dd) => s + (dd.montant_previsionnel || 0), 0),
          montant_realise: details.filter(dd => !dd.draft).reduce((s, dd) => s + (dd.montant_realise || 0), 0),
        }
      }))
      loadGlobal()
    }
  }, [lignes, loadGlobal])

  const deleteDetail = useCallback(async (detailId: string, ligneId: string) => {
    if (detailId.startsWith('draft-')) {
      setLignes(prevL => prevL.map(l =>
        l.id !== ligneId ? l : { ...l, details: l.details.filter(d => d.id !== detailId) }
      ))
      return
    }
    await fetch(`${API}/lignes-details`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detailId, ligne_id: ligneId }),
    })
    setLignes(prevL => prevL.map(l => {
      if (l.id !== ligneId) return l
      const details = l.details.filter(d => d.id !== detailId)
      return {
        ...l, details,
        montant_previsionnel: details.filter(d => !d.draft).reduce((s, d) => s + (d.montant_previsionnel || 0), 0),
        montant_realise: details.filter(d => !d.draft).reduce((s, d) => s + (d.montant_realise || 0), 0),
      }
    }))
    loadGlobal()
  }, [loadGlobal])

  async function saveMeta() {
    const r = await fetch(`${API}/exercices/${exerciceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaForm),
    })
    if (r.ok) { const d = await r.json(); setExercice(d); setEditMeta(false) }
  }

  // ── Transfert d'une ligne de détail ────────────────────────────────────────

  async function doTransfer() {
    if (!transferState || !transferTarget) return
    setTransferring(true)
    setTransferError(null)
    const target = sousBudgets.find(sb => sb.key === transferTarget)
    if (!target) { setTransferring(false); return }
    const r = await fetch(`${API}/transfert-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        detail_id: transferState.detailId,
        from_ligne_id: transferState.fromLigneId,
        exercice_id: exerciceId,
        compte_id: transferState.compteId,
        target_affectation_type: target.affectation_type,
        target_centre_cout_id: target.centre_cout_id ?? null,
      }),
    })
    if (!r.ok) {
      const d = await r.json()
      setTransferError(d.error ?? 'Erreur lors du transfert')
      setTransferring(false)
      return
    }
    setTransferState(null)
    setTransferTarget('')
    if (!isCalcView) loadSubLignes(activeView)
    loadGlobal()
    setTransferring(false)
  }

  // ── KPI + consolidation ────────────────────────────────────────────────────

  const mergedLignes = useMemo(() => mergeGlobalLignes(globalLignes), [globalLignes])

  const groupCompteIds = new Set<string>()
  for (const c of comptes) { if (c.parent_id) groupCompteIds.add(c.parent_id) }
  const leafGlobalLignes = globalLignes.filter(l => !groupCompteIds.has(l.compte_id) && l.contribue_budget_general !== false)

  const kpiLignes = isCalcView
    ? leafGlobalLignes
    : lignes.filter(l => !groupCompteIds.has(l.compte_id))
  const kpiLabel = isCalcView
    ? 'Budget consolidé de l’entreprise'
    : (activeSB?.label ?? 'Sous-budget actif')

  const kpiCharges = kpiLignes.filter(l => l.compte?.type === 'charge')
  const kpiProduits = kpiLignes.filter(l => l.compte?.type === 'produit')
  const totalChargesPrev = kpiCharges.reduce((s, l) => s + l.montant_previsionnel, 0)
  const totalProduitsPrev = kpiProduits.reduce((s, l) => s + l.montant_previsionnel, 0)
  const totalChargesReal = kpiCharges.reduce((s, l) => s + l.montant_realise, 0)
  const totalProduitsReal = kpiProduits.reduce((s, l) => s + l.montant_realise, 0)
  const resultatPrev = totalProduitsPrev - totalChargesPrev
  const resultatReal = totalProduitsReal - totalChargesReal

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!exercice) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      Exercice introuvable. <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>← Retour</button>
    </div>
  )

  // ── Totaux par sous-budget (cartes de la vue synthèse) ─────────────────────

  function sbTotals(ls: Ligne[]) {
    const ch = ls.filter(l => l.compte?.type === 'charge')
    const pr = ls.filter(l => l.compte?.type === 'produit')
    return {
      chargesPrev: ch.reduce((s, l) => s + l.montant_previsionnel, 0),
      produitsPrev: pr.reduce((s, l) => s + l.montant_previsionnel, 0),
      chargesReal: ch.reduce((s, l) => s + l.montant_realise, 0),
      produitsReal: pr.reduce((s, l) => s + l.montant_realise, 0),
    }
  }

  const generalLignes = leafGlobalLignes.filter(l => l.affectation_type === 'general')
  const centreLignesMap = new Map<string, Ligne[]>()
  for (const l of leafGlobalLignes) {
    if (l.affectation_type === 'centre_cout' && l.centre_cout_id) {
      if (!centreLignesMap.has(l.centre_cout_id)) centreLignesMap.set(l.centre_cout_id, [])
      centreLignesMap.get(l.centre_cout_id)!.push(l)
    }
  }

  type SBCard = { key: string; icon: string; label: string; totals: ReturnType<typeof sbTotals>; sbKey: string }
  const sbCards: SBCard[] = [
    { key: 'general', icon: '🏢', label: 'Budget général de l’entreprise', totals: sbTotals(generalLignes), sbKey: 'general' },
    ...Array.from(centreLignesMap.entries()).map(([centreId, ls]) => {
      const centre = centres.find(c => c.id === centreId)
      return {
        key: centreId,
        icon: centre ? centreIcon(centre.statut) : '🎯',
        label: centre ? centreLabel(centre) : 'Centre de coût',
        totals: sbTotals(ls),
        sbKey: centreId,
      }
    }),
  ]

  const openSB = (key: string) => { setActiveView(key); setSubTab('charges') }

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Header exercice ── */}
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <button onClick={onBack} title="Retour aux exercices"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1.3, padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          {editMeta ? (
            <div className="flex flex-col gap-3 max-w-lg">
              <input style={inp} value={metaForm.nom} onChange={e => setMetaForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" />
              <div className="flex gap-3">
                <select style={{ ...inp, flex: 1 }} value={metaForm.statut} onChange={e => setMetaForm(f => ({ ...f, statut: e.target.value }))}>
                  <option value="ouvert">Ouvert</option>
                  <option value="cloture">Clôturé</option>
                  <option value="archive">Archivé</option>
                </select>
                <button onClick={saveMeta} style={btnPrimary}>Enregistrer</button>
                <button onClick={() => setEditMeta(false)} style={btnGhost}>Annuler</button>
              </div>
              <input style={inp} value={metaForm.notes} onChange={e => setMetaForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{exercice.nom}</h1>
                <span className="text-xs px-2 py-1 rounded-full font-semibold"
                  style={{ background: STATUT_LABEL[exercice.statut]?.bg, color: STATUT_LABEL[exercice.statut]?.color }}>
                  {STATUT_LABEL[exercice.statut]?.label}
                </span>
                {exercice.structure && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                    🏢 {exercice.structure.raison_sociale}
                  </span>
                )}
                {!readOnly && (
                  <button onClick={() => setEditMeta(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>✏️ Modifier</button>
                )}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{fmtDate(exercice.date_debut)} → {fmtDate(exercice.date_fin)}</p>
              {exercice.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{exercice.notes}</p>}
            </>
          )}
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: 'Charges totales', val: totalChargesPrev, color: RED, bg: RED_BG },
          { label: 'Produits totaux', val: totalProduitsPrev, color: GREEN, bg: GREEN_BG },
          { label: 'Résultat prévisionnel', val: resultatPrev, color: resultatPrev >= 0 ? GREEN : RED, bg: resultatPrev >= 0 ? GREEN_BG : RED_BG },
          { label: 'Réalisé net', val: resultatReal, color: resultatReal >= 0 ? GREEN : RED, bg: resultatReal >= 0 ? GREEN_BG : RED_BG },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: k.bg, border: '1px solid var(--border)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: k.color, opacity: 0.8 }}>{k.label}</div>
            <div className="text-xl font-bold" style={{ color: k.color }}>
              {globalLoading ? <span style={{ opacity: 0.4 }}>…</span> : fmt(k.val)}
            </div>
            {!globalLoading && k.label === 'Résultat prévisionnel' && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{kpiLabel}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Barre d'onglets unifiée ── */}
      <div className="flex gap-1 mb-6 items-end flex-wrap" style={{ borderBottom: '2px solid var(--border)' }}>
        {([
          { key: 'synthese', label: '📊 Synthèse' },
          { key: 'resultat', label: '📈 Compte de résultat' },
          { key: 'bilan', label: '⚖️ Bilan' },
        ] as const).map(v => (
          <button key={v.key} onClick={() => setActiveView(v.key)}
            style={{
              padding: '0.6rem 1.1rem', borderRadius: '0.5rem 0.5rem 0 0',
              fontWeight: 600, fontSize: '0.88rem', border: 'none', cursor: 'pointer',
              background: activeView === v.key ? 'var(--accent)' : 'transparent',
              color: activeView === v.key ? 'var(--accent-fg)' : 'var(--text)',
              borderBottom: activeView === v.key ? '2px solid var(--accent)' : 'none',
              marginBottom: -2,
            }}>
            {v.label}
          </button>
        ))}

        <div style={{ width: 1, height: 28, background: 'var(--border)', marginBottom: 2, flexShrink: 0 }} />

        {sousBudgets.map(sb => {
          const isActive = activeView === sb.key
          const sub = sb.affectation_type === 'centre_cout' ? centreSubs.find(c => c.id === sb.centre_cout_id) : null
          return (
            <button key={sb.key} onClick={() => openSB(sb.key)}
              style={{
                padding: '0.6rem 1.1rem', borderRadius: '0.5rem 0.5rem 0 0',
                fontWeight: 600, fontSize: '0.88rem', border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--accent-fg)' : 'var(--text)',
                borderBottom: isActive ? '2px solid var(--accent)' : 'none',
                marginBottom: -2,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
              <span>{sb.icon}</span>
              <span>{sb.label}</span>
              {sub && (sub.total_charges_prev > 0 || sub.total_produits_prev > 0) && (
                <span style={{
                  fontSize: '0.65rem',
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(99,102,241,0.12)',
                  color: isActive ? 'var(--accent-fg)' : 'var(--accent)',
                  borderRadius: '0.5rem', padding: '0.1rem 0.4rem', fontWeight: 700,
                }}>
                  {Math.max(sub.total_charges_prev, sub.total_produits_prev).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </span>
              )}
            </button>
          )
        })}

        {/* + Centre de coût picker */}
        {!readOnly && (
          <div ref={pickerRef} style={{ position: 'relative', marginBottom: 2 }}>
            <button onClick={() => setShowCentrePicker(v => !v)}
              style={{
                padding: '0.55rem 0.9rem', borderRadius: '0.5rem',
                fontWeight: 600, fontSize: '0.85rem',
                background: showCentrePicker ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: 'var(--accent)', border: '1px dashed var(--accent)', cursor: 'pointer',
              }}>
              + Centre de coût
            </button>
            {showCentrePicker && (
              <div className="absolute z-50 mt-1 rounded-xl shadow-lg overflow-hidden"
                style={{ top: '100%', left: 0, minWidth: 260, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {availableCentres.length === 0 ? (
                  <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {centres.length === 0 ? 'Aucun centre de coût créé' : 'Tous les centres de coût sont déjà ajoutés'}
                  </div>
                ) : (
                  <>
                    <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Ajouter un sous-budget Centre de coût
                    </div>
                    {availableCentres.map(c => (
                      <button key={c.id}
                        onClick={() => {
                          setOpenedCentreIds(prevIds => [...prevIds, c.id])
                          openSB(c.id)
                          setShowCentrePicker(false)
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span>{centreIcon(c.statut)}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.nom}</div>
                          {c.code && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.code}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
                <div className="px-4 py-2">
                  <button onClick={() => { setShowCentrePicker(false); setShowCentresModal(true) }}
                    className="text-xs" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}>
                    ⚙️ Gérer les centres de coût →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ VUE : Compte de résultat (calculée, lecture seule) ══ */}
      {activeView === 'resultat' && (
        <CompteResultatView lignes={leafGlobalLignes} exerciceNom={exercice.nom} loading={globalLoading} />
      )}

      {/* ══ VUE : Bilan (calculée, lecture seule) ══ */}
      {activeView === 'bilan' && (
        <BilanView lignes={leafGlobalLignes} exerciceNom={exercice.nom} loading={globalLoading} />
      )}

      {/* ══ VUE : Synthèse (consolidé, lecture seule) ══ */}
      {activeView === 'synthese' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>Synthèse — vue consolidée</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Cette vue est la somme du budget général et de tous les centres de coût. Elle ne peut pas être modifiée directement.
                </div>
                {(() => {
                  const excl = globalLignes.filter(l => l.contribue_budget_general === false).length
                  return excl > 0 ? (
                    <div className="text-xs mt-1" style={{ color: AMBER }}>
                      ⊘ {excl} ligne{excl > 1 ? 's' : ''} exclu{excl > 1 ? 'es' : 'e'} de la consolidation dans les sous-budgets
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          </div>

          {globalLoading ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Consolidation en cours…</div>
          ) : (
            <>
              {/* Synthèse chiffrée */}
              <div className="rounded-2xl p-5"
                style={{ background: resultatPrev >= 0 ? GREEN_BG : RED_BG, border: '1px solid var(--border)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Synthèse consolidée · {exercice.nom}
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {[
                    { label: 'Charges totales', val: totalChargesPrev, color: RED },
                    { label: 'Produits totaux', val: totalProduitsPrev, color: GREEN },
                    { label: 'Résultat prévisionnel', val: resultatPrev, color: resultatPrev >= 0 ? GREEN : RED },
                    { label: 'Réalisé net', val: resultatReal, color: resultatReal >= 0 ? GREEN : RED },
                  ].map(k => (
                    <div key={k.label}>
                      <div className="text-xs font-semibold mb-1" style={{ color: k.color, opacity: 0.8 }}>{k.label}</div>
                      <div className="text-xl font-bold" style={{ color: k.color }}>
                        {k.val >= 0 && k.label.includes('Résultat') ? '+' : ''}{fmt(k.val)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm font-semibold" style={{ color: resultatPrev >= 0 ? GREEN : RED }}>
                  {resultatPrev === 0 ? '✓ Budget consolidé équilibré'
                    : resultatPrev > 0 ? `✓ Excédent consolidé de ${fmt(resultatPrev)}`
                    : `⚠️ Déficit consolidé de ${fmt(Math.abs(resultatPrev))}`}
                </div>
              </div>

              {/* Tableaux complets consolidés */}
              <BudgetSection
                title="Charges" type="charge"
                comptes={comptes} lignes={mergedLignes} editable={false}
                onAddDetail={async () => {}} onUpdateDetail={async () => {}} onDeleteDetail={async () => {}}
                onAddSubCompte={async () => {}}
              />
              <BudgetSection
                title="Produits" type="produit"
                comptes={comptes} lignes={mergedLignes} editable={false}
                onAddDetail={async () => {}} onUpdateDetail={async () => {}} onDeleteDetail={async () => {}}
                onAddSubCompte={async () => {}}
              />
              {mergedLignes.some(l => l.compte?.type === 'actif' || l.compte?.type === 'passif') && (
                <>
                  <BudgetSection
                    title="Comptes d’actif" type="actif"
                    comptes={comptes} lignes={mergedLignes} editable={false}
                    onAddDetail={async () => {}} onUpdateDetail={async () => {}} onDeleteDetail={async () => {}}
                    onAddSubCompte={async () => {}}
                  />
                  <BudgetSection
                    title="Comptes de passif" type="passif"
                    comptes={comptes} lignes={mergedLignes} editable={false}
                    onAddDetail={async () => {}} onUpdateDetail={async () => {}} onDeleteDetail={async () => {}}
                    onAddSubCompte={async () => {}}
                  />
                </>
              )}

              {/* Cartes par sous-budget */}
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {sbCards.map(card => {
                  const res = card.totals.produitsPrev - card.totals.chargesPrev
                  const resReal = card.totals.produitsReal - card.totals.chargesReal
                  const hasData = card.totals.chargesPrev > 0 || card.totals.produitsPrev > 0
                  return (
                    <div key={card.key} className="rounded-2xl overflow-hidden"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                      <div className="px-4 py-3 flex items-center justify-between"
                        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span>{card.icon}</span>
                          <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{card.label}</span>
                        </div>
                        <button
                          onClick={() => openSB(card.sbKey)}
                          className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--accent)', cursor: 'pointer' }}>
                          {readOnly ? 'Consulter →' : 'Gérer →'}
                        </button>
                      </div>
                      <div className="p-4">
                        {!hasData ? (
                          <div className="py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Aucune ligne budgétaire</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Charges prév.</span>
                              <span className="text-sm font-semibold" style={{ color: RED }}>{fmt(card.totals.chargesPrev)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Produits prév.</span>
                              <span className="text-sm font-semibold" style={{ color: GREEN }}>{fmt(card.totals.produitsPrev)}</span>
                            </div>
                            <div className="h-px my-1" style={{ background: 'var(--border)' }} />
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Résultat prév.</span>
                              <span className="text-sm font-bold" style={{ color: res >= 0 ? GREEN : RED }}>
                                {res >= 0 ? '+' : ''}{fmt(res)}
                              </span>
                            </div>
                            {(card.totals.chargesReal > 0 || card.totals.produitsReal > 0) && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Réalisé net</span>
                                <span className="text-sm" style={{ color: resReal >= 0 ? GREEN : RED }}>
                                  {resReal >= 0 ? '+' : ''}{fmt(resReal)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Ajouter un centre de coût */}
                {!readOnly && (
                  <div className="rounded-2xl flex items-center justify-center"
                    style={{ border: '1px dashed var(--border)', background: 'var(--bg)', minHeight: 140 }}>
                    <button onClick={() => setShowCentrePicker(true)}
                      className="flex flex-col items-center gap-2 text-sm font-semibold"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
                      <span className="text-2xl">+</span>
                      <span>Ajouter un centre de coût</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ VUE : Sous-budget éditable (Budget général ou Centre de coût) ══ */}
      {!isCalcView && activeSB && (
        <div>
          {(() => {
            const centreDetail = activeSB.affectation_type === 'centre_cout'
              ? centres.find(c => c.id === activeSB.centre_cout_id)
              : null
            const isGeneral = activeSB.affectation_type === 'general'
            return (
              <div className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between flex-wrap gap-2"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{activeSB.icon}</span>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{activeSB.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isGeneral
                        ? 'Charges, produits et comptes de bilan de l’entreprise (hors centres de coût)'
                        : centreDetail?.code
                          ? `Centre de coût ${centreDetail.code}${centreDetail.statut === 'clos' ? ' · clos' : ''}`
                          : 'Sous-budget Centre de coût'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {editable && (
                    <>
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                          display: 'inline-block', boxShadow: '0 0 0 2px rgba(99,102,241,0.25)', flexShrink: 0,
                        }} />
                        Ouvert
                      </span>
                      {/* Exclusion globale — centres de coût uniquement */}
                      {activeSB.affectation_type === 'centre_cout' && lignes.length > 0 && (() => {
                        const allExcluded = lignes.every(l => l.contribue_budget_general === false)
                        const someExcluded = !allExcluded && lignes.some(l => l.contribue_budget_general === false)
                        return (
                          <button
                            onClick={() => toggleAllBudgetGeneral(allExcluded)}
                            title={allExcluded
                              ? 'Réintégrer toutes les lignes dans la consolidation'
                              : 'Exclure toutes les lignes de ce centre de coût de la consolidation'}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5"
                            style={allExcluded
                              ? { background: AMBER_BG, color: AMBER, border: `1px solid ${AMBER}40`, cursor: 'pointer' }
                              : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                            {allExcluded ? '↩ Inclure dans la conso' : '⊘ Exclure de la conso'}
                            {someExcluded && (
                              <span title="Certaines lignes sont déjà exclues" style={{
                                width: 6, height: 6, borderRadius: '50%', background: AMBER, display: 'inline-block', flexShrink: 0,
                              }} />
                            )}
                          </button>
                        )
                      })()}
                      <button
                        onClick={() => setShowImport(true)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                        📥 Importer Excel
                      </button>
                      <button
                        onClick={() => setShowQontoImport(true)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                        🏦 Import Qonto
                      </button>
                      <button
                        onClick={() => setShowCentresModal(true)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        ⚙️ Centres de coût
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Onglets Charges / Produits (+ Comptes de bilan sur le budget général) */}
          <div className="flex gap-1 mb-5" style={{ borderBottom: '2px solid var(--border)' }}>
            {(activeSB.affectation_type === 'general'
              ? (['charges', 'produits', 'bilan'] as const)
              : (['charges', 'produits'] as const)
            ).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                style={{
                  padding: '0.55rem 1rem', borderRadius: '0.5rem 0.5rem 0 0',
                  fontWeight: 600, fontSize: '0.86rem', border: 'none', cursor: 'pointer',
                  background: subTab === t ? 'var(--accent)' : 'transparent',
                  color: subTab === t ? 'var(--accent-fg)' : 'var(--text)',
                  borderBottom: subTab === t ? '2px solid var(--accent)' : 'none',
                  marginBottom: -2,
                }}>
                {t === 'charges' ? '📤 Charges' : t === 'produits' ? '📥 Produits' : '🏦 Comptes de bilan'}
              </button>
            ))}
          </div>

          {subLoading ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Chargement du sous-budget…</div>
          ) : subTab === 'bilan' && activeSB.affectation_type === 'general' ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: BLUE_BG, border: `1px solid ${BLUE}40` }}>
                <span className="text-lg">🏦</span>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Les comptes de bilan (classes 1 à 5, typés actif ou passif) ne sont saisis que dans le budget général —
                  ils n’existent pas dans les centres de coût. Ils alimentent la vue « Bilan » de l’exercice.
                </div>
              </div>
              <BudgetSection
                title="Comptes d’actif"
                type="actif"
                comptes={comptes}
                lignes={lignes}
                editable={editable}
                onAddDetail={addDetail}
                onUpdateDetail={updateDetail}
                onDeleteDetail={deleteDetail}
                onAddSubCompte={addSubCompte}
                onMoveDetail={editable ? moveDetail : undefined}
                onReorderDetail={editable ? reorderDetails : undefined}
                onShowAudit={setAuditLigne}
              />
              <BudgetSection
                title="Comptes de passif"
                type="passif"
                comptes={comptes}
                lignes={lignes}
                editable={editable}
                onAddDetail={addDetail}
                onUpdateDetail={updateDetail}
                onDeleteDetail={deleteDetail}
                onAddSubCompte={addSubCompte}
                onMoveDetail={editable ? moveDetail : undefined}
                onReorderDetail={editable ? reorderDetails : undefined}
                onShowAudit={setAuditLigne}
              />
            </div>
          ) : (
            <BudgetSection
              title={subTab === 'charges' ? 'Charges' : 'Produits'}
              type={subTab === 'charges' ? 'charge' : 'produit'}
              comptes={comptes}
              lignes={lignes}
              editable={editable}
              onAddDetail={addDetail}
              onUpdateDetail={updateDetail}
              onDeleteDetail={deleteDetail}
              onTransfer={editable && sousBudgets.length > 1
                ? (detailId, fromLigneId, compteId) => {
                    setTransferState({ detailId, fromLigneId, compteId })
                    setTransferTarget('')
                    setTransferError(null)
                  }
                : undefined}
              onAddSubCompte={addSubCompte}
              onMoveDetail={editable ? moveDetail : undefined}
              onReorderDetail={editable ? reorderDetails : undefined}
              onToggleBudgetGeneral={editable && activeSB.affectation_type === 'centre_cout' ? toggleBudgetGeneral : undefined}
              onShowAudit={setAuditLigne}
            />
          )}

          {saveError && (
            <div className="mt-4 rounded-xl px-4 py-3 text-sm flex items-center justify-between"
              style={{ background: RED_BG, color: RED, border: `1px solid ${RED}40` }}>
              <span>⚠️ {saveError}</span>
              <button onClick={() => setSaveError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontWeight: 700, fontSize: '1rem', padding: '0 0.3rem' }}>×</button>
            </div>
          )}

          {!editable && (
            <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: AMBER_BG, color: AMBER, border: `1px solid ${AMBER}40` }}>
              ⚠️ {readOnly
                ? 'Dossier partagé en lecture seule — modifications désactivées.'
                : <>Cet exercice est <strong>{exercice.statut === 'cloture' ? 'clôturé' : 'archivé'}</strong> — modifications désactivées.</>}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ── */}
      {showImport && activeSB && (
        <ImportModal
          activeSB={activeSB}
          exerciceId={exerciceId}
          comptes={comptes}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            await loadSubLignes(activeView)
            loadGlobal()
          }}
        />
      )}

      {showQontoImport && activeSB && (
        <QontoImportModal
          organisationId={organisationId}
          organisationNom={exercice.structure?.raison_sociale ?? 'l’organisation'}
          exerciceId={exerciceId}
          dateDebut={exercice.date_debut}
          dateFin={exercice.date_fin}
          sousBudgets={sousBudgets}
          defaultSBKey={activeSB.key}
          comptes={comptes}
          onClose={() => setShowQontoImport(false)}
          onImported={async () => {
            await loadSubLignes(activeView)
            loadGlobal()
          }}
        />
      )}

      {showCentresModal && (
        <CentresCoutModal
          organisationId={organisationId}
          centres={centres}
          onClose={() => setShowCentresModal(false)}
          onChanged={loadCentres}
        />
      )}

      {auditLigne && <AuditModal ligne={auditLigne} onClose={() => setAuditLigne(null)} />}

      {transferState && (
        <div style={{ ...overlay, zIndex: 150 }}>
          <div className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minWidth: 340, maxWidth: 420 }}>
            <div className="font-bold text-base" style={{ color: 'var(--text)' }}>
              ⇄ Transférer cette ligne de détail
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Cette écriture individuelle sera déplacée vers le sous-budget sélectionné.
              Le total du compte sera recalculé automatiquement dans les deux sous-budgets.
            </div>
            <select
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              style={inp}>
              <option value="">— Choisir le sous-budget cible —</option>
              {sousBudgets
                .filter(sb => sb.key !== activeView)
                .map(sb => (
                  <option key={sb.key} value={sb.key}>{sb.icon} {sb.label}</option>
                ))}
            </select>
            {transferError && (
              <div className="rounded-xl px-4 py-2 text-sm" style={{ background: RED_BG, color: RED }}>
                {transferError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setTransferState(null); setTransferTarget(''); setTransferError(null) }}
                style={btnGhost}>
                Annuler
              </button>
              <button
                onClick={doTransfer}
                disabled={!transferTarget || transferring}
                style={{ ...btnPrimary, opacity: !transferTarget || transferring ? 0.5 : 1, cursor: !transferTarget || transferring ? 'not-allowed' : 'pointer' }}>
                {transferring ? 'Transfert…' : 'Transférer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Création d'un exercice
// ══════════════════════════════════════════════════════════════════════════════

function NouvelExercice({ organisationId, organisationNom, onCancel, onCreated }: {
  organisationId: string
  organisationNom: string
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const [form, setForm] = useState({ nom: '', date_debut: '', date_fin: '', statut: 'ouvert', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom || !form.date_debut || !form.date_fin) {
      setError('Nom, date de début et date de fin sont requis.')
      return
    }
    setSaving(true); setError(null)
    const r = await fetch(`${API}/exercices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, structure_id: organisationId }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setError(d.error ?? 'Erreur'); return }
    onCreated(d.id)
  }

  const labelCls = 'block text-xs font-bold uppercase tracking-widest mb-1.5'

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}>←</button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Nouvel exercice budgétaire</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--accent)' }}>🏢 {organisationNom}</p>
        </div>
      </div>

      <form onSubmit={submit}
        className="rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Nom de l’exercice *</label>
          <input style={inp} value={form.nom} placeholder="Ex : Exercice 2026 – 2027"
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Date de début *</label>
            <input type="date" style={inp} value={form.date_debut}
              onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Date de fin *</label>
            <input type="date" style={inp} value={form.date_fin}
              onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Statut</label>
          <select style={inp} value={form.statut}
            onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
            <option value="ouvert">Ouvert</option>
            <option value="cloture">Clôturé</option>
            <option value="archive">Archivé</option>
          </select>
        </div>

        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Notes</label>
          <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.notes}
            placeholder="Observations, contexte, durée spéciale…"
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: RED_BG, color: RED }}>{error}</div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} style={btnGhost}>Annuler</button>
          <button type="submit" disabled={saving}
            style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Création…' : 'Créer l’exercice'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Liste des exercices (+ corbeille admin)
// ══════════════════════════════════════════════════════════════════════════════

function ExercicesList({ organisationId, readOnly, onOpen, onNew }: {
  organisationId: string
  readOnly: boolean
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const [exercices, setExercices] = useState<Exercice[]>([])
  const [loading, setLoading] = useState(true)

  // Rôle admin — détecté via la corbeille (403 pour les non-admins)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [trashItems, setTrashItems] = useState<Exercice[]>([])
  const [trashLoading, setTrashLoading] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingPermanent, setPendingPermanent] = useState<string | null>(null)
  const [deletingPermanent, setDeletingPermanent] = useState(false)

  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      const r = await fetch(`${API}/exercices?trash=true`)
      if (r.status === 403) { setIsAdmin(false); setTrashLoading(false); return }
      const d = await r.json()
      if (r.ok) {
        setIsAdmin(true)
        // La corbeille est globale côté API — on filtre sur l'organisation courante
        setTrashItems(Array.isArray(d) ? d.filter((ex: Exercice) => ex.structure_id === organisationId) : [])
      }
    } catch { /* silencieux */ }
    setTrashLoading(false)
  }, [organisationId])

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/exercices?structure_id=${organisationId}`)
      .then(r => r.json())
      .then(d => { setExercices(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
    // Détection admin (+ pré-chargement corbeille)
    loadTrash()
  }, [organisationId, loadTrash])

  async function handleDelete(id: string) {
    setDeleting(true)
    const r = await fetch(`${API}/exercices/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setPendingDelete(null)
    if (r.ok) {
      setExercices(prevEx => prevEx.filter(ex => ex.id !== id))
      loadTrash()
    }
  }

  async function handleRestore(id: string) {
    const r = await fetch(`${API}/exercices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    if (r.ok) {
      const restored = await r.json()
      setTrashItems(prevT => prevT.filter(ex => ex.id !== id))
      setExercices(prevEx => [restored, ...prevEx])
    }
  }

  async function handlePermanentDelete(id: string) {
    setDeletingPermanent(true)
    const r = await fetch(`${API}/exercices/${id}?permanent=true`, { method: 'DELETE' })
    setDeletingPermanent(false)
    setPendingPermanent(null)
    if (r.ok) setTrashItems(prevT => prevT.filter(ex => ex.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>💰 Budgets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Exercices budgétaires de l’entreprise</p>
        </div>
        {!readOnly && (
          <button onClick={onNew}
            className="inline-flex items-center gap-2"
            style={btnPrimary}>
            + Nouvel exercice
          </button>
        )}
      </div>

      {loading && <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Chargement…</div>}

      {!loading && exercices.length === 0 && (
        <div className="py-16 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div className="text-4xl mb-3">📊</div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Aucun exercice budgétaire</p>
          {!readOnly && (
            <p className="text-sm mt-1">
              <button onClick={onNew} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit' }}>
                Créer un premier exercice →
              </button>
            </p>
          )}
        </div>
      )}

      {/* Liste des exercices */}
      <div className="flex flex-col gap-3">
        {exercices.map(ex => {
          const s = STATUT_LABEL[ex.statut] ?? STATUT_LABEL.ouvert
          const dur = months(ex.date_debut, ex.date_fin)
          const isConfirming = pendingDelete === ex.id
          return (
            <div key={ex.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: `1px solid ${isConfirming ? '#fca5a5' : 'var(--border)'}`, transition: 'box-shadow .15s, border-color .15s' }}>
              <div className="h-1.5" style={{ background: ex.statut === 'ouvert' ? 'var(--accent)' : ex.statut === 'cloture' ? AMBER : 'var(--text-subtle)' }} />

              {isConfirming ? (
                <div className="p-5 flex items-center justify-between gap-4 flex-wrap" style={{ background: RED_BG }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: RED }}>
                      🗑️ Mettre « {ex.nom} » à la corbeille ?
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: RED, opacity: 0.8 }}>
                      L’exercice et toutes ses données seront masqués mais récupérables par un admin.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPendingDelete(null)} style={btnGhost}>Annuler</button>
                    <button onClick={() => handleDelete(ex.id)} disabled={deleting}
                      style={{ ...btnPrimary, background: deleting ? 'var(--text-subtle)' : '#ef4444', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                      {deleting ? 'Suppression…' : 'Mettre à la corbeille'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <button onClick={() => onOpen(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flex: 1, padding: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base" style={{ color: 'var(--text)' }}>{ex.nom}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(ex.date_debut)} → {fmtDate(ex.date_fin)}
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text)' }}>{dur} mois</span>
                      </p>
                      {ex.notes && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{ex.notes}</p>}
                    </button>
                    <div className="flex items-center gap-2">
                      {isAdmin && !readOnly && (
                        <button onClick={() => setPendingDelete(ex.id)}
                          title="Mettre à la corbeille"
                          className="p-1.5 rounded-lg transition-all"
                          style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}>
                          🗑️
                        </button>
                      )}
                      <button onClick={() => onOpen(ex.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>→</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Corbeille admin ── */}
      {isAdmin && !readOnly && (
        <div className="mt-10">
          <button onClick={() => setShowTrash(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold transition-all"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <span style={{ transform: showTrash ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform .15s', fontSize: '0.7rem' }}>▶</span>
            🗑️ Corbeille administrateur
            {trashItems.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: RED_BG, color: RED }}>
                {trashItems.length}
              </span>
            )}
          </button>

          {showTrash && (
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #fca5a5' }}>
              <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
                style={{ background: RED_BG, borderBottom: '1px solid #fca5a5' }}>
                <span className="text-sm font-bold" style={{ color: RED }}>🗑️ Corbeille — exercices supprimés</span>
                <span className="text-xs" style={{ color: RED, opacity: 0.85 }}>
                  Les exercices dans la corbeille sont masqués mais leurs données sont conservées. Restaurez-les ou supprimez-les définitivement.
                </span>
              </div>

              {trashLoading && <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>}

              {!trashLoading && trashItems.length === 0 && (
                <div className="py-8 text-center text-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>La corbeille est vide.</div>
              )}

              {trashItems.map(ex => {
                const isPermanentConfirm = pendingPermanent === ex.id
                return (
                  <div key={ex.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                    style={{ borderBottom: '1px solid #fca5a5', background: isPermanentConfirm ? RED_BG : 'var(--bg-card)' }}>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ex.nom}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(ex.date_debut)} → {fmtDate(ex.date_fin)}
                        {ex.deleted_at && <span style={{ color: '#ef4444' }}> · Supprimé le {fmtDate(ex.deleted_at)}</span>}
                      </div>
                    </div>

                    {isPermanentConfirm ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: RED }}>
                          ⚠️ Suppression définitive et irréversible ?
                        </span>
                        <button onClick={() => setPendingPermanent(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                          Annuler
                        </button>
                        <button onClick={() => handlePermanentDelete(ex.id)} disabled={deletingPermanent}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: deletingPermanent ? 'var(--text-subtle)' : '#b91c1c', color: '#fff', border: 'none', cursor: deletingPermanent ? 'not-allowed' : 'pointer' }}>
                          {deletingPermanent ? 'Suppression…' : 'Supprimer définitivement'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => handleRestore(ex.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                          ↩ Restaurer
                        </button>
                        <button onClick={() => setPendingPermanent(ex.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: RED_BG, color: RED, border: '1px solid #fca5a5', cursor: 'pointer' }}>
                          🗑️ Supprimer définitivement
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant principal — orchestration des trois vues
// ══════════════════════════════════════════════════════════════════════════════

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'detail'; id: string }

export default function BudgetEntrepriseApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null
  const orgNom = ctx.org?.denomination ?? 'Organisation'
  const readOnly = ctx.isShared

  const [view, setView] = useState<View>({ mode: 'list' })

  // Changement d'organisation → retour à la liste
  useEffect(() => { setView({ mode: 'list' }) }, [orgId])

  // Boutons du header (RseAppShell)
  useEffect(() => {
    if (!orgId) { ctx.setActions(null); return }
    if (view.mode === 'list') {
      ctx.setActions(
        !readOnly ? (
          <button onClick={() => setView({ mode: 'new' })}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            + Nouvel exercice
          </button>
        ) : null
      )
    } else {
      ctx.setActions(
        <button onClick={() => setView({ mode: 'list' })}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
          ← Exercices
        </button>
      )
    }
    return () => ctx.setActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, view.mode, readOnly])

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          <div className="text-5xl mb-3">💰</div>
          <p className="text-sm">Sélectionnez une organisation dans la barre latérale pour gérer ses budgets.</p>
        </div>
      </div>
    )
  }

  if (view.mode === 'new') {
    return (
      <NouvelExercice
        organisationId={orgId}
        organisationNom={orgNom}
        onCancel={() => setView({ mode: 'list' })}
        onCreated={(id) => setView({ mode: 'detail', id })}
      />
    )
  }

  if (view.mode === 'detail') {
    return (
      <ExerciceDetail
        exerciceId={view.id}
        organisationId={orgId}
        readOnly={readOnly}
        onBack={() => setView({ mode: 'list' })}
      />
    )
  }

  return (
    <ExercicesList
      organisationId={orgId}
      readOnly={readOnly}
      onOpen={(id) => setView({ mode: 'detail', id })}
      onNew={() => setView({ mode: 'new' })}
    />
  )
}
