import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getToken(tenantId: string, clientId: string, clientSecret: string, scope: string) {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    }
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Auth: ${txt}`)
  }
  const json = await res.json()
  return json.access_token as string
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// POST — débloquer le pipeline via AntiPhish PhishThreshold (3→2→3)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tenantDbId } = await request.json() as { tenantDbId: string }

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('m365_tenants').select('*').eq('id', tenantDbId).single()

  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  if (!tenant.client_secret) return NextResponse.json({ error: 'Client secret manquant' }, { status: 400 })

  const log: string[] = []
  const ts = () => new Date().toISOString().slice(11, 19)

  try {
    // 1. Token Exchange Online
    log.push(`[${ts()}] Obtention du token Exchange Online…`)
    const exoToken = await getToken(
      tenant.tenant_id,
      tenant.client_id,
      tenant.client_secret,
      'https://outlook.office365.com/.default'
    )
    log.push(`[${ts()}] Token obtenu ✅`)
    // Debug: décoder le JWT pour vérifier audience et rôles
    try {
      const parts = exoToken.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      log.push(`[${ts()}] Token aud:${payload.aud} appid:${payload.appid} roles:${JSON.stringify(payload.roles ?? [])}`)
    } catch { log.push(`[${ts()}] (impossible de décoder le token)`) }

    // Helper : appel InvokeCommand (EXO REST API v2)
    const invokeCommand = async (cmdletName: string, parameters: Record<string, unknown>) => {
      const url = `https://outlook.office365.com/adminapi/beta/${tenant.tenant_id}/InvokeCommand`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${exoToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ CmdletInput: { CmdletName: cmdletName, Parameters: parameters } }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${cmdletName} échoué (${res.status}): ${JSON.stringify(body).slice(0, 400)}`)
      return body
    }

    // 2. Lire la politique actuelle via Get-AntiPhishPolicy
    log.push(`[${ts()}] Lecture de la politique Anti-Phish (Get-AntiPhishPolicy)…`)

    let currentThreshold = 3
    let policyIdentity = 'Office365 AntiPhish Default'

    try {
      const getBody = await invokeCommand('Get-AntiPhishPolicy', {})
      const policies: Record<string, unknown>[] = getBody.value ?? (Array.isArray(getBody) ? getBody : [getBody])
      const defaultPolicy = policies.find((p) =>
        String(p.Name ?? p.Identity ?? '').toLowerCase().includes('default')
      ) ?? policies[0]
      if (defaultPolicy) {
        currentThreshold = (defaultPolicy.PhishThresholdLevel as number) ?? 3
        policyIdentity = (defaultPolicy.Identity as string) ?? (defaultPolicy.Name as string) ?? policyIdentity
        log.push(`[${ts()}] Policy "${policyIdentity}" — PhishThreshold actuel: ${currentThreshold} ✅`)
      }
    } catch (e) {
      log.push(`[${ts()}] Lecture policy: ${(e as Error).message} — utilisation des valeurs par défaut`)
    }

    const tempThreshold = currentThreshold === 2 ? 3 : 2

    // 3. Modification temporaire via Set-AntiPhishPolicy
    log.push(`[${ts()}] Modification: ${currentThreshold} → ${tempThreshold} (Set-AntiPhishPolicy)…`)
    await invokeCommand('Set-AntiPhishPolicy', {
      Identity: policyIdentity,
      PhishThresholdLevel: tempThreshold,
    })
    log.push(`[${ts()}] Modifié à ${tempThreshold} ✅`)

    // 4. Attente 30s
    log.push(`[${ts()}] Attente 30 secondes (propagation pipeline)…`)
    await sleep(30000)
    log.push(`[${ts()}] Attente terminée ✅`)

    // 5. Restauration
    log.push(`[${ts()}] Restauration: ${tempThreshold} → ${currentThreshold}…`)
    try {
      await invokeCommand('Set-AntiPhishPolicy', {
        Identity: policyIdentity,
        PhishThresholdLevel: currentThreshold,
      })
      log.push(`[${ts()}] Restauré à ${currentThreshold} ✅`)
    } catch (e) {
      log.push(`[${ts()}] ⚠️ RESTAURATION ÉCHOUÉE: ${(e as Error).message} — valeur actuelle: ${tempThreshold}`)
    }

    // 6. Lire le score après
    log.push(`[${ts()}] Lecture du score post-déblocage…`)
    const graphToken = await getToken(
      tenant.tenant_id,
      tenant.client_id,
      tenant.client_secret,
      'https://graph.microsoft.com/.default'
    )
    const scoreRes = await fetch(
      'https://graph.microsoft.com/v1.0/security/secureScores?$top=1',
      { headers: { Authorization: `Bearer ${graphToken}` } }
    )

    let afterScore = null, afterMax = null
    if (scoreRes.ok) {
      const scoreJson = await scoreRes.json()
      const ss = scoreJson.value?.[0]
      if (ss) {
        afterScore = ss.currentScore
        afterMax = ss.maxScore
        log.push(`[${ts()}] Score post-déblocage: ${afterScore}/${afterMax} ✅`)

        await admin.from('m365_tenants').update({
          last_score: afterScore,
          last_max_score: afterMax,
          last_status: 'ok',
          last_run_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', tenantDbId)
      }
    }

    log.push(`[${ts()}] ✅ Déblocage terminé — Le score final apparaîtra dans 1-2h`)

    return NextResponse.json({
      success: true,
      log,
      afterScore,
      afterMax,
      message: 'Pipeline relancé. Vérifiez le score dans 1-2 heures sur security.microsoft.com/securescore',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    log.push(`[${ts()}] ❌ Erreur: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
