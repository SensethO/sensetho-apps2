// Analyse de risque déforestation EUDR via Whisp (FAO / Open Foris).
// On envoie une FeatureCollection GeoJSON ; Whisp renvoie, par parcelle, ~226 indicateurs
// (couvert forestier 2020, cultures, perturbations par année, alertes RADD/GLAD, et surtout
// les indicateurs de synthèse Ind_01..Ind_11 + les verdicts risk_pcrop/acrop/timber).
// Réf : https://whisp.openforis.org/api/docs — POST /submit/geojson (header X-API-KEY).

const WHISP_BASE = 'https://whisp.openforis.org/api'

export interface WhispPlot {
  plotId: string
  area: number | null
  unit: string | null
  riskPcrop: string | null   // low | high (cultures pérennes : cacao, café, palmier, hévéa)
  riskAcrop: string | null   // low | high (cultures annuelles : soja)
  riskTimber: string | null  // low | high (bois)
  disturbanceAfter2020: boolean   // Ind_04 : perturbation/déforestation après le 31/12/2020
  treecover2020: boolean          // Ind_01
  commodities: boolean            // Ind_02
  primary2020: boolean            // Ind_05
  indicators: Record<string, unknown>
}

export interface WhispResult {
  plots: WhispPlot[]
  plotCount: number
  overallRisk: 'low' | 'high' | 'unknown'
  summary: { high: number; low: number; disturbedAfter2020: number }
}

const yes = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'yes'
const isHigh = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'high'

/** Envoie la GeoJSON à Whisp et renvoie une synthèse de risque normalisée. */
export async function analyzeDeforestation(geojson: unknown, apiKey: string): Promise<WhispResult> {
  const res = await fetch(`${WHISP_BASE}/submit/geojson`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: typeof geojson === 'string' ? geojson : JSON.stringify(geojson),
  })
  const text = await res.text()
  let j: Record<string, unknown>
  try { j = JSON.parse(text) } catch { throw new Error(`Réponse Whisp illisible (HTTP ${res.status})`) }
  if (!res.ok) throw new Error(String(j.message ?? j.error ?? `Whisp HTTP ${res.status}`))

  // Réponse synchrone : { code:'analysis_completed', data: FeatureCollection }
  const fc = (j.data ?? j) as { features?: Array<{ properties?: Record<string, unknown> }> }
  const feats = Array.isArray(fc.features) ? fc.features : []

  const plots: WhispPlot[] = feats.map((f, i) => {
    const p = f.properties ?? {}
    const riskPcrop = (p.risk_pcrop as string) ?? null
    const riskAcrop = (p.risk_acrop as string) ?? null
    const riskTimber = (p.risk_timber as string) ?? null
    return {
      plotId: String(p.plotId ?? p.external_id ?? i + 1),
      area: typeof p.Area === 'number' ? p.Area : (p.Area != null ? Number(p.Area) : null),
      unit: (p.Unit as string) ?? null,
      riskPcrop, riskAcrop, riskTimber,
      disturbanceAfter2020: yes(p.Ind_04_disturbance_after_2020),
      treecover2020: yes(p.Ind_01_treecover),
      commodities: yes(p.Ind_02_commodities),
      primary2020: yes(p.Ind_05_primary_2020),
      indicators: p,
    }
  })

  const high = plots.filter(p => isHigh(p.riskPcrop) || isHigh(p.riskAcrop) || isHigh(p.riskTimber) || p.disturbanceAfter2020).length
  const disturbedAfter2020 = plots.filter(p => p.disturbanceAfter2020).length
  const overallRisk: WhispResult['overallRisk'] = plots.length === 0 ? 'unknown' : (high > 0 ? 'high' : 'low')

  return { plots, plotCount: plots.length, overallRisk, summary: { high, low: plots.length - high, disturbedAfter2020 } }
}
