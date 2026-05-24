import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export async function POST(request: NextRequest) {
  let body: { url: string; serviceRoleKey: string; dbPassword: string; projectRef: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, pgOk: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, serviceRoleKey, dbPassword, projectRef } = body

  if (!url || !serviceRoleKey || !dbPassword || !projectRef) {
    return NextResponse.json({ ok: false, pgOk: false, error: 'Missing required fields' }, { status: 400 })
  }

  // Test 1: Supabase REST API reachability
  let restOk = false
  let restError = ''
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    })
    restOk = res.status === 200 || res.status === 400
  } catch (e) {
    restError = String(e)
  }

  // Test 2: pg connection — pooler first, then direct
  let pgOk = false
  let pgError = ''

  const tryConnect = async (connString: string): Promise<boolean> => {
    const pool = new Pool({
      connectionString: connString,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false },
    })
    try {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch {
      return false
    } finally {
      await pool.end()
    }
  }

  try {
    const poolerUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require`
    const directUrl = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`

    pgOk = await tryConnect(poolerUrl)
    if (!pgOk) {
      pgOk = await tryConnect(directUrl)
      if (!pgOk) pgError = 'Impossible de se connecter (pooler et direct). Vérifiez le mot de passe et le project ref.'
    }
  } catch (e) {
    pgError = String(e)
  }

  return NextResponse.json({
    ok: restOk,
    pgOk,
    error: [restError, pgError].filter(Boolean).join('; ') || undefined,
  })
}
