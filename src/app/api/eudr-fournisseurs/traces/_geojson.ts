import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { sanitizeGeojson, SanitizeReport } from '@/lib/eudr/geoSanitize'

/**
 * Lecture d'un GeoJSON SharePoint, assainissement TRACES et empreinte.
 *
 * Partagé entre le DÉPÔT (qui transmet `base64` et fige `sha256`) et le CONTRÔLE
 * a posteriori (qui recalcule `sha256` pour le comparer à celui figé). Les deux
 * DOIVENT passer par cette fonction : un assainissement divergent entre le dépôt
 * et le contrôle produirait des écarts imaginaires.
 *
 * L'empreinte porte sur les octets transmis, pas sur le fichier brut — c'est ce
 * qui a été déclaré qui fait foi.
 *
 * Aucun octet ne transite par Vercel au-delà de ce calcul : le contenu est lu en
 * mémoire, haché, et jamais réémis vers le navigateur.
 */
export async function geojsonFromAttachment(
  orgId: string,
  attachmentId: string,
  simplify: boolean,
): Promise<{ base64: string; sha256: string; report: SanitizeReport }> {
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
  // Nettoyage TRACES : éclatement MultiPolygon, suppression des trous, arrondi (+ simplification optionnelle).
  const { geojson, report } = sanitizeGeojson(raw, { simplify })
  const payload = JSON.stringify(geojson)
  return {
    base64: Buffer.from(payload).toString('base64'),
    sha256: createHash('sha256').update(payload).digest('hex'),
    report,
  }
}

/** Empreinte seule, pour le contrôle : ne construit pas le base64 inutilement. */
export async function empreinteActuelle(orgId: string, attachmentId: string, simplify: boolean): Promise<string | null> {
  try {
    const { sha256 } = await geojsonFromAttachment(orgId, attachmentId, simplify)
    return sha256
  } catch {
    return null // fichier illisible ou supprimé : le contrôle se tait plutôt que de conclure
  }
}
