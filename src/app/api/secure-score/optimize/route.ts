import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getToken(tenantId: string, clientId: string, clientSecret: string, scope: string) {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope }),
    }
  )
  if (!res.ok) { const txt = await res.text(); throw new Error(`Auth: ${txt}`) }
  return (await res.json()).access_token as string
}

type Action = 'audit' | 'atp' | 'dlp' | 'mfa' | 'block-risky'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tenantDbId, action } = await request.json() as { tenantDbId: string; action: Action }

  const admin = createAdminClient()
  const { data: tenant } = await admin.from('m365_tenants').select('*').eq('id', tenantDbId).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant introuvable' }, { status: 404 })
  if (!tenant.client_secret) return NextResponse.json({ error: 'Client secret manquant' }, { status: 400 })

  const log: string[] = []
  const ts = () => new Date().toISOString().slice(11, 19)

  // ── EXO InvokeCommand (Exchange Online) ──────────────────────────────────────
  const exoInvoke = async (token: string, cmdletName: string, parameters: Record<string, unknown>) => {
    const url = `https://outlook.office365.com/adminapi/beta/${tenant.tenant_id}/InvokeCommand`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ CmdletInput: { CmdletName: cmdletName, Parameters: parameters } }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${cmdletName} (${res.status}): ${JSON.stringify(body).slice(0, 500)}`)
    return body
  }

  // ── IPPS InvokeCommand (Security & Compliance Center) ───────────────────────
  const ippsInvoke = async (token: string, cmdletName: string, parameters: Record<string, unknown>) => {
    const url = `https://ps.compliance.protection.outlook.com/adminapi/beta/${tenant.tenant_id}/InvokeCommand`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ CmdletInput: { CmdletName: cmdletName, Parameters: parameters } }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${cmdletName} (${res.status}): ${JSON.stringify(body).slice(0, 500)}`)
    return body
  }

  // ── Graph API ────────────────────────────────────────────────────────────────
  const graphPost = async (token: string, path: string, payload: unknown) => {
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Graph POST ${path} (${res.status}): ${JSON.stringify(data).slice(0, 500)}`)
    return data
  }

  // ── Skip-si-déjà-existant helper ─────────────────────────────────────────────
  const alreadyExists = (msg: string) =>
    msg.toLowerCase().includes('already exists') ||
    msg.toLowerCase().includes('already been created') ||
    msg.toLowerCase().includes('duplicate') ||
    msg.toLowerCase().includes('déjà')

  try {
    // ════════════════════════════════════════════════════════════════════════════
    // AUDIT — Set-AdminAuditLogConfig -AdminAuditLogAgeLimit 365 jours
    // ════════════════════════════════════════════════════════════════════════════
    if (action === 'audit') {
      log.push(`[${ts()}] Obtention du token Exchange Online…`)
      const token = await getToken(
        tenant.tenant_id, tenant.client_id, tenant.client_secret,
        'https://outlook.office365.com/.default'
      )
      log.push(`[${ts()}] Token obtenu ✅`)

      log.push(`[${ts()}] Configuration Advanced Auditing — rétention 365 jours…`)
      await exoInvoke(token, 'Set-AdminAuditLogConfig', {
        AdminAuditLogAgeLimit: '365.00:00:00',
      })
      log.push(`[${ts()}] ✅ AdminAuditLogAgeLimit = 365 jours configuré`)

    // ════════════════════════════════════════════════════════════════════════════
    // ATP — Safe Attachments + Safe Links + ZAP
    // ════════════════════════════════════════════════════════════════════════════
    } else if (action === 'atp') {
      log.push(`[${ts()}] Obtention du token Exchange Online…`)
      const token = await getToken(
        tenant.tenant_id, tenant.client_id, tenant.client_secret,
        'https://outlook.office365.com/.default'
      )
      log.push(`[${ts()}] Token obtenu ✅`)

      // Safe Attachments Policy
      log.push(`[${ts()}] Création Safe Attachments policy…`)
      try {
        await exoInvoke(token, 'New-SafeAttachmentPolicy', {
          Name: 'SensEthO-SafeAttachments',
          Enable: true,
          Action: 'Block',
          Redirect: false,
        })
        log.push(`[${ts()}] Safe Attachments policy créée ✅`)
      } catch (e) {
        const msg = (e as Error).message
        if (alreadyExists(msg)) log.push(`[${ts()}] Safe Attachments policy déjà existante ✅`)
        else throw e
      }

      // Safe Attachments Rule
      log.push(`[${ts()}] Création Safe Attachments rule…`)
      try {
        await exoInvoke(token, 'New-SafeAttachmentRule', {
          Name: 'SensEthO-SafeAttachments-Rule',
          SafeAttachmentPolicy: 'SensEthO-SafeAttachments',
          RecipientDomainIs: [tenant.domain],
          Enabled: true,
        })
        log.push(`[${ts()}] Safe Attachments rule créée ✅`)
      } catch (e) {
        const msg = (e as Error).message
        if (alreadyExists(msg)) log.push(`[${ts()}] Safe Attachments rule déjà existante ✅`)
        else throw e
      }

      // Safe Links Policy
      log.push(`[${ts()}] Création Safe Links policy…`)
      try {
        await exoInvoke(token, 'New-SafeLinksPolicy', {
          Name: 'SensEthO-SafeLinks',
          IsEnabled: true,
          ScanUrls: true,
          EnableForInternalSenders: true,
          DeliverMessageAfterScan: true,
          AllowClickThrough: false,
          TrackClicks: true,
        })
        log.push(`[${ts()}] Safe Links policy créée ✅`)
      } catch (e) {
        const msg = (e as Error).message
        if (alreadyExists(msg)) log.push(`[${ts()}] Safe Links policy déjà existante ✅`)
        else throw e
      }

      // Safe Links Rule
      log.push(`[${ts()}] Création Safe Links rule…`)
      try {
        await exoInvoke(token, 'New-SafeLinksRule', {
          Name: 'SensEthO-SafeLinks-Rule',
          SafeLinksPolicy: 'SensEthO-SafeLinks',
          RecipientDomainIs: [tenant.domain],
          Enabled: true,
        })
        log.push(`[${ts()}] Safe Links rule créée ✅`)
      } catch (e) {
        const msg = (e as Error).message
        if (alreadyExists(msg)) log.push(`[${ts()}] Safe Links rule déjà existante ✅`)
        else throw e
      }

      // ZAP via Set-MalwareFilterPolicy
      log.push(`[${ts()}] Activation ZAP anti-malware (Default policy)…`)
      try {
        await exoInvoke(token, 'Set-MalwareFilterPolicy', {
          Identity: 'Default',
          ZapEnabled: true,
        })
        log.push(`[${ts()}] ZAP anti-malware activé ✅`)
      } catch (e) {
        log.push(`[${ts()}] ZAP: ${(e as Error).message} (non bloquant)`)
      }

    // ════════════════════════════════════════════════════════════════════════════
    // DLP — 3 politiques via Security & Compliance Center (IPPS)
    // ════════════════════════════════════════════════════════════════════════════
    } else if (action === 'dlp') {
      log.push(`[${ts()}] Obtention du token Compliance Center (IPPS)…`)
      const token = await getToken(
        tenant.tenant_id, tenant.client_id, tenant.client_secret,
        'https://ps.compliance.protection.outlook.com/.default'
      )
      log.push(`[${ts()}] Token obtenu ✅`)

      const dlpPolicies = [
        {
          policyName: 'SensEthO-DLP-PersonnalData',
          ruleName:   'SensEthO-DLP-PersonnalData-Rule',
          label:      'Données personnelles',
          types: [
            { name: 'France Passport Number', minCount: '1' },
            { name: 'France National Identification Number', minCount: '1' },
            { name: 'French Social Security Number (INSEE)', minCount: '1' },
          ],
        },
        {
          policyName: 'SensEthO-DLP-CreditCard',
          ruleName:   'SensEthO-DLP-CreditCard-Rule',
          label:      'Cartes de crédit',
          types: [{ name: 'Credit Card Number', minCount: '1' }],
        },
        {
          policyName: 'SensEthO-DLP-Financial',
          ruleName:   'SensEthO-DLP-Financial-Rule',
          label:      'Données financières (IBAN)',
          types: [{ name: 'IBAN', minCount: '1' }],
        },
      ]

      for (const p of dlpPolicies) {
        log.push(`[${ts()}] Politique DLP "${p.label}"…`)

        try {
          await ippsInvoke(token, 'New-DlpCompliancePolicy', {
            Name: p.policyName,
            Mode: 'Enable',
            ExchangeLocation: 'All',
          })
          log.push(`[${ts()}] Policy "${p.label}" créée ✅`)
        } catch (e) {
          const msg = (e as Error).message
          if (alreadyExists(msg)) log.push(`[${ts()}] Policy "${p.label}" déjà existante ✅`)
          else { log.push(`[${ts()}] Policy "${p.label}": ${msg}`); continue }
        }

        try {
          await ippsInvoke(token, 'New-DlpComplianceRule', {
            Name: p.ruleName,
            Policy: p.policyName,
            ContentContainsSensitiveInformation: p.types,
            GenerateAlert: ['SiteAdmin'],
            NotifyUser: ['LastModifiedBy'],
          })
          log.push(`[${ts()}] Règle "${p.label}" créée ✅`)
        } catch (e) {
          const msg = (e as Error).message
          if (alreadyExists(msg)) log.push(`[${ts()}] Règle "${p.label}" déjà existante ✅`)
          else log.push(`[${ts()}] Règle "${p.label}": ${msg}`)
        }
      }

    // ════════════════════════════════════════════════════════════════════════════
    // MFA — Conditional Access : require MFA for all users
    // ════════════════════════════════════════════════════════════════════════════
    } else if (action === 'mfa') {
      log.push(`[${ts()}] Obtention du token Microsoft Graph…`)
      const token = await getToken(
        tenant.tenant_id, tenant.client_id, tenant.client_secret,
        'https://graph.microsoft.com/.default'
      )
      log.push(`[${ts()}] Token obtenu ✅`)

      log.push(`[${ts()}] Création de la politique Conditional Access MFA…`)
      await graphPost(token, '/identity/conditionalAccess/policies', {
        displayName: 'Require MFA — SensEthO',
        state: 'enabled',
        conditions: {
          users: { includeUsers: ['All'], excludeUsers: [] },
          applications: { includeApplications: ['All'] },
        },
        grantControls: {
          operator: 'OR',
          builtInControls: ['mfa'],
        },
      })
      log.push(`[${ts()}] ✅ Politique MFA créée et activée`)
      log.push(`[${ts()}] Tous les utilisateurs devront utiliser MFA pour se connecter`)

    // ════════════════════════════════════════════════════════════════════════════
    // BLOCK-RISKY — Conditional Access : block high/medium risk sign-ins
    // ════════════════════════════════════════════════════════════════════════════
    } else if (action === 'block-risky') {
      log.push(`[${ts()}] Obtention du token Microsoft Graph…`)
      const token = await getToken(
        tenant.tenant_id, tenant.client_id, tenant.client_secret,
        'https://graph.microsoft.com/.default'
      )
      log.push(`[${ts()}] Token obtenu ✅`)

      log.push(`[${ts()}] Création de la politique Block Risky Sign-ins…`)
      await graphPost(token, '/identity/conditionalAccess/policies', {
        displayName: 'Block High/Medium Risk Sign-ins — SensEthO',
        state: 'enabled',
        conditions: {
          users: { includeUsers: ['All'], excludeUsers: [] },
          applications: { includeApplications: ['All'] },
          signInRiskLevels: ['high', 'medium'],
        },
        grantControls: {
          operator: 'OR',
          builtInControls: ['block'],
        },
      })
      log.push(`[${ts()}] ✅ Politique Block Risky Sign-ins créée et activée`)
      log.push(`[${ts()}] Connexions à risque élevé/moyen bloquées automatiquement`)
    }

    return NextResponse.json({ success: true, log })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    log.push(`[${ts()}] ❌ Erreur: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
