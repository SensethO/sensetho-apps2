// Connexion API Sindup d'une organisation — PRÉPARATION.
// La clé API est chiffrée au repos (AES-256-GCM, SINDUP_CRED_SECRET, repli
// EUDR_CRED_SECRET) et stockée dans sindup_connections. Le client API Sindup
// sera branché quand la doc Sindup sera disponible (pas de doc publique à ce
// jour) : aucune validation distante n'est donc possible pour l'instant.
// GET ?organisation_id= → { connected } | PUT { organisation_id, api_key } | DELETE.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgOwner } from '@/lib/sindup/auth'
import { encryptSecret } from '@/lib/sindup/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?organisation_id= — état de la connexion. Jamais la clé. */
export async function GET(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('sindup_connections')
      .select('id')
      .eq('organisation_id', organisationId!)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ connected: !!data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT { organisation_id, api_key } — chiffre et stocke (upsert par organisation). */
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { organisation_id?: string; api_key?: string }
    const organisationId = body.organisation_id ?? null
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const apiKey = (body.api_key ?? '').trim()
    if (!apiKey) return NextResponse.json({ error: 'api_key requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('sindup_connections').upsert(
      {
        organisation_id: organisationId,
        api_key_cipher: encryptSecret(apiKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organisation_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ connected: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?organisation_id= — supprime la connexion API Sindup. */
export async function DELETE(req: NextRequest) {
  try {
    const organisationId = req.nextUrl.searchParams.get('organisation_id')
    const auth = await requireOrgOwner(organisationId)
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const { error } = await admin.from('sindup_connections').delete().eq('organisation_id', organisationId!)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
