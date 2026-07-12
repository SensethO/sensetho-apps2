/**
 * Sources d'actions RSE — toutes les apps « marbre » exposent une table
 * `<slug>_actions` partageant les mêmes colonnes (titre, statut, echeance, responsable).
 * Utilisé par le récap quotidien des actions (cron rse-actions-digest).
 * @see docs/MAINTENANCE.md §7 · docs/RSE_APP_PATTERN.md §14.C
 *
 * gestion-temps (gt_actions) est volontairement exclu : ce n'est pas une app RSE.
 */
export interface RseActionSource {
  table: string
  /** Libellé lisible de l'app, affiché dans l'email de récap. */
  label: string
}

export const RSE_ACTION_SOURCES: RseActionSource[] = [
  { table: 'collecte_rse_actions', label: 'Collecte documentaire RSE' },
  { table: 'vigilance_actions',    label: 'Devoir de Vigilance' },
  { table: 'eudr_actions',         label: 'EUDR — Sans déforestation' },
  { table: 'afnor_actions',        label: 'Label Engagé RSE (AFNOR)' },
  { table: 'afaq26000_actions',    label: 'Diagnostic AFAQ 26000' },
  { table: 'ecovadis_actions',     label: 'EcoVadis' },
  { table: 'bcorp_actions',        label: 'B Corp' },
  { table: 'sapin2_actions',       label: 'Loi Sapin II' },
  { table: 'gpsr_actions',         label: 'GPSR — Sécurité produits' },
  { table: 'label_nr_actions',     label: 'Label Numérique Responsable' },
  { table: 'iso45001_actions',     label: 'ISO 45001 — Santé & Sécurité' },
  { table: 'iso50001_actions',     label: 'ISO 50001 — Énergie' },
  { table: 'act_carbone_actions',  label: 'ACT — Stratégie bas-carbone' },
  { table: 'bilan_ges_actions',    label: 'Bilan GES / Carbone' },
  { table: 'iso26000_actions',     label: 'Diagnostic RSE ISO 26000' },
  { table: 'iso53001_actions',     label: 'Diagnostic ISO 53001 — ODD' },
]
