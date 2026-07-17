// Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget) — adapté plateforme sensetho-apps2.
// Ne pas éditer sans reporter au Catalogue-App.
//
// Module « Budget » — comptabilité associative (plan comptable PCG loi 1901).
// Exercices, comptes, lignes budgétaires + détails, audit, permissions,
// pièces justificatives (SharePoint) et reports de provisions.
//
// Adaptations plateforme :
// - la « structure » d'un exercice est une ORGANISATION (table `organisations`),
//   jointe avec l'alias PostgREST `raison_sociale:denomination` pour conserver
//   la forme `{ id, raison_sociale }` attendue par l'UI ;
// - les « actions » vivent dans la table dédiée `budget_actions` (type `BudgetAction`).

export type CompteType = "charge" | "produit";
export type ExerciceStatut = "ouvert" | "cloture" | "archive";
export type AffectationType = "fonctionnement" | "action";
export type PermissionNiveau = "lecture" | "ecriture";
export type TypePiece = "facture" | "devis" | "contrat" | "autre";

/** Compte du plan comptable (hiérarchique : les comptes « groupes » ont des enfants). */
export type BudgetCompte = {
  id: string;
  numero: string;
  libelle: string;
  type: CompteType;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

/** Exercice budgétaire (annuel), rattaché optionnellement à une organisation (multi-tenant). */
export type BudgetExercice = {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  statut: ExerciceStatut;
  notes: string | null;
  /** FK vers organisations(id) — nom conservé pour compatibilité avec le module d'origine. */
  structure_id: string | null;
  /** Soft delete (corbeille admin). */
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  /** Jointure `organisations(id, raison_sociale:denomination)` renvoyée par les handlers. */
  structure?: { id: string; raison_sociale: string } | null;
};

/** Action (projet) porteuse d'un sous-budget — table plateforme `budget_actions`. */
export type BudgetAction = {
  id: string;
  organisation_id: string | null;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Ligne budgétaire : un compte × un sous-budget (fonctionnement OU action) dans un exercice.
 * `montant_previsionnel` / `montant_realise` sont recalculés depuis les détails.
 */
export type BudgetLigne = {
  id: string;
  exercice_id: string;
  compte_id: string;
  affectation_type: AffectationType;
  /** Renseigné uniquement si `affectation_type === "action"` (FK budget_actions). */
  action_id: string | null;
  montant_previsionnel: number;
  montant_realise: number;
  notes: string | null;
  /** Permet d'exclure la ligne d'un sous-budget de la vue « Budget général » consolidée. */
  contribue_budget_general: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  /** Jointures renvoyées par les handlers (`compte`, `details` triés par sort_order). */
  compte?: BudgetCompte;
  details?: BudgetLigneDetail[];
};

/** Détail (sous-ligne commentée) d'une ligne budgétaire. */
export type BudgetLigneDetail = {
  id: string;
  ligne_id: string;
  commentaire: string;
  montant_previsionnel: number;
  montant_realise: number;
  sort_order: number;
  /** Traçabilité : action_poste ayant généré ce détail (UUID libre sur la plateforme). */
  action_poste_id: string | null;
  /** Anti-doublon d'import bancaire (Qonto). */
  qonto_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Journal d'audit d'une ligne (champ modifié + motif). */
export type BudgetModification = {
  id: string;
  ligne_id: string;
  champ: string;
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  motif: string | null;
  modified_at: string;
  modified_by: string | null;
};

/**
 * Permission fine par utilisateur : niveau lecture/écriture,
 * restreignable à un exercice et/ou à un type de compte (charges ou produits).
 * NB : appliquée côté application, pas par RLS (voir docs/budget.md du Catalogue-App).
 */
export type BudgetPermission = {
  id: string;
  user_id: string;
  exercice_id: string | null;
  compte_type: CompteType | null;
  niveau: PermissionNiveau;
  created_at: string;
};

/** Pièce justificative (facture, devis…) rattachée à une ligne ou à un détail — fichier dans SharePoint. */
export type BudgetPiece = {
  id: string;
  ligne_id: string | null;
  detail_id: string | null;
  nom: string;
  /** Item ID Microsoft Graph du fichier (voir module `sharepoint`). */
  sharepoint_item_id: string | null;
  url: string | null;
  type_piece: TypePiece | null;
  montant: number | null;
  date_piece: string | null;
  created_at: string;
  created_by: string | null;
};

/** Report de provision : solde non consommé d'un sous-budget reporté vers l'exercice suivant. */
export type BudgetReport = {
  id: string;
  from_exercice_id: string;
  to_exercice_id: string | null;
  affectation_type: AffectationType;
  action_id: string | null;
  montant: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** Totaux agrégés d'une action ayant des lignes dans un exercice (GET action-subs). */
export type BudgetActionSub = {
  id: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  total_charges_prev: number;
  total_produits_prev: number;
  total_realise: number;
};

/** Ligne d'import Excel en masse (POST import-excel). */
export type BudgetImportRow = {
  compte_id: string;
  commentaire?: string;
  montant_previsionnel: number;
  montant_realise?: number;
};

/** Résultat d'un import en masse. */
export type BudgetImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};
