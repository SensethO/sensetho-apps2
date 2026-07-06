import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { submitDdsV3, DdsStatement } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lit un document GeoJSON stocké dans SharePoint et le renvoie encodé en base64. */
async function geojsonFromAttachment(orgId: string, attachmentId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
  if (!row) throw new Error('Document GeoJSON introuvable.')
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) throw new Error('Fichier GeoJSON SharePoint introuvable.')
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) throw new Error('URL de téléchargement GeoJSON indisponible.')
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  return buf.toString('base64')
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
    // GeoJSON depuis un document SharePoint : on lit le fichier et on l'injecte dans le 1er producteur.
    if (body.geojsonAttachmentId) {
      const geoB64 = await geojsonFromAttachment(body.org_id!, body.geojsonAttachmentId)
      const c0 = statement.commodities?.[0]
      if (c0) {
        const producers = Array.isArray(c0.producers) ? c0.producers : c0.producers ? [c0.producers] : []
        if (producers.length === 0) producers.push({})
        producers[0].geometryGeojson = geoB64
        c0.producers = producers
      }
    }

    // V3 : operatorType → operatorRole. La géométrie GeoJSON est encodée en base64 dans le client V3.
    const result = await submitDdsV3(creds, { operatorRole: body.operatorType, statement })
    return NextResponse.json({ ok: true, environment: creds.environment, ddsIdentifier: result.uuid })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ ok: false, error: info.message, status: info.status, detail: info.detail }, { status: 502 })
  }
}
