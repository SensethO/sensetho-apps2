import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { analyzeCoa, CoaFile, CoaDocument, CoaRow } from '@/lib/eudr/coaAnalyze'
import { evaluateConformity } from '@/lib/eudr/coaConformity'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/** Lit les octets + le mime d'un fichier eudr_attachments depuis SharePoint. */
async function readAttachment(orgId: string, attId: string): Promise<CoaFile | null> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id, mime, name').eq('id', attId).eq('org_id', orgId).maybeSingle()
  if (!row) return null
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) return null
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) return null
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const mime = (row.mime as string) || (item.file as { mimeType?: string })?.mimeType || 'application/octet-stream'
  return { data: buf, mime, name: (row.name as string) || 'fichier' }
}

/** Applique le moteur déterministe et calcule la synthèse d'un document. */
function processDocument(doc: CoaDocument) {
  const rows: CoaRow[] = (doc.rows ?? []).map(r => {
    const det = evaluateConformity(r.specification, r.resultat)
    if (det.verdict === 'conforme' || det.verdict === 'non_conforme') {
      return { ...r, verdict: det.verdict, commentaire: det.reason, source: r.source || 'Règle automatique' }
    }
    return r
  })
  const counts = {
    conforme: rows.filter(r => r.verdict === 'conforme').length,
    non_conforme: rows.filter(r => r.verdict === 'non_conforme').length,
    a_verifier: rows.filter(r => r.verdict === 'a_verifier').length,
  }
  const analysis = rows.map(r => ({ section: r.section, parametre: r.parametre, specification: r.specification, resultat: r.resultat, verdict: r.verdict, reason: r.commentaire, source: r.source }))
  const summary = { conforme_global: counts.non_conforme === 0, resume: doc.summary?.resume ?? '', counts }
  const documentDate = doc.header?.date_document || doc.header?.date_analyse || null
  const label = [doc.header?.produit, doc.header?.numero_batch].filter(Boolean).join(' — ') || doc.header?.numero_certificat || null
  return {
    fields: {
      extracted: { header: doc.header, rows },
      analysis, summary,
      points_a_verifier: doc.points_a_verifier ?? [],
      document_date: documentDate,
      status: 'analyzed', analyzed_at: new Date().toISOString(), analyzed_model: 'claude-opus-4-8',
      updated_at: new Date().toISOString(),
    },
    label,
  }
}

/** POST { org_id, coa_id } — analyse le fichier ; crée un enregistrement par produit détecté. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; coa_id?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.coa_id) return NextResponse.json({ error: 'coa_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: coa } = await admin.from('eudr_coa')
      .select('user_id, uploaded_by_email, supplier_id, contract_id, source_attachment_id, client_demand_attachment_id, label')
      .eq('id', body.coa_id).eq('org_id', body.org_id).maybeSingle()
    if (!coa) return NextResponse.json({ error: 'COA introuvable' }, { status: 404 })
    if (!coa.source_attachment_id) return NextResponse.json({ error: 'Aucun fichier COA téléversé.' }, { status: 400 })

    const coaFile = await readAttachment(body.org_id!, coa.source_attachment_id as string)
    if (!coaFile) return NextResponse.json({ error: 'Fichier COA introuvable sur SharePoint.' }, { status: 502 })
    const demandFile = coa.client_demand_attachment_id
      ? await readAttachment(body.org_id!, coa.client_demand_attachment_id as string)
      : null

    const documents = await analyzeCoa(coaFile, demandFile)
    if (!documents.length) return NextResponse.json({ error: "Aucun produit n'a pu être extrait du fichier." }, { status: 502 })

    // 1er document → met à jour l'enregistrement courant.
    const first = processDocument(documents[0])
    await admin.from('eudr_coa').update({ ...first.fields, label: first.label || (coa.label as string) })
      .eq('id', body.coa_id).eq('org_id', body.org_id)

    // Documents suivants → enregistrements séparés, conservés (mêmes fichier/fournisseur/déposant).
    if (documents.length > 1) {
      const extra = documents.slice(1).map(d => {
        const p = processDocument(d)
        return {
          org_id: body.org_id, user_id: coa.user_id, uploaded_by_email: coa.uploaded_by_email,
          supplier_id: coa.supplier_id, contract_id: coa.contract_id,
          source_attachment_id: coa.source_attachment_id, client_demand_attachment_id: coa.client_demand_attachment_id,
          label: p.label || (coa.label as string) || 'COA', ...p.fields,
        }
      })
      await admin.from('eudr_coa').insert(extra)
    }

    return NextResponse.json({ ok: true, count: documents.length })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message ?? String(err) }, { status: 502 })
  }
}
