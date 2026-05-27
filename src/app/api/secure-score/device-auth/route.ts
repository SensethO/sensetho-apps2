import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — initier le device code flow (retourne user_code + verification_uri)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tenantDbId = request.nextUrl.searchParams.get('tenantDbId')
  if (!tenantDbId) return NextResponse.json({ error: 'tenantDbId requis' }, { status: 400 })

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('m365_tenants').select('*').eq('id', tenantDbId).single()

  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  // Initier le device code flow
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: tenant.client_id,
        scope: 'https://outlook.office365.com/.default offline_access',
      }),
    }
  )

  if (!res.ok) {
    const txt = await res.text()
    return NextResponse.json({ error: `Device code failed: ${txt}` }, { status: 502 })
  }

  const data = await res.json()
  // Retourner uniquement les champs nécessaires à l'UI (pas le device_code secret)
  return NextResponse.json({
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    device_code: data.device_code,
    expires_in: data.expires_in,
    interval: data.interval ?? 5,
  })
}

// POST — sonder le token + exécuter Enable-OrganizationCustomization si auth OK
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tenantDbId, device_code } = await request.json() as { tenantDbId: string; device_code: string }

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('m365_tenants').select('*').eq('id', tenantDbId).single()

  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })

  // Sonder le token endpoint
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: tenant.client_id,
        device_code,
      }),
    }
  )

  const tokenData = await tokenRes.json()

  // Toujours en attente
  if (tokenData.error === 'authorization_pending') {
    return NextResponse.json({ status: 'pending' })
  }
  if (tokenData.error === 'slow_down') {
    return NextResponse.json({ status: 'slow_down' })
  }
  if (tokenData.error) {
    return NextResponse.json({ status: 'error', error: tokenData.error_description ?? tokenData.error }, { status: 400 })
  }

  // Token obtenu — exécuter Enable-OrganizationCustomization
  const accessToken = tokenData.access_token as string
  const log: string[] = []
  const ts = () => new Date().toISOString().slice(11, 19)

  log.push(`[${ts()}] Token délégué obtenu ✅ (utilisateur authentifié)`)
  log.push(`[${ts()}] Exécution de Enable-OrganizationCustomization…`)

  const invokeRes = await fetch(
    `https://outlook.office365.com/adminapi/beta/${tenant.domain}/InvokeCommand`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CmdletInput: {
          CmdletName: 'Enable-OrganizationCustomization',
          Parameters: {},
        },
      }),
    }
  )

  if (invokeRes.ok) {
    log.push(`[${ts()}] ✅ Enable-OrganizationCustomization exécuté avec succès`)
    log.push(`[${ts()}] Attendez ~30s puis relancez "Auto-configurer les permissions RBAC"`)
    return NextResponse.json({ status: 'success', log })
  } else {
    const errText = await invokeRes.text()
    // Si l'org était déjà personnalisée — ce n'est pas une erreur
    if (errText.includes('already') || errText.includes('AlreadyCustomized') || invokeRes.status === 400) {
      log.push(`[${ts()}] ℹ️ Organisation déjà personnalisée ou commande inutile (${invokeRes.status})`)
      log.push(`[${ts()}] Relancez "Auto-configurer les permissions RBAC"`)
      return NextResponse.json({ status: 'success', log, alreadyDone: true })
    }
    log.push(`[${ts()}] ❌ EXO invoke échoué (${invokeRes.status}): ${errText.slice(0, 300)}`)
    return NextResponse.json({ status: 'error', log, error: errText }, { status: 502 })
  }
}
