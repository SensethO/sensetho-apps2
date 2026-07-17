import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/qonto/crypto'
import { qontoGetOrganization, QontoApiError } from '@/lib/qonto/client'
import { requireOrgOwner, getConnection, maskLogin } from '@/lib/qonto/connections'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?organisation_id= — état de la connexion. Jamais la clé secrète. */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const row = await getConnection(organisationId!)
    if (!row) return NextResponse.json({ connected: false, login_masked: null })
    return NextResponse.json({ connected: true, login_masked: maskLogin(row.login) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT { organisation_id, login, secret_key } — teste les identifiants auprès de
 * Qonto (qontoGetOrganization) AVANT de chiffrer et stocker (upsert par organisation).
 */
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      organisation_id?: string
      login?: string
      secret_key?: string
    }
    const organisationId = body.organisation_id ?? null
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const login = (body.login ?? '').trim()
    const secretKey = (body.secret_key ?? '').trim()
    if (!login || !secretKey) {
      return NextResponse.json({ error: 'login et secret_key requis' }, { status: 400 })
    }

    // Validation des identifiants par un appel réel à l'API Qonto.
    let orgName: string
    try {
      const org = await qontoGetOrganization({ login, secretKey })
      orgName = org.legal_name || org.slug
    } catch (err) {
      if (err instanceof QontoApiError && err.status === 401) {
        return NextResponse.json({ error: 'Identifiants Qonto invalides (login ou clé secrète incorrects).' }, { status: 400 })
      }
      return NextResponse.json({ error: `Test de connexion Qonto échoué : ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('qonto_connections').upsert(
      {
        organisation_id: organisationId,
        login,
        secret_key_cipher: encryptSecret(secretKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organisation_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      connected: true,
      login_masked: maskLogin(login),
      organization_name: orgName,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?organisation_id= — supprime la connexion Qonto de l'organisation. */
export async function DELETE(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const { error } = await admin.from('qonto_connections').delete().eq('organisation_id', organisationId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
