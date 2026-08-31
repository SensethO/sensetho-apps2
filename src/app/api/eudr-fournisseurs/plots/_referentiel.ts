import { createAdminClient } from '@/lib/supabase/admin'
import { SEUIL_POLYGONE_HA } from '@/lib/eudr/screening'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

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

/* ────────────────────────────────────────────────────────────────────────────
 * Versions d'un même fichier de géolocalisation.
 *
 * La correction automatique ne remplace pas l'original : elle dépose un second
 * fichier « X (corrigé).geojson » et un second attachement. Original et version
 * corrigée sont donc deux identifiants distincts qui décrivent les mêmes terres.
 * Sans rapprochement, verser les deux ferait compter deux fois les mêmes
 * surfaces — exactement le double comptage que le tri reproche aux fichiers
 * défectueux.
 *
 * Rapprochement : la colonne `eudr_attachments.corrige_de` quand elle existe
 * (migration 20260831_eudr_attachment_origine, cf. §12), à défaut le nom, qui
 * est construit par le code et donc déterministe.
 * ────────────────────────────────────────────────────────────────────────── */

export type VersionFichier = 'en_etat' | 'corrigee'

export const LIBELLE_VERSION: Record<VersionFichier, string> = {
  en_etat: 'En l’état',
  corrigee: 'Version corrigée',
}

const RE_CORRIGE = /\s*\(corrigé\)(?=\.[^.]+$|$)/i

/** Le nom porte-t-il la marque déposée par la correction automatique ? */
export function estNomCorrige(nom: string | null | undefined): boolean {
  return RE_CORRIGE.test(String(nom ?? ''))
}

/** « X (corrigé).geojson » → « X.geojson ». */
export function nomOriginalDe(nom: string): string {
  return nom.replace(RE_CORRIGE, '')
}

/** « X.geojson » → « X (corrigé).geojson » — même règle que la route de correction. */
export function nomCorrigeDe(nom: string): string {
  const base = nom.replace(/\.(geojson|json)$/i, '')
  const ext = nom.match(/\.(geojson|json)$/i)?.[0] ?? '.geojson'
  return `${base} (corrigé)${ext}`
}

export interface Appariement {
  id: string
  name: string | null
  version: VersionFichier
  /** Attachement d'origine, si celui-ci est une version corrigée. */
  origineId: string | null
  /** Version corrigée de celui-ci, si elle existe. */
  corrigeId: string | null
  /** L'autre version du même fichier, dans un sens comme dans l'autre. */
  autreVersionId: string | null
  /** Faux si le rapprochement s'est fait par nom, la colonne étant absente. */
  colonneOrigineDisponible: boolean
}

/** Table des versions par attachement GeoJSON de l'organisation. */
export async function chargerAppariements(
  orgId: string,
  client?: SupabaseAdmin,
): Promise<Map<string, Appariement>> {
  const admin = client ?? createAdminClient()

  type LigneAtt = { id: string; name: string | null; corrige_de?: string | null }

  let colonne = true
  let lignes: LigneAtt[] = []
  const avecOrigine = await admin.from('eudr_attachments')
    .select('id, name, corrige_de').eq('org_id', orgId).eq('doc_type', 'geojson')
  // Colonne absente (migration 20260831_eudr_attachment_origine non appliquée) :
  // le rapprochement retombe sur le nom, qui suffit puisque le code le construit.
  if (avecOrigine.error && (avecOrigine.error.code === '42703'
    || /column .* does not exist/i.test(avecOrigine.error.message))) {
    colonne = false
    const sansOrigine = await admin.from('eudr_attachments')
      .select('id, name').eq('org_id', orgId).eq('doc_type', 'geojson')
    lignes = (sansOrigine.data ?? []) as unknown as LigneAtt[]
  } else {
    lignes = (avecOrigine.data ?? []) as unknown as LigneAtt[]
  }
  const parNom = new Map<string, string>()
  for (const l of lignes) if (l.name) parNom.set(l.name, String(l.id))

  const map = new Map<string, Appariement>()
  for (const l of lignes) {
    const nom = l.name ?? ''
    const corrigeDe = colonne && l.corrige_de ? String(l.corrige_de) : null
    const estCorrige = !!corrigeDe || estNomCorrige(nom)
    const origineId = estCorrige
      ? (corrigeDe ?? (nom ? parNom.get(nomOriginalDe(nom)) ?? null : null))
      : null
    map.set(String(l.id), {
      id: String(l.id),
      name: l.name ?? null,
      version: estCorrige ? 'corrigee' : 'en_etat',
      origineId,
      corrigeId: null,
      autreVersionId: origineId,
      colonneOrigineDisponible: colonne,
    })
  }

  // Sens inverse : l'original doit savoir qu'une version corrigée existe.
  for (const a of Array.from(map.values())) {
    if (a.version !== 'corrigee' || !a.origineId) continue
    const orig = map.get(a.origineId)
    if (orig && !orig.corrigeId) { orig.corrigeId = a.id; orig.autreVersionId = a.id }
  }
  for (const a of Array.from(map.values())) {
    if (a.version !== 'en_etat' || a.corrigeId || !a.name) continue
    const id = parNom.get(nomCorrigeDe(a.name))
    if (id && id !== a.id) { a.corrigeId = id; a.autreVersionId = id }
  }

  return map
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
  /** Le fichier versé était-il l'original ou sa version corrigée ? */
  version_fichier: VersionFichier
  version_libelle: string
  /** Nom du fichier initial, quand la parcelle vient d'une version corrigée. */
  version_origine_nom: string | null
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
    depuisVersionCorrigee: number
    depuisFichierEnEtat: number
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

  const [doublons, fournisseurs, atts, analyses, appariements] = await Promise.all([
    admin.from('eudr_plots_doublons').select('*').eq('org_id', orgId),
    admin.from('eudr_suppliers').select('id, company').eq('org_id', orgId).order('company'),
    admin.from('eudr_attachments').select('id, name').eq('org_id', orgId),
    admin.from('eudr_deforestation').select('attachment_id, analyzed_at, overall_risk, plots').eq('org_id', orgId),
    chargerAppariements(orgId, admin),
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

    // Version du fichier d'où sort la parcelle : deux versements du même fichier
    // ne se distinguent pas autrement, et la déclaration doit porter sur celle
    // qui est effectivement au référentiel.
    const app = appariements.get(String(p.attachment_id)) ?? null
    const version: VersionFichier = app?.version ?? 'en_etat'

    return {
      ...(p as unknown as ParcelleEnrichie),
      attachment_name: nomFichier.get(String(p.attachment_id)) ?? null,
      supplier_name: p.supplier_id ? (nomFournisseur.get(String(p.supplier_id)) ?? null) : null,
      surface_retenue_ha: surface,
      polygone_requis: requis,
      polygone_manquant: requis && !estPolygone(p.geometry_type),
      signal,
      version_fichier: version,
      version_libelle: LIBELLE_VERSION[version],
      version_origine_nom: version === 'corrigee' && app?.origineId
        ? (nomFichier.get(app.origineId) ?? null)
        : null,
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
      depuisVersionCorrigee: parcelles.filter(p => p.version_fichier === 'corrigee').length,
      depuisFichierEnEtat: parcelles.filter(p => p.version_fichier === 'en_etat').length,
    },
    parFournisseur: Object.fromEntries(
      Array.from(parFournisseur).map(([k, v]) => [k, { ...v, surfaceHa: +v.surfaceHa.toFixed(4) }]),
    ),
  }
}
