'use client'

/**
 * LeMiroirObserver — le parcours guidé de peinture (façon formulaire) et ses
 * composants : planches illustrées des espèces et des milieux, questionnaire
 * d'aide au choix, échelles d'adéquation, récapitulatif.
 *
 * Extrait de LeMiroirApp pour être partagé entre :
 *  - l'app authentifiée (src/components/apps/LeMiroirApp.tsx)
 *  - la page publique d'invitation par lien (src/app/miroir/[token]/page.tsx)
 */

import { useState } from 'react'
import {
  ESPECES, VERDICTS, QUIZ, OPEN_QUESTIONS, SECTEUR_DISCLAIMER,
  especeById, habitatById, relationById, habitatsPourMilieu, suggererEspeces,
  RELATIONS, SEUIL_RESTITUTION, QUESTION_FILTRE_POSTE, SIGNAUX_HINT, DEDICACE_HINT,
  MILIEU_SERVICE_HINT, MILIEU_POSTE_HINT, ETRE_KIND_LABELS, SIGNAUX_CHAMPS,
  composeSignaux, type EtreKind,
} from '@/lib/leMiroir'
import { PLANCHES } from '@/lib/leMiroirPlanches'
import { PLANCHES_HABITATS } from '@/lib/leMiroirHabitats'

// ─── Types partagés ───────────────────────────────────────────────────────────

export interface AiSecteur {
  nom?: string; attractivite?: string; forces?: string[]; faiblesses?: string[]
  turnover?: string; stress_burnout?: string; remuneration?: string
}
export interface AiSuggestion {
  especeId?: string; especeCiteId?: string; habitatMarcheId?: string; habitatCiteId?: string
  verdictMarche?: number; verdictCite?: number; justification?: string; secteur?: AiSecteur
}
export interface Etre { key: string; label: string; kind: EtreKind; cote?: string | null }

const card = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' } as const
const chipStyle = (active: boolean) => active
  ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
  : { ...card, color: 'var(--text)' }

// ─── Peindre : parcours guidé pas à pas (façon formulaire), planches illustrées ──

export interface NewPortrait {
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

export function Observer({ etres, isOwner, myAutoDone, onSave }: { etres: Etre[]; isOwner: boolean; myAutoDone: boolean; onSave: (p: NewPortrait) => Promise<void> }) {
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
  // Les trois signaux sont saisis séparément (peur / blessure / angle mort) puis
  // recomposés en un seul texte lisible à l'enregistrement.
  const [sig, setSig] = useState<Record<string, string>>({})
  const [dedicace, setDedicace] = useState(''); const [justif, setJustif] = useState('')
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
    setMilieuLibre(''); setRelation(''); setSig({}); setDedicace(''); setJustif('')
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
      signaux: composeSignaux(sig),
      dedicace: kind === 'entreprise' && regard === 'individuel' ? dedicace.trim() || null : null,
      justification: justif.trim() || null,
      kind: kind === 'entreprise' && isOwner ? regard : 'individuel',
      // On enregistre ce qui a RÉELLEMENT servi à construire le portrait : dès qu'une
      // analyse IA a été appliquée, elle est conservée — même si l'utilisateur a
      // ensuite rebasculé le sélecteur sur « pas à pas » (sinon le profil sectoriel
      // était silencieusement perdu à l'enregistrement).
      methode: aiSuggestion ? 'ia' : 'manuel',
      prompt: aiSuggestion && Object.keys(promptClean).length ? promptClean : null,
      ia: aiSuggestion,
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
        {cur.key === 'signaux' && (
          <div className="space-y-4 max-w-2xl">
            {SIGNAUX_CHAMPS.map((c) => (
              <div key={c.key}>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.label}</div>
                <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>{c.hint}</div>
                <textarea rows={2} value={sig[c.key] ?? ''} placeholder={c.placeholder}
                  onChange={(e) => setSig((s) => ({ ...s, [c.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
              </div>
            ))}
          </div>
        )}
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
            {SIGNAUX_CHAMPS.filter((c) => sig[c.key]?.trim()).map((c) => (
              <RecapRow key={c.key} label={c.label.replace(/…$/, '').replace(/^Quand /, '')}>{sig[c.key]}</RecapRow>
            ))}
            {dedicace.trim() && <RecapRow label="Dédicace">« {dedicace} »</RecapRow>}
            {aiSuggestion && (
              <div className="rounded-lg border p-2.5" style={card}>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-subtle)' }}>
                  🤖 ANALYSE IA — conservée avec le portrait
                </div>
                {aiSecteur
                  ? <SecteurBox sect={aiSecteur} disclaimer />
                  : <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Proposition de l&apos;IA appliquée (sans profil sectoriel).</div>}
              </div>
            )}
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

export function Gauge({ value }: { value?: number }) {
  const n = value ? Math.round(value) : 0
  return <span className="inline-flex gap-1 align-middle">{[1, 2, 3, 4].map((i) => (
    <span key={i} className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: i <= n ? 'var(--accent)' : 'var(--border)' }} />
  ))}</span>
}

export function SecteurBox({ sect, disclaimer }: { sect: AiSecteur; disclaimer?: boolean }) {
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

