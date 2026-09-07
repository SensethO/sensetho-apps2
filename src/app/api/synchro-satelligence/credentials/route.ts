import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/eudr/crypto'
import { getSatelligenceInfo } from '@/lib/eudr/satelligence'
import { requireOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id= — métadonnées (présence, environnement). Jamais le token. */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const info = await getSatelligenceInfo(orgId!)
    return NextResponse.json({ configured: !!info, info })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { org_id, token, environment } — enregistre/écrase le token (chiffré). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; token?: string; environment?: string }
    const orgId = body.org_id ?? null
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth

    const token = (body.token ?? '').trim()
    const environment = body.environment === 'mock' ? 'mock' : 'production'
    if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('satelligence_credentials').upsert({
      org_id: orgId,
      user_id: auth.userId,
      token_enc: encryptSecret(token),
      environment,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?org_id= — supprime le token. */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()
    await admin.from('satelligence_credentials').delete().eq('org_id', orgId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
