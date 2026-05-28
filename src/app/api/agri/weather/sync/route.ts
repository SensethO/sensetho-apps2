/**
 * GET /api/agri/weather/sync
 *
 * Cron Vercel — s'exécute tous les jours à 6h UTC.
 * Pour chaque plantation active ayant des coordonnées GPS (via ses champs),
 * récupère les données Open-Meteo des 14 derniers jours et insère les
 * observations manquantes dans observations_meteo (3 par jour :
 * nuit / matin / après-midi) sans écraser les saisies manuelles.
 *
 * Sécurisé par le header Authorization: Bearer <CRON_SECRET>.
 * Peut aussi être appelé manuellement avec ?backfill=YYYY-MM-DD pour
 * remplir les données depuis une date donnée jusqu'à aujourd'hui.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit les degrés de direction vent en cardinal */
function degToCardinal(deg: number | null): string | null {
  if (deg === null || deg === undefined) return null
  const dirs = ['N','NE','E','SE','S','SO','O','NO']
  return dirs[Math.round(deg / 45) % 8]
}

/** Convertit la couverture nuageuse (%) en enum DB */
function cloudToCover(pct: number): string {
  if (pct < 10)  return 'ciel_clair'
  if (pct < 30)  return 'peu_nuageux'
  if (pct < 60)  return 'partiellement_nuageux'
  if (pct < 85)  return 'nuageux'
  return 'tres_nuageux'
}

/** Sélectionne l'heure représentative pour chaque période */
const PERIOD_HOURS: Record<string, number> = { nuit: 3, matin: 9, 'apres-midi': 15 }

interface HourlyData {
  time:                  string[]
  temperature_2m:        number[]
  relative_humidity_2m:  number[]
  precipitation:         number[]
  wind_speed_10m:        number[]
  wind_direction_10m:    number[]
  cloud_cover:           number[]
}

/** Construit les 3 observations (nuit/matin/après-midi) pour un jour donné */
function buildObservations(
  date: string,
  plantationId: string,
  hourly: HourlyData,
  dayOffset: number   // index du 1er slot de la journée (0, 24, 48 …)
) {
  return (['nuit', 'matin', 'apres-midi'] as const).map((periode) => {
    const h = PERIOD_HOURS[periode]
    const i = dayOffset + h
    return {
      plantation_id:      plantationId,
      date,
      periode,
      temperature_c:      Math.round(hourly.temperature_2m[i] * 10) / 10,
      humidite_pct:       Math.round(hourly.relative_humidity_2m[i]),
      precipitation_mm:   Math.round(hourly.precipitation[i] * 10) / 10,
      vent_kmh:           Math.round(hourly.wind_speed_10m[i] * 3.6 * 10) / 10, // m/s → km/h
      vent_direction:     degToCardinal(hourly.wind_direction_10m[i]),
      couverture_nuageuse: cloudToCover(hourly.cloud_cover[i]),
      commentaire:        null as string | null,
    }
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Auth cron
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  // backfill=YYYY-MM-DD : remplir depuis cette date jusqu'à aujourd'hui
  const backfillFrom = searchParams.get('backfill')

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // 1. Toutes les plantations avec au moins un champ géolocalisé
    const { data: plantations, error: pErr } = await svc
      .from('plantations')
      .select('id, nom')
    if (pErr) throw new Error(pErr.message)

    const { data: champs, error: cErr } = await svc
      .from('champs')
      .select('plantation_id, coordonnees')
      .not('coordonnees', 'is', null)
    if (cErr) throw new Error(cErr.message)

    // Map plantation_id → première coordonnée disponible
    const coordMap = new Map<string, { lat: number; lon: number }>()
    for (const ch of (champs ?? [])) {
      if (!coordMap.has(ch.plantation_id) && ch.coordonnees?.lat && ch.coordonnees?.lon) {
        coordMap.set(ch.plantation_id, { lat: ch.coordonnees.lat, lon: ch.coordonnees.lon })
      }
    }

    // 2. Déterminer la plage de dates
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    let startDate: Date
    if (backfillFrom) {
      startDate = new Date(backfillFrom)
      startDate.setUTCHours(0, 0, 0, 0)
    } else {
      // Par défaut : les 14 derniers jours (pour rattraper les trous éventuels)
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 14)
    }

    // Open-Meteo archive ne couvre pas aujourd'hui → on prend jusqu'à hier
    const endDate = new Date(today)
    endDate.setDate(today.getDate() - 1)

    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const results: { plantation: string; inserted: number; error?: string }[] = []

    for (const plantation of (plantations ?? [])) {
      const coords = coordMap.get(plantation.id)
      if (!coords) {
        results.push({ plantation: plantation.nom, inserted: 0, error: 'Pas de coordonnées GPS' })
        continue
      }

      try {
        // 3. Appel Open-Meteo Archive API (données historiques précises)
        const url =
          `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${coords.lat}&longitude=${coords.lon}` +
          `&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}` +
          `&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover` +
          `&timezone=auto&wind_speed_unit=ms`

        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`)
        const data = await res.json() as { hourly: HourlyData }
        const hourly = data.hourly

        // 4. Construire les observations pour chaque jour
        const rows: object[] = []
        let dayCount = 0
        const ptr = new Date(startDate)
        while (ptr <= endDate) {
          const dateStr = fmt(ptr)
          const obs = buildObservations(dateStr, plantation.id, hourly, dayCount * 24)
          rows.push(...obs)
          ptr.setDate(ptr.getDate() + 1)
          dayCount++
        }

        // 5. Insérer en ignorant les conflits (ne pas écraser les saisies manuelles)
        const { error: insErr, count } = await svc
          .from('observations_meteo')
          .upsert(rows, {
            onConflict: 'plantation_id,date,periode',
            ignoreDuplicates: true,
          })
          .select('id', { count: 'exact', head: true })

        if (insErr) throw new Error(insErr.message)
        results.push({ plantation: plantation.nom, inserted: count ?? 0 })
      } catch (e) {
        results.push({ plantation: plantation.nom, inserted: 0, error: String(e) })
      }
    }

    return NextResponse.json({
      ok: true,
      range: { from: fmt(startDate), to: fmt(endDate) },
      results,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
