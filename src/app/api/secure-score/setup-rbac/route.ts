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
    // 1. Obtenir le token Graph (avec les permissions du tenant MON HEURE — l'app Secure-Score)
    log.push(`[${ts()}] Obtention du token Graph…`)
    const graphToken = await getGraphToken(
      tenant.tenant_id,
      tenant.client_id,
      tenant.client_secret
    )
    log.push(`[${ts()}] Token Graph obtenu ✅`)

    // 2. Trouver l'objet Service Principal de l'app dans le tenant client
    log.push(`[${ts()}] Recherche du Service Principal de l'app (appId: ${tenant.client_id})…`)
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
    if (!sp) throw new Error('Service Principal non trouvé — vérifiez que l\'app est bien dans ce tenant')
    log.push(`[${ts()}] Service Principal trouvé: ${sp.displayName} (id: ${sp.id}) ✅`)

    // 3. Trouver la définition du rôle "Organization Management" Exchange
    // On liste d'abord tous les rôles pour trouver le bon nom (peut varier de PowerShell)
    log.push(`[${ts()}] Récupération des rôles Exchange disponibles…`)
    const roleDefRes = await fetch(
      `https://graph.microsoft.com/beta/roleManagement/exchange/roleDefinitions?$select=id,displayName&$top=100`,
      { headers: { Authorization: `Bearer ${graphToken}` } }
    )
    if (!roleDefRes.ok) {
      const txt = await roleDefRes.text()
      throw new Error(`Liste rôles Exchange: ${roleDefRes.status} — ${txt}`)
    }
    const roleDefData = await roleDefRes.json()
    const allRoles: { id: string; displayName: string }[] = roleDefData.value ?? []

    log.push(`[${ts()}] ${allRoles.length} rôle(s) Exchange trouvé(s)`)

    // Chercher "Organization Management" (insensible à la casse)
    const TARGET_NAMES = ['Organization Management', 'OrganizationManagement', 'organization management']
    let roleDef = allRoles.find(r =>
      TARGET_NAMES.some(n => r.displayName?.toLowerCase() === n.toLowerCase())
    )

    // Fallback: chercher un rôle contenant "Organization" et "Management"
    if (!roleDef) {
      roleDef = allRoles.find(r =>
        r.displayName?.toLowerCase().includes('organization') &&
        r.displayName?.toLowerCase().includes('management')
      )
    }

    if (!roleDef) {
      // Logger les rôles disponibles pour diagnostic
      const roleNames = allRoles.map(r => r.displayName).join(', ')
      throw new Error(`Rôle "Organization Management" non trouvé. Rôles disponibles: ${roleNames || 'aucun'}`)
    }
    log.push(`[${ts()}] Rôle trouvé: "${roleDef.displayName}" (id: ${roleDef.id}) ✅`)

    // 4. Vérifier si l'assignment existe déjà
    log.push(`[${ts()}] Vérification d'un assignment existant…`)
    const existRes = await fetch(
      `https://graph.microsoft.com/beta/roleManagement/exchange/roleAssignments?$filter=principalId eq '${sp.id}' and roleDefinitionId eq '${roleDef.id}'`,
      { headers: { Authorization: `Bearer ${graphToken}` } }
    )
    if (existRes.ok) {
      const existData = await existRes.json()
      if (existData.value?.length > 0) {
        log.push(`[${ts()}] ✅ Assignment déjà existant — rien à faire`)
        return NextResponse.json({ success: true, log, alreadyAssigned: true })
      }
    }
    log.push(`[${ts()}] Aucun assignment existant — création en cours…`)

    // 5. Créer l'assignment RBAC
    const assignBody = {
      roleDefinitionId: roleDef.id,
      principalId: sp.id,
      directoryScopeId: '/',
    }
    const assignRes = await fetch(
      'https://graph.microsoft.com/beta/roleManagement/exchange/roleAssignments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${graphToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignBody),
      }
    )

    if (!assignRes.ok) {
      const errText = await assignRes.text()
      throw new Error(`Création assignment: ${assignRes.status} — ${errText}`)
    }

    const assignData = await assignRes.json()
    log.push(`[${ts()}] ✅ Rôle Exchange "Organization Management" assigné! (id: ${assignData.id})`)
    log.push(`[${ts()}] Attendez 2-5 minutes pour la propagation, puis relancez le déblocage.`)

    return NextResponse.json({ success: true, log, assignmentId: assignData.id })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    log.push(`[${ts()}] ❌ Erreur: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
