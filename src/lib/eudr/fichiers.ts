import { createAdminClient } from '@/lib/supabase/admin'

/**
 * fichiers.ts — Nommage versionné et journal des fichiers EUDR.
 *
 * Règle posée le 2026-09-01 : les fichiers EUDR sont IMMUABLES.
 *   — tout dépôt crée une version nouvelle, jamais un remplacement ;
 *   — aucune route n'offre de suppression physique ni de renommage ;
 *   — chaque mouvement est journalisé (`eudr_fichiers_journal`), append-only.
 *
 * Pourquoi : l'article 33 du règlement (UE) 2023/1115 impose de conserver cinq ans
 * la documentation de diligence raisonnée. Une déclaration déposée doit rester
 * rattachable au fichier exact qui l'a alimentée. Un fichier écrasé, renommé ou
 * supprimé rompt cette chaîne — et l'écart ne se voit qu'au contrôle, trop tard.
 *
 * Le nom porte la version parce qu'un dossier d'audit se lit à l'œil : un
 * identifiant technique ne dit rien à un inspecteur, « X__v003.geojson » si.
 */

/** Numéro de version sur trois chiffres : « __v003 ». Tient jusqu'à v999. */
const MOTIF_VERSION = /__v(\d{3,})$/

/** Caractères refusés par SharePoint, plus ceux qui rendent un nom ambigu à l'œil. */
function assainir(nom: string): string {
  return nom.replace(/[/\:*?"<>|#%]/g, '_').replace(/\s+/g, ' ').trim()
}

export function separerExtension(nom: string): { base: string; ext: string } {
  const i = nom.lastIndexOf('.')
  if (i <= 0) return { base: nom, ext: '' }
  return { base: nom.slice(0, i), ext: nom.slice(i) }
}

/**
 * Nom de base d'un document, débarrassé de tout suffixe déjà posé.
 *
 * Absorbe volontairement l'ancien suffixe « (corrigé) » : avant le versionnage,
 * une correction produisait « X (corrigé).geojson ». Ces fichiers et leurs
 * successeurs doivent partager la même base, sans quoi la version corrigée d'un
 * fichier ancien repartirait à v001 dans une lignée parallèle.
 */
export function baseDe(nom: string): string {
  const { base } = separerExtension(assainir(nom))
  return base.replace(MOTIF_VERSION, '').replace(/\s*\(corrigé\)\s*$/i, '').trim()
}

/** Numéro porté par un nom, ou null s'il n'en porte pas (fichier antérieur au versionnage). */
export function versionDe(nom: string): number | null {
  const { base } = separerExtension(nom)
  const m = base.match(MOTIF_VERSION)
  return m ? parseInt(m[1], 10) : null
}

export function composerNom(base: string, version: number, ext: string): string {
  return `${base}__v${String(version).padStart(3, '0')}${ext}`
}

/**
 * Attribue le prochain numéro de version pour un document d'une entité donnée.
 *
 * Le maximum est cherché sur `version_num`, et à défaut sur le nom — indispensable
 * pour les fichiers déposés avant cette migration, qui n'ont pas de `version_num`
 * mais peuvent déjà porter un suffixe. Un fichier ancien sans suffixe compte pour
 * la version 1 : la première version versionnée qui le suit sera donc v002, et
 * l'ordre chronologique reste vrai.
 */
export async function prochaineVersion(
  orgId: string, entityType: string, entityId: string, base: string,
): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.from('eudr_attachments')
    .select('name, version_num, base_name')
    .eq('org_id', orgId).eq('entity_type', entityType).eq('entity_id', entityId)
  const versions = (data ?? [])
    .filter(r => (r.base_name as string | null) === base || baseDe((r.name as string) ?? '') === base)
    .map(r => (r.version_num as number | null) ?? versionDe((r.name as string) ?? '') ?? 1)
  return versions.length ? Math.max(...versions) + 1 : 1
}

// ── Journal ──────────────────────────────────────────────────────────────────

export type EvenementFichier =
  | 'depot' | 'versement' | 'retrait_referentiel' | 'depot_dds'
  | 'retrait_logique' | 'renommage_technique' | 'suppression_refusee'

/**
 * Consigne un mouvement de fichier. N'échoue JAMAIS l'action appelante : un
 * journal indisponible ne doit pas empêcher un dépôt réglementaire d'aboutir.
 * L'inverse — un dépôt qui aboutit sans trace — reste préférable à un dépôt
 * bloqué, et la trace manquante se voit au rapprochement.
 */
export async function journaliser(entree: {
  orgId: string
  attachmentId?: string | null
  nom?: string | null
  versionNum?: number | null
  evenement: EvenementFichier
  detail?: Record<string, unknown> | null
  sha256?: string | null
  acteur?: string | null
}): Promise<void> {
  try {
    await createAdminClient().from('eudr_fichiers_journal').insert({
      org_id: entree.orgId,
      attachment_id: entree.attachmentId ?? null,
      nom: entree.nom ?? null,
      version_num: entree.versionNum ?? null,
      evenement: entree.evenement,
      detail: entree.detail ?? null,
      sha256: entree.sha256 ?? null,
      acteur: entree.acteur ?? null,
    })
  } catch { /* journal indisponible : voir le commentaire ci-dessus */ }
}
