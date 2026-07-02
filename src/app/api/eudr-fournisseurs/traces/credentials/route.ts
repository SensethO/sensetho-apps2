import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/eudr/crypto'
import { getTracesCredentialInfo, clientIdFor, TracesEnvironment } from '@/lib/eudr/tracesClient'
import { isOrgOwner } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireOwner(orgId: string | null): Promise<{ userId: string } | NextResponse> {
  const supabase = createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
  if (!await isOrgOwner(user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return { userId: user.id }
}

/** GET ?org_id=xxx — métadonnées des identifiants (présence, username, environnement). Jamais la clé. */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const info = await getTracesCredentialInfo(orgId!)
    return NextResponse.json({ configured: !!info, info })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST { org_id, username, authKey, environment } — enregistre/écrase les identifiants (clé chiffrée). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; username?: string; authKey?: string; environment?: string }
    const orgId = body.org_id ?? null
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth

    const username = (body.username ?? '').trim()
    const authKey = (body.authKey ?? '').trim()
    const environment: TracesEnvironment = body.environment === 'production' ? 'production' : 'acceptance'
    if (!username || !authKey) return NextResponse.json({ error: 'username et authKey requis' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('eudr_traces_credentials').upsert({
      org_id: orgId,
      user_id: auth.userId,
      username,
      auth_key_enc: encryptSecret(authKey),
      environment,
      client_id: clientIdFor(environment),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?org_id=xxx — supprime les identifiants. */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await requireOwner(orgId)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()
    await admin.from('eudr_traces_credentials').delete().eq('org_id', orgId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
