import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTracesCredentials, describeTracesError } from '@/lib/eudr/tracesClient'
import { getDdsV3, withdrawDdsV3, getDdsByInternalReferenceV3 } from '@/lib/eudr/tracesV3'
import { guard } from '../_auth'
import { chargerEtatVersions, type EtatVersion } from '../../plots/_referentiel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ────────────────────────────────────────────────────────────────────────────
 * Contrôle a posteriori : la DDS porte-t-elle encore la bonne version du fichier ?
 *
 * `eudr_dds.geojson_attachment_id` fige l'attachement déclaré au moment du dépôt.
 * La correction d'un fichier dépose un SECOND attachement, et le versement au
 * référentiel bascule le périmètre courant de l'un à l'autre. Une DDS déposée
 * avant cette bascule reste donc rattachée à une version qui n'est plus celle du
 * référentiel — sans que rien ne le dise, alors que c'est le point à plus fort
 * enjeu réglementaire du lot.
 *
 * Ce contrôle CONSTATE, il n'agit pas : aucun dépôt, aucune modification de DDS
 * n'est automatisé. Formulation factuelle, l'appréciation revient à l'opérateur.
 * ────────────────────────────────────────────────────────────────────────── */

type EtatControle = 'conforme' | 'version_perimee' | 'hors_perimetre' | 'non_rattachee' | 'fichier_absent'

interface ControleReferentiel {
  etat: EtatControle
  /** Vrai seulement quand la déclaration porte des géométries autres que celles du référentiel. */
  ecart: boolean
  libelle: string
  message: string
}

function controlerDds(attId: string | null, etats: Map<string, EtatVersion>): ControleReferentiel {
  if (!attId) {
    return {
      etat: 'non_rattachee', ecart: false, libelle: 'Non contrôlable',
      message: 'Aucun fichier de géolocalisation rattaché dans l’application (DDS importée ou déposée hors de l’app) : la comparaison avec le référentiel n’est pas possible.',
    }
  }
  const e = etats.get(attId)
  if (!e) {
    return {
      etat: 'fichier_absent', ecart: false, libelle: 'Fichier absent',
      message: 'Le fichier de géolocalisation déclaré n’est plus présent dans l’application : la comparaison avec le référentiel n’est pas possible.',
    }
  }
  if (e.auPerimetre) {
    return {
      etat: 'conforme', ecart: false, libelle: 'Version de référence',
      message: `La déclaration porte « ${e.nom ?? '—'} », qui est la version au périmètre courant du référentiel.`,
    }
  }
  if (e.autreAuPerimetre) {
    const autre = e.autreVersionRole === 'fichier_initial' ? 'le fichier initial' : 'la version corrigée'
    return {
      etat: 'version_perimee', ecart: true, libelle: 'Version périmée',
      message: `La déclaration porte « ${e.nom ?? '—'} » (${e.libelleVersion.toLowerCase()}) ; c’est désormais ${autre}`
        + ` « ${e.autreVersionNom ?? '—'} » qui porte le périmètre courant du référentiel.`
        + ' La déclaration porte donc des géométries différentes de celles du référentiel ;'
        + ' une déclaration rectificative peut être nécessaire.',
    }
  }
  return {
    etat: 'hors_perimetre', ecart: false, libelle: 'Hors périmètre courant',
    message: `La déclaration porte « ${e.nom ?? '—'} », dont aucune parcelle n’est au périmètre courant du référentiel`
      + ' (fichier jamais versé, ou remplacé par un autre versement).',
  }
}

/** Liste enrichie du contrôle. Une erreur de contrôle ne fait jamais échouer la liste. */
async function listerDds(orgId: string) {
  const admin = createAdminClient()
  const [dds, etats] = await Promise.all([
    admin.from('eudr_dds').select('*').eq('org_id', orgId).order('submitted_at', { ascending: false }),
    chargerEtatVersions(orgId).catch(() => new Map<string, EtatVersion>()),
  ])
  if (dds.error) return { error: dds.error.message, data: [] as Record<string, unknown>[] }
  const data = (dds.data ?? []).map(d => ({
    ...d,
    controle_referentiel: controlerDds((d.geojson_attachment_id as string | null) ?? null, etats),
  }))
  return { error: null, data }
}

/** GET /api/eudr-fournisseurs/traces/dds?org_id=xxx — liste des DDS déposées (suivi). */
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await listerDds(orgId!)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}

/**
 * POST { org_id, id? } — actualise le statut officiel via getDds (par UUID) auprès de TRACES.
 * Sans `id` : actualise toutes les DDS de l'org. Renvoie la liste à jour.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; id?: string; uuid?: string; action?: 'refresh' | 'withdraw' | 'import' | 'discover' }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()

    // Découverte : balaie les n° de contrat comme références internes et importe les DDS trouvées.
    if (body.action === 'discover') {
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      const { data: contracts } = await admin.from('eudr_contracts').select('contract_number').eq('org_id', body.org_id!)
      const refs = new Set<string>()
      for (const c of contracts ?? []) {
        const cn = (c.contract_number as string | null)?.trim()
        if (!cn) continue
        refs.add(cn)
        cn.split(/\s+/).forEach(p => { if (/^\d{4}-\d{3}/.test(p)) refs.add(p) }) // fragments type 2025-029A
      }
      let discovered = 0
      for (const ref of refs) {
        try {
          const overviews = await getDdsByInternalReferenceV3(creds, ref)
          for (const o of overviews) {
            await admin.from('eudr_dds').upsert({
              org_id: body.org_id!, dds_uuid: o.uuid, environment: creds.environment,
              internal_reference_number: o.internalReferenceNumber, reference_number: o.referenceNumber,
              verification_number: o.verificationNumber, status: o.status,
              official_date: o.date, official_updated_by: o.updatedBy,
              submitted_by: '(importée)', last_checked_at: new Date().toISOString(),
            }, { onConflict: 'org_id,dds_uuid' })
            discovered++
          }
        } catch { /* une référence en échec ne bloque pas le balayage */ }
      }
      const fresh = (await listerDds(body.org_id!)).data
      return NextResponse.json({ data: fresh, discovered })
    }

    // Import d'une DDS dans le suivi — accepte un UUID (getDds) OU une référence interne
    // (getDdsByInternalReference). Fonctionne pour tout statut.
    if (body.action === 'import') {
      const val = (body.uuid ?? '').trim()
      if (!val) return NextResponse.json({ error: 'UUID ou référence interne requis' }, { status: 400 })
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

      const upsert = (o: { uuid: string; internalReferenceNumber: string | null; referenceNumber: string | null; verificationNumber: string | null; status: string | null; date: string | null; updatedBy: string | null }) =>
        admin.from('eudr_dds').upsert({
          org_id: body.org_id!, dds_uuid: o.uuid, environment: creds.environment,
          internal_reference_number: o.internalReferenceNumber, reference_number: o.referenceNumber,
          verification_number: o.verificationNumber, status: o.status,
          official_date: o.date, official_updated_by: o.updatedBy,
          submitted_by: '(importée)', last_checked_at: new Date().toISOString(),
        }, { onConflict: 'org_id,dds_uuid' })

      try {
        if (isUuid) {
          const info = await getDdsV3(creds, val)
          if (!info.status && !info.internalReferenceNumber && !info.referenceNumber) {
            return NextResponse.json({ error: 'Aucune DDS trouvée pour cet UUID (sur cet environnement).' }, { status: 404 })
          }
          await upsert({ uuid: val, ...info })
        } else {
          const found = await getDdsByInternalReferenceV3(creds, val)
          if (!found.length) {
            return NextResponse.json({ error: `Aucune DDS pour « ${val} ». Astuce : c'est peut-être un n° de référence officiel (non recherchable seul) — utilisez le bouton « 🔎 Rechercher mes DDS », ou collez l'UUID (dans l'URL TRACES après /edit/).` }, { status: 404 })
          }
          for (const o of found) await upsert(o)
        }
      } catch (err) {
        const e = describeTracesError(err); return NextResponse.json({ error: e.message }, { status: 502 })
      }
      const fresh = (await listerDds(body.org_id!)).data
      return NextResponse.json({ data: fresh })
    }

    // Retrait d'une DDS (withdrawDds) — fenêtre 72 h, statut AVAILABLE, hors verrou douane.
    if (body.action === 'withdraw') {
      if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
      const { data: row } = await admin.from('eudr_dds').select('dds_uuid').eq('id', body.id).eq('org_id', body.org_id!).maybeSingle()
      if (!row) return NextResponse.json({ error: 'DDS introuvable' }, { status: 404 })
      const creds = await getTracesCredentials(body.org_id!)
      if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })
      try {
        await withdrawDdsV3(creds, row.dds_uuid as string)
      } catch (err) {
        const info = describeTracesError(err)
        return NextResponse.json({ error: info.message, detail: info.detail }, { status: 502 })
      }
      await admin.from('eudr_dds').update({ status: 'WITHDRAWN', last_checked_at: new Date().toISOString() }).eq('id', body.id)
      const fresh = (await listerDds(body.org_id!)).data
      return NextResponse.json({ data: fresh })
    }
    const q = admin.from('eudr_dds').select('*').eq('org_id', body.org_id!)
    if (body.id) q.eq('id', body.id)
    const { data: rows, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const creds = await getTracesCredentials(body.org_id!)
    if (!creds) return NextResponse.json({ error: 'Identifiants TRACES non configurés.' }, { status: 400 })

    for (const row of rows ?? []) {
      try {
        const info = await getDdsV3(creds, row.dds_uuid as string)
        await admin.from('eudr_dds').update({
          status: info.status,
          reference_number: info.referenceNumber,
          verification_number: info.verificationNumber,
          official_date: info.date,
          official_updated_by: info.updatedBy,
          last_checked_at: new Date().toISOString(),
        }).eq('id', row.id)
      } catch { /* une DDS injoignable ne bloque pas les autres */ }
    }

    const fresh = (await listerDds(body.org_id!)).data
    return NextResponse.json({ data: fresh })
  } catch (err) {
    const info = describeTracesError(err)
    return NextResponse.json({ error: info.message }, { status: 502 })
  }
}
