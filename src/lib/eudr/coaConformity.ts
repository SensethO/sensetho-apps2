/**
 * Moteur de conformité déterministe pour les COA (Certificate of Analysis).
 * Compare une spécification à un résultat et rend un verdict sans IA :
 *   'conforme' | 'non_conforme' | 'a_verifier'
 * Gère : intervalles [a ; b], seuils ≤/≥/</>, « Absence », valeurs « <10 »,
 * décimales françaises (virgule), pourcentages. Les items qualitatifs
 * (couleur, odeur…) renvoient 'a_verifier' (à trancher via la demande client / l'IA).
 */

export type Verdict = 'conforme' | 'non_conforme' | 'a_verifier'

interface Num { value: number; op: '<' | '<=' | '>=' | '>' | '=' }

function toNum(raw: string): Num | null {
  if (!raw) return null
  let s = raw.trim().replace(/ /g, ' ')
  // opérateur éventuel en tête
  let op: Num['op'] = '='
  const m = s.match(/^\s*(≤|<=|<|≥|>=|>)/)
  if (m) {
    const o = m[1]
    op = o === '≤' || o === '<=' ? '<=' : o === '<' ? '<' : o === '≥' || o === '>=' ? '>=' : '>'
    s = s.slice(m[0].length)
  }
  // premier nombre (décimale FR ou EN)
  const nm = s.match(/-?\d[\d\s]*(?:[.,]\d+)?/)
  if (!nm) return null
  const value = parseFloat(nm[0].replace(/\s/g, '').replace(',', '.'))
  if (Number.isNaN(value)) return null
  return { value, op }
}

const isAbsence = (s: string) => /absence|absent|non\s*d[ée]tect/i.test(s || '')

interface Interval { min: number; max: number }
function parseInterval(spec: string): Interval | null {
  // [10% ; 12%]  |  [5,2 ; 6,0]  |  10 - 12
  const m = spec.match(/\[?\s*(-?\d[\d\s]*(?:[.,]\d+)?)\s*%?\s*(?:;|–|—|-|à)\s*(-?\d[\d\s]*(?:[.,]\d+)?)\s*%?\s*\]?/)
  if (!m) return null
  const a = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  const b = parseFloat(m[2].replace(/\s/g, '').replace(',', '.'))
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

export interface ConformityResult { verdict: Verdict; reason: string }

/**
 * Évalue un résultat par rapport à une spécification.
 * Renvoie un verdict + une raison en français. 'a_verifier' quand la règle
 * n'est pas mécaniquement décidable (qualitatif, borne ambiguë).
 */
export function evaluateConformity(specification: string, resultat: string): ConformityResult {
  const spec = (specification ?? '').trim()
  const res = (resultat ?? '').trim()
  if (!spec || !res) return { verdict: 'a_verifier', reason: 'Spécification ou résultat manquant.' }

  // 1) Spécification « Absence »
  if (isAbsence(spec)) {
    if (isAbsence(res)) return { verdict: 'conforme', reason: 'Absence attendue et confirmée.' }
    const n = toNum(res)
    if (n && n.value > 0 && n.op === '=') return { verdict: 'non_conforme', reason: `Présence détectée (${res}) alors qu'une absence est requise.` }
    // « <10 » ou « 0 » ⇒ souvent conforme mais on reste prudent
    if (n && (n.op === '<' || n.op === '<=') ) return { verdict: 'a_verifier', reason: `Résultat « ${res} » — vérifier qu'il correspond bien à une absence.` }
    return { verdict: 'a_verifier', reason: `Résultat « ${res} » à confronter à l'exigence d'absence.` }
  }

  const rNum = toNum(res)
  const interval = parseInterval(spec)

  // 2) Intervalle [min ; max]
  if (interval) {
    if (rNum && rNum.op === '=') {
      if (rNum.value < interval.min) return { verdict: 'non_conforme', reason: `${res} < borne basse ${interval.min}.` }
      if (rNum.value > interval.max) return { verdict: 'non_conforme', reason: `${res} > borne haute ${interval.max}.` }
      return { verdict: 'conforme', reason: `${res} dans l'intervalle [${interval.min} ; ${interval.max}].` }
    }
    return { verdict: 'a_verifier', reason: `Résultat « ${res} » non ponctuel — comparer manuellement à [${interval.min} ; ${interval.max}].` }
  }

  // 3) Seuil (≤ / < / ≥ / >)
  const sNum = toNum(spec)
  if (sNum && (sNum.op === '<=' || sNum.op === '<')) {
    const t = sNum.value
    if (rNum && rNum.op === '=') {
      const ok = sNum.op === '<=' ? rNum.value <= t : rNum.value < t
      return ok ? { verdict: 'conforme', reason: `${res} respecte ${spec}.` } : { verdict: 'non_conforme', reason: `${res} dépasse ${spec}.` }
    }
    if (rNum && (rNum.op === '<' || rNum.op === '<=')) {
      if (rNum.value <= t) return { verdict: 'conforme', reason: `${res} ≤ ${t} ⇒ respecte ${spec}.` }
      return { verdict: 'a_verifier', reason: `Résultat « ${res} » vs seuil ${spec} — borne à confirmer.` }
    }
    if (rNum && (rNum.op === '>' || rNum.op === '>=') && rNum.value >= t) {
      return { verdict: 'non_conforme', reason: `${res} dépasse le seuil ${spec}.` }
    }
    return { verdict: 'a_verifier', reason: `Résultat « ${res} » à comparer au seuil ${spec}.` }
  }
  if (sNum && (sNum.op === '>=' || sNum.op === '>')) {
    const t = sNum.value
    if (rNum && rNum.op === '=') {
      const ok = sNum.op === '>=' ? rNum.value >= t : rNum.value > t
      return ok ? { verdict: 'conforme', reason: `${res} respecte ${spec}.` } : { verdict: 'non_conforme', reason: `${res} sous le seuil ${spec}.` }
    }
    if (rNum && (rNum.op === '>' || rNum.op === '>=')) {
      if (rNum.value >= t) return { verdict: 'conforme', reason: `${res} ≥ ${t} ⇒ respecte ${spec}.` }
      return { verdict: 'a_verifier', reason: `Résultat « ${res} » vs seuil ${spec} — borne à confirmer.` }
    }
    return { verdict: 'a_verifier', reason: `Résultat « ${res} » à comparer au seuil ${spec}.` }
  }

  // 4) Spécification qualitative (couleur, odeur…) — non décidable mécaniquement
  const specNorm = spec.toLowerCase()
  const resNorm = res.toLowerCase()
  if (resNorm && (resNorm === specNorm || resNorm.includes(specNorm) || specNorm.includes(resNorm))) {
    return { verdict: 'conforme', reason: `Résultat « ${res} » correspond à la spécification « ${spec} ».` }
  }
  return { verdict: 'a_verifier', reason: `Spécification qualitative « ${spec} » vs résultat « ${res} » — à confronter à la demande client.` }
}
