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

    // 2. Lire la politique actuelle
    log.push(`[${ts()}] Lecture de la politique Anti-Phish…`)
    const domain = tenant.domain
    const policyUrl = `https://outlook.office365.com/adminapi/beta/${domain}/Configuration/AntiPhishPolicy`

    const getRes = await fetch(policyUrl, {
      headers: { Authorization: `Bearer ${exoToken}`, Accept: 'application/json' },
    })

    let currentThreshold = 3
    let policyId = 'Default'

    if (getRes.ok) {
      const policyData = await getRes.json()
      const policies = policyData.value ?? [policyData]
      const defaultPolicy = policies.find((p: Record<string, unknown>) =>
        String(p.Name).toLowerCase().includes('default') ||
        String(p.Identity).toLowerCase().includes('default')
      ) ?? policies[0]
      if (defaultPolicy) {
        currentThreshold = defaultPolicy.PhishThresholdLevel ?? 3
        policyId = defaultPolicy.Identity ?? defaultPolicy.Name ?? 'Default'
        log.push(`[${ts()}] Policy "${policyId}" trouvée — PhishThreshold actuel: ${currentThreshold} ✅`)
      }
    } else {
      log.push(`[${ts()}] Lecture policy EXO: ${getRes.status} — utilisation des valeurs par défaut`)
    }

    const tempThreshold = currentThreshold === 2 ? 3 : 2

    // 3. Modification temporaire
    log.push(`[${ts()}] Modification: ${currentThreshold} → ${tempThreshold}…`)
    const patchUrl = `https://outlook.office365.com/adminapi/beta/${domain}/Configuration/AntiPhishPolicy('${policyId}')`
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${exoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ PhishThresholdLevel: tempThreshold }),
    })

    if (!patchRes.ok) {
      const errText = await patchRes.text()
      throw new Error(`PATCH policy échoué (${patchRes.status}): ${errText}`)
    }
    log.push(`[${ts()}] Modifié à ${tempThreshold} ✅`)

    // 4. Attente 30s
    log.push(`[${ts()}] Attente 30 secondes (propagation pipeline)…`)
    await sleep(30000)
    log.push(`[${ts()}] Attente terminée ✅`)

    // 5. Restauration
    log.push(`[${ts()}] Restauration: ${tempThreshold} → ${currentThreshold}…`)
    const restoreRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${exoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ PhishThresholdLevel: currentThreshold }),
    })

    if (!restoreRes.ok) {
      const errText = await restoreRes.text()
      log.push(`[${ts()}] ⚠️ RESTAURATION ÉCHOUÉE: ${errText} — valeur actuelle: ${tempThreshold}`)
    } else {
      log.push(`[${ts()}] Restauré à ${currentThreshold} ✅`)
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
