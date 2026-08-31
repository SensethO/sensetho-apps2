import { createAdminClient } from '@/lib/supabase/admin'
import { SEUIL_POLYGONE_HA } from '@/lib/eudr/screening'

/**
 * Lecture du référentiel des parcelles, enrichie de ce qui la rend lisible :
 * nom du fichier d'origine, nom du fournisseur, état du dernier signal de couvert,
 * et le contrôle du seuil de polygone de l'article 9.
 *
 * Partagé entre l'écran et l'export : deux lectures distinctes finiraient par
 * diverger, et un export qui ne dit pas la même chose que l'écran ne vaut rien
 * pour préparer une déclaration.
 */

export interface SignalParcelle {
  etat: 'perturbation' | 'risque_eleve' | 'sans_signal' | 'non_analyse'
  analyseLe: string | null
}

export interface ParcelleEnrichie {
  id: string
  org_id: string
  supplier_id: string | null
  attachment_id: string
  feature_index: number
  plot_ref: string | null
  producer_name: string | null
  commodity: string | null
  country: string | null
  geometry_type: string | null
  declared_area_ha: number | null
  computed_area_ha: number | null
  centroid_lon: number | null
  centroid_lat: number | null
  geom_hash: string | null
  survey_date: string | null
  survey_source: string | null
  created_at: string
  created_by: string | null
  supplier_assigned_at?: string | null
  supplier_assigned_by?: string | null
  // Ajouts de lecture
  attachment_name: string | null
  supplier_name: string | null
  surface_retenue_ha: number
  polygone_requis: boolean
  polygone_manquant: boolean
  signal: SignalParcelle
}

export interface Referentiel {
  parcelles: ParcelleEnrichie[]
  doublons: Record<string, unknown>[]
  fournisseurs: { id: string; company: string | null }[]
  totaux: {
    parcelles: number
    surfaceHa: number
    fournisseursCouverts: number
    sansFournisseur: number
    auDela4Ha: number
    manquementsPolygone: number
    seuilHa: number
  }
  parFournisseur: Record<string, { parcelles: number; surfaceHa: number }>
}

/** Surface retenue : la surface calculée fait foi, la déclarée supplée un point. */
function surfaceRetenue(p: { computed_area_ha?: unknown; declared_area_ha?: unknown }): number {
  const calculee = Number(p.computed_area_ha ?? 0)
  if (calculee > 0) return calculee
  return Number(p.declared_area_ha ?? 0)
}

const estPolygone = (t: unknown) => /polygon/i.test(String(t ?? ''))
const risqueEleve = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'high'

interface SignalWhisp {
  plotId?: string
  riskPcrop?: string | null
  riskAcrop?: string | null
  riskTimber?: string | null
  disturbanceAfter2020?: boolean
}

export async function chargerReferentiel(orgId: string, supplierId?: string | null): Promise<Referentiel> {
  const admin = createAdminClient()

  let q = admin.from('eudr_plots').select('*').eq('org_id', orgId).eq('is_current', true)
  if (supplierId) q = q.eq('supplier_id', supplierId)
  const { data: brut, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const [doublons, fournisseurs, atts, analyses] = await Promise.all([
    admin.from('eudr_plots_doublons').select('*').eq('org_id', orgId),
    admin.from('eudr_suppliers').select('id, company').eq('org_id', orgId).order('company'),
    admin.from('eudr_attachments').select('id, name').eq('org_id', orgId),
    admin.from('eudr_deforestation').select('attachment_id, analyzed_at, overall_risk, plots').eq('org_id', orgId),
  ])

  const nomFichier = new Map((atts.data ?? []).map(a => [String(a.id), (a.name as string) ?? null]))
  const nomFournisseur = new Map((fournisseurs.data ?? []).map(f => [String(f.id), (f.company as string) ?? null]))

  // Dernière analyse de couvert par fichier : c'est elle qui porte les signaux.
  const derniere = new Map<string, { analyzed_at: string; overall_risk: string | null; plots: unknown }>()
  for (const a of analyses.data ?? []) {
    const cle = String(a.attachment_id ?? '')
    if (!cle) continue
    const prec = derniere.get(cle)
    if (!prec || String(a.analyzed_at) > prec.analyzed_at) {
      derniere.set(cle, { analyzed_at: String(a.analyzed_at), overall_risk: (a.overall_risk as string) ?? null, plots: a.plots })
    }
  }

  const parcelles: ParcelleEnrichie[] = (brut ?? []).map(p => {
    const surface = +surfaceRetenue(p).toFixed(4)
    const requis = surface > SEUIL_POLYGONE_HA

    let signal: SignalParcelle = { etat: 'non_analyse', analyseLe: null }
    const analyse = derniere.get(String(p.attachment_id))
    if (analyse) {
      const liste = Array.isArray(analyse.plots) ? (analyse.plots as SignalWhisp[]) : []
      // Whisp identifie la parcelle par sa référence, à défaut par son rang (1-based).
      const fiche = liste.find(s => {
        const id = String(s?.plotId ?? '')
        return (p.plot_ref && id === String(p.plot_ref)) || id === String(Number(p.feature_index) + 1)
      })
      if (fiche) {
        signal = {
          etat: fiche.disturbanceAfter2020
            ? 'perturbation'
            : (risqueEleve(fiche.riskPcrop) || risqueEleve(fiche.riskAcrop) || risqueEleve(fiche.riskTimber))
              ? 'risque_eleve'
              : 'sans_signal',
          analyseLe: analyse.analyzed_at,
        }
      } else {
        // Fichier analysé mais parcelle non retrouvée dans la réponse : l'état du
        // fichier vaut indice, jamais conclusion sur cette parcelle-là.
        signal = {
          etat: analyse.overall_risk === 'high' ? 'risque_eleve' : 'sans_signal',
          analyseLe: analyse.analyzed_at,
        }
      }
    }

    return {
      ...(p as unknown as ParcelleEnrichie),
      attachment_name: nomFichier.get(String(p.attachment_id)) ?? null,
      supplier_name: p.supplier_id ? (nomFournisseur.get(String(p.supplier_id)) ?? null) : null,
      surface_retenue_ha: surface,
      polygone_requis: requis,
      polygone_manquant: requis && !estPolygone(p.geometry_type),
      signal,
    }
  })

  // Surface par fournisseur : c'est cette base qui plafonnera les volumes
  // achetables lors de la réconciliation volumétrique.
  const parFournisseur = new Map<string, { parcelles: number; surfaceHa: number }>()
  for (const p of parcelles) {
    const cle = p.supplier_id ?? 'sans-fournisseur'
    const acc = parFournisseur.get(cle) ?? { parcelles: 0, surfaceHa: 0 }
    acc.parcelles += 1
    acc.surfaceHa += p.surface_retenue_ha
    parFournisseur.set(cle, acc)
  }

  return {
    parcelles,
    doublons: (doublons.data ?? []) as Record<string, unknown>[],
    fournisseurs: (fournisseurs.data ?? []).map(f => ({ id: String(f.id), company: (f.company as string) ?? null })),
    totaux: {
      parcelles: parcelles.length,
      surfaceHa: +parcelles.reduce((s, p) => s + p.surface_retenue_ha, 0).toFixed(4),
      fournisseursCouverts: new Set(parcelles.filter(p => p.supplier_id).map(p => p.supplier_id)).size,
      sansFournisseur: parcelles.filter(p => !p.supplier_id).length,
      auDela4Ha: parcelles.filter(p => p.polygone_requis).length,
      manquementsPolygone: parcelles.filter(p => p.polygone_manquant).length,
      seuilHa: SEUIL_POLYGONE_HA,
    },
    parFournisseur: Object.fromEntries(
      Array.from(parFournisseur).map(([k, v]) => [k, { ...v, surfaceHa: +v.surfaceHa.toFixed(4) }]),
    ),
  }
}
