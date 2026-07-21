import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { submitDdsV3, DdsStatement } from '@/lib/eudr/tracesV3'
import { toIso2 } from '@/lib/eudr/countries'
import { sanitizeGeojson, SanitizeReport } from '@/lib/eudr/geoSanitize'
import { guard } from '../_auth'

/** Normalise en ISO2 tous les pays de la déclaration (pays d'activité, transit, producteurs). */
function normalizeCountries(s: DdsStatement): void {
  if (s.countryOfActivity) s.countryOfActivity = toIso2(s.countryOfActivity)
  if (s.borderCrossCountry) s.borderCrossCountry = toIso2(s.borderCrossCountry)
  for (const c of (s.commodities ?? [])) {
    const producers = Array.isArray(c.producers) ? c.producers : c.producers ? [c.producers] : []
    for (const p of producers) if (p.country) p.country = toIso2(p.country)
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lit un document GeoJSON stocké dans SharePoint et le renvoie encodé en base64. */
async function geojsonFromAttachment(orgId: string, attachmentId: string): Promise<{ base64: string; report: SanitizeReport }> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
  if (!row) throw new Error('Document GeoJSON introuvable.')
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) throw new Error('Fichier GeoJSON SharePoint introuvable.')
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) throw new Error('URL de téléchargement GeoJSON indisponible.')
  const raw = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
  // Nettoyage TRACES : suppression des trous + réparation des auto-intersections.
  const { geojson, report } = sanitizeGeojson(raw)
  return { base64: Buffer.from(JSON.stringify(geojson)).toString('base64'), report }
}

/**
 * POST { org_id, operatorType, statement }
 * Dépose une Due Diligence Statement dans le registre EUDR via l'API **V3**
 * (EUDRDueDiligenceStatementServiceV3 ; V1/V2 désactivées côté serveur).
 * Écriture → droit d'édition requis. En production, la DDS a valeur légale.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; operatorType?: string; statement?: DdsStatement; geojsonAttachmentId?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    if (!body.operatorType || !body.statement) {
      return NextResponse.json({ error: 'operatorType et statement requis' }, { status: 400 })
    }

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés pour cette organisation.' }, { status: 400 })

    const statement = body.statement
    let geoReport: SanitizeReport | null = null
    // GeoJSON depuis un document SharePoint : on lit le fichier, on le nettoie et on l'injecte dans le 1er producteur.
    if (body.geojsonAttachmentId) {
      const { base64, report } = await geojsonFromAttachment(body.org_id!, body.geojsonAttachmentId)
      geoReport = report
      const c0 = statement.commodities?.[0]
      if (c0) {
        const producers = Array.isArray(c0.producers) ? c0.producers : c0.producers ? [c0.producers] : []
        if (producers.length === 0) producers.push({})
        producers[0].geometryGeojson = base64
        c0.producers = producers
      }
    }

    normalizeCountries(statement)

    // V3 : operatorType → operatorRole. La géométrie GeoJSON est encodée en base64 dans le client V3.
    const result = await submitDdsV3(creds, { operatorRole: body.operatorType, statement })

    // Enregistrement du dépôt pour le suivi (best-effort : n'interrompt jamais la réponse).
    if (result.uuid) {
      try {
        const supabase = createUserClient()
        const { data: { user } } = await supabase.auth.getUser()
        const c0 = statement.commodities?.[0]
        await createAdminClient().from('eudr_dds').insert({
          org_id: body.org_id!,
          dds_uuid: result.uuid,
          environment: creds.environment,
          internal_reference_number: statement.internalReferenceNumber ?? null,
          activity_type: statement.activityType ?? null,
          commodity: c0?.descriptors?.descriptionOfGoods ?? c0?.hsHeading ?? null,
          net_weight: c0?.descriptors?.goodsMeasure?.netWeight ?? null,
          submitted_by: user?.email ?? null,
        })
      } catch { /* table absente ou doublon : sans effet sur le dépôt */ }
    }

    return NextResponse.json({ ok: true, environment: creds.environment, ddsIdentifier: result.uuid, geoSanitized: geoReport })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
