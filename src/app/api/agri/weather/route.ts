/**
 * GET /api/agri/weather
 * Proxy vers Open-Meteo (gratuit, sans clé API).
 *
 * Query params:
 *   - lat   : latitude  (ex: 5.35)
 *   - lon   : longitude (ex: -4.00)
 *
 * Retourne : { current, daily (8 jours), mock: boolean }
 * Si Open-Meteo est indisponible → données mock réalistes Côte d'Ivoire.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── WMO weather code helpers ─────────────────────────────────────────────────

function getIcon(code: number): string {
  if (code === 0) return '01d'
  if (code === 1) return '02d'
  if (code === 2) return '03d'
  if (code === 3) return '04d'
  if (code === 45 || code === 48) return '50d'
  if (code >= 51 && code <= 55) return '09d'
  if (code >= 61 && code <= 65) return '10d'
  if (code >= 71 && code <= 75) return '13d'
  if (code >= 80 && code <= 82) return '09d'
  if (code === 95) return '11d'
  return '03d'
}

function getDescription(code: number): string {
  if (code === 0) return 'Ciel dégagé'
  if (code === 1) return 'Principalement dégagé'
  if (code === 2) return 'Partiellement nuageux'
  if (code === 3) return 'Couvert'
  if (code === 45 || code === 48) return 'Brouillard'
  if (code >= 51 && code <= 55) return 'Bruine'
  if (code >= 61 && code <= 65) return 'Pluie'
  if (code >= 71 && code <= 75) return 'Neige'
  if (code >= 80 && code <= 82) return 'Averses'
  if (code === 95) return 'Orage'
  return 'Nuageux'
}

// ─── Mock data (fallback) ─────────────────────────────────────────────────────

function getMockWeatherData() {
  const now = Math.floor(Date.now() / 1000)
  const daySeconds = 86400

  const current = {
    dt: now,
    temp: 29,
    feels_like: 34,
    humidity: 78,
    pressure: 1012,
    uvi: 7.2,
    clouds: 65,
    visibility: 8000,
    wind_speed: 3.2,
    wind_deg: 220,
    weather: [{ id: 3, main: '', description: 'Partiellement nuageux', icon: '03d' }],
    dew_point: 24,
  }

  const daily = Array.from({ length: 8 }, (_, i) => {
    const rain = i % 3 === 0
    const wmoCode = rain ? 61 : 2
    const max = 32 + Math.round(Math.random() * 3 - 1)
    const min = 23 + Math.round(Math.random() * 2 - 1)
    return {
      dt: now + i * daySeconds,
      sunrise: now + i * daySeconds + 21600,
      sunset: now + i * daySeconds + 64800,
      temp: {
        day: Math.round((max + min) / 2),
        min,
        max,
        night: min,
        eve: Math.round((max + min) / 2),
        morn: min,
      },
      feels_like: {
        day: Math.round((max + min) / 2),
        night: min,
        eve: Math.round((max + min) / 2),
        morn: min,
      },
      pressure: 1013,
      humidity: 70,
      dew_point: 0,
      wind_speed: 2 + Math.random() * 4,
      wind_deg: 0,
      clouds: 50,
      uvi: 6 + Math.random() * 4,
      pop: rain ? 0.6 : 0,
      rain: rain ? 5 + Math.random() * 15 : 0,
      weather: [{ id: wmoCode, main: '', description: getDescription(wmoCode), icon: getIcon(wmoCode) }],
      summary: getDescription(wmoCode),
    }
  })

  return { current, daily }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat') ?? '5.35'
  const lon = searchParams.get('lon') ?? '-4.00'

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index,visibility` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
      `&wind_speed_unit=ms&timezone=auto&forecast_days=8`

    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      throw new Error(`Open-Meteo ${res.status}`)
    }

    const data = await res.json() as {
      current: {
        temperature_2m: number
        apparent_temperature: number
        relative_humidity_2m: number
        surface_pressure: number
        uv_index: number
        cloud_cover: number
        visibility: number
        wind_speed_10m: number
        wind_direction_10m: number
        weather_code: number
      }
      daily: {
        time: string[]
        weather_code: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_sum: number[]
        wind_speed_10m_max: number[]
        uv_index_max: number[]
        sunrise: string[]
        sunset: string[]
      }
    }

    const wmoCodeCurrent = data.current.weather_code

    const current = {
      dt: Math.floor(Date.now() / 1000),
      temp: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      pressure: data.current.surface_pressure,
      uvi: data.current.uv_index,
      clouds: data.current.cloud_cover,
      visibility: data.current.visibility,
      wind_speed: data.current.wind_speed_10m,
      wind_deg: data.current.wind_direction_10m,
      dew_point: 0,
      weather: [{
        id: wmoCodeCurrent,
        main: '',
        description: getDescription(wmoCodeCurrent),
        icon: getIcon(wmoCodeCurrent),
      }],
    }

    const daily = data.daily.time.map((date, i) => {
      const wmoCode = data.daily.weather_code[i]
      const max = data.daily.temperature_2m_max[i]
      const min = data.daily.temperature_2m_min[i]
      return {
        dt: Math.floor(new Date(date).getTime() / 1000),
        sunrise: Math.floor(new Date(data.daily.sunrise[i]).getTime() / 1000),
        sunset: Math.floor(new Date(data.daily.sunset[i]).getTime() / 1000),
        temp: {
          day: (max + min) / 2,
          min,
          max,
          night: min,
          eve: (max + min) / 2,
          morn: min,
        },
        feels_like: {
          day: (max + min) / 2,
          night: min,
          eve: (max + min) / 2,
          morn: min,
        },
        pressure: 1013,
        humidity: 70,
        dew_point: 0,
        wind_speed: data.daily.wind_speed_10m_max[i],
        wind_deg: 0,
        clouds: 50,
        uvi: data.daily.uv_index_max[i],
        pop: 0,
        rain: data.daily.precipitation_sum[i],
        weather: [{
          id: wmoCode,
          main: '',
          description: getDescription(wmoCode),
          icon: getIcon(wmoCode),
        }],
        summary: getDescription(wmoCode),
      }
    })

    return NextResponse.json({ current, daily, mock: false })
  } catch (err) {
    // Fallback to mock data when Open-Meteo is unavailable
    const mock = getMockWeatherData()
    return NextResponse.json({
      current: mock.current,
      daily: mock.daily,
      mock: true,
      _info: `Open-Meteo indisponible — données simulées (${err instanceof Error ? err.message : String(err)})`,
    })
  }
}
