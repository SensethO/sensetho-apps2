import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string) {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Auth Graph: ${txt}`)
  }
  const json = await res.json()
  return json.access_token as string
}

// Récupérer tous les rôles Exchange (pagination)
async function getAllExchangeRoles(graphToken: string): Promise<{ id: string; displayName: string }[]> {
  const allRoles: { id: string; displayName: string }[] = []
  let url: string | null = `https://graph.microsoft.com/beta/roleManagement/exchange/roleDefinitions?$select=id,displayName&$top=100`

  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${graphToken}` } })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Liste rôles Exchange: ${res.status} — ${txt}`)
    }
    const data: { value?: { id: string; displayName: string }[]; '@odata.nextLink'?: string } = await res.json()
    allRoles.push(...(data.value ?? []))
    url = data['@odata.nextLink'] ?? null
  }
  return allRoles
}

// POST — assigner automatiquement le rôle Exchange RBAC via Graph API
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
    // 1. Token Graph
    log.push(`[${ts()}] Obtention du token Graph…`)
    const graphToken = await getGraphToken(tenant.tenant_id, tenant.client_id, tenant.client_secret)
    log.push(`[${ts()}] Token Graph obtenu ✅`)

    // 2. Service Principal
    log.push(`[${ts()}] Recherche du Service Principal (appId: ${tenant.client_id})…`)
    const spRes = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${tenant.client_id}'&$select=id,displayName,appId`,
      { headers: { Authorization: `Bearer ${graphToken}` } }
    )
    if (!spRes.ok) {
      const txt = await spRes.text()
      throw new Error(`Recherche SP: ${spRes.status} — ${txt}`)
    }
    const spData = await spRes.json()
    const sp = spData.value?.[0]
    if (!sp) throw new Error('Service Principal non trouvé dans ce tenant')
    log.push(`[${ts()}] Service Principal: ${sp.displayName} (id: ${sp.id}) ✅`)

    // 3. Récupérer TOUS les rôles Exchange (toutes les pages)
    log.push(`[${ts()}] Récupération de tous les rôles Exchange disponibles…`)
    const allRoles = await getAllExchangeRoles(graphToken)
    log.push(`[${ts()}] ${allRoles.length} rôle(s) Exchange trouvé(s) au total`)

    // 4. Chercher le bon rôle — ordre de priorité :
    // "Application Exchange Full Access" → "Organization Management" → "Transport Hygiene" → "Organization Configuration"
    const PRIORITY_ROLES = [
      'Application Exchange Full Access',
      'Organization Management',
      'Transport Hygiene',
      'Hygiene Management',
      'Organization Configuration',
    ]

    let roleDef: { id: string; displayName: string } | undefined

    for (const targetName of PRIORITY_ROLES) {
      roleDef = allRoles.find(r => r.displayName?.toLowerCase() === targetName.toLowerCase())
      if (roleDef) {
        log.push(`[${ts()}] Rôle sélectionné: "${roleDef.displayName}" ✅`)
        break
      }
    }

    if (!roleDef) {
      const roleNames = allRoles.map(r => r.displayName).sort().join(' | ')
      throw new Error(`Aucun rôle approprié trouvé. Liste complète (${allRoles.length}): ${roleNames}`)
    }

    // 5. Vérifier si l'assignment existe déjà
    log.push(`[${ts()}] Vérification d'un assignment existant…`)
    const existRes = await fetch(
      `https://graph.microsoft.com/beta/roleManagement/exchange/roleAssignments?$filter=principalId eq '${sp.id}' and roleDefinitionId eq '${roleDef.id}'`,
      { headers: { Authorization: `Bearer ${graphToken}` } }
    )
    if (existRes.ok) {
      const existData = await existRes.json()
      if (existData.value?.length > 0) {
        log.push(`[${ts()}] ✅ Rôle "${roleDef.displayName}" déjà assigné — rien à faire`)
        return NextResponse.json({ success: true, log, alreadyAssigned: true })
      }
    }
    log.push(`[${ts()}] Aucun assignment existant — création en cours…`)

    // 6. Créer l'assignment RBAC
    const assignRes = await fetch(
      'https://graph.microsoft.com/beta/roleManagement/exchange/roleAssignments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${graphToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleDefinitionId: roleDef.id,
          principalId: sp.id,
          directoryScopeId: '/',
        }),
      }
    )

    if (!assignRes.ok) {
      const errText = await assignRes.text()
      throw new Error(`Création assignment: ${assignRes.status} — ${errText}`)
    }

    const assignData = await assignRes.json()
    log.push(`[${ts()}] ✅ Rôle "${roleDef.displayName}" assigné! (assignmentId: ${assignData.id})`)
    log.push(`[${ts()}] Attendez 2-5 minutes pour la propagation, puis relancez le Déblocage.`)

    return NextResponse.json({ success: true, log, assignmentId: assignData.id, roleName: roleDef.displayName })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    log.push(`[${ts()}] ❌ Erreur: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
