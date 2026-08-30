# Guide de reprise développeur — sensetho-apps2

> **But** : permettre à un développeur de reprendre et faire évoluer le code sans l'auteur d'origine.
> Prérequis : avoir lu [MAINTENANCE.md](MAINTENANCE.md) (faire tourner + déployer).
> *Dernière mise à jour : 30 août 2026.*

---

## 1. Organisation du code

```
src/
  app/                         ← routes Next.js (App Router)
    (auth)/, auth/             ← connexion
    dashboard/                 ← accueil (favoris)
    admin/                     ← catégorie Administration (catégories, users, abonnements…)
    rse/<slug>/page.tsx        ← une page par application RSE
    business/<slug>/page.tsx   ← une page par application Business/Métier
    api/<slug>/…/route.ts      ← endpoints API (un dossier par app + endpoints transverses)
    api/cron/…                 ← tâches planifiées
  components/
    rse/                       ← briques RSE partagées :
      RseAppShell.tsx          ←   shell OBLIGATOIRE des apps RSE (org + année + header)
      RequireSubscription.tsx  ←   garde d'abonnement
      ResponsableSelect.tsx    ←   sélecteur de responsable (membres) — pattern marbre §14.A
      ViewTabs.tsx             ←   barre d'onglets
    apps/                      ← UN composant par application : <Nom>DiagnosticApp.tsx / <Nom>App.tsx
      GuidedActionNotePanel.tsx←   éditeur de notes + pièces jointes (réutilisé par les apps RSE)
      QontoImportModal.tsx     ←   modale d'import bancaire Qonto partagée par les 2 apps budget (§8)
    layout/                    ← AppShell, Sidebar (pages non-RSE)
    ui/                        ← Icon.tsx (source unique des icônes), primitives
  lib/
    supabase/                  ← createRouteClient (auth) & createAdminClient (service role)
    sharepointMulti.ts         ← accès Graph/SharePoint par app (spGraphForApp)
    sharepointSecurity.ts      ← validation des IDs Graph
    rseShares.ts               ← partage & accès (canAccessDiagnostic, canAccessOrgDossier, membres)
    rseActionSources.ts        ← registre des tables <slug>_actions (récap quotidien)
    eudr/                      ← intégration EUDR : tracesV3 (SOAP), crypto (clés chiffrées),
                                  coaAnalyze (IA), coaConformity (moteur déterministe), countries
    budget-association/        ← module Budget association vendorisé du Catalogue-App (§8)
    budget-entreprise/         ← variante entreprise (plan comptable général, bilan) (§8)
    qonto/                     ← intégration Qonto : client, connexions chiffrées, crypto (§8)
    sindup/                    ← veille Sindup : parseur RSS maison, collecte, auth (§9)
    projet-rse/                ← Plan Stratégique : crud (routesDeProjet), auth, acteurs, succession (§10)
    projetRseModules.tsx       ← registre des sous-applications du Plan Stratégique (§10)
    pdf/                       ← génération PDF (strategiePdf, exportReport)
  hooks/                       ← useApps, useRseYears, useFavorites, useAuth, useOrganisations, usePolling
  middleware.ts                ← PUBLIC_ROUTES (pages sans compte) + coupe-circuit rate-limit (MAINTENANCE §11)
scripts/check-polling.mjs      ← garde anti-surconsommation, exécutée en prebuild (MAINTENANCE §11)
supabase/migrations/           ← schéma SQL (trace de référence — cf. MAINTENANCE §4)
docs/                          ← cette documentation
```

**Convention de nommage** : `slug` de l'app = préfixe des tables (`<slug>_*`), base des routes API (`/api/<slug>`), et dossier du composant. ⚠️ Exceptions historiques :
- `diagnostic-initial` (catalogue/page) ↔ `guided-diagnostic` (API + composants) — **alias assumé**, ne pas renommer (clés SharePoint et composants partagés en dépendent).
- Les **appKeys SharePoint** (`getConfigForApp`/`spGraphForApp`) sont des clés de configuration indexant `sp_app_routes` en base — elles peuvent différer du slug (ex. `'ecovadis-diagnostic'`, `'iso26000-diagnostic'`) et **ne doivent jamais être renommées** sans migrer la config SharePoint.

## 2. Trois familles d'applications

| Famille | Shell | Clé | Exemple |
|---|---|---|---|
| **RSE « marbre »** (diagnostics) | `RseAppShell` (avec année) | org + année | vigilance, eudr, ecovadis, iso26000… |
| **RSE spécialisées** (structure propre) | `RseAppShell` | variable | parties-prenantes, le-miroir, gestion-temps… |
| **Business / Métier** (document vivant) | `RseAppShell requireYear={false}` | **org** (`diagnostic_id = org_id`) | eudr-fournisseurs, strategie-partagee, budget-association, budget-entreprise, veille-sindup, projet-rse |

Le patron **marbre** (obligatoire pour les diagnostics RSE) est décrit dans **[RSE_APP_PATTERN.md](RSE_APP_PATTERN.md)** : 5 axes × 4 critères, 5 onglets, tables `<slug>_*`, export Excel 6 onglets, radar, GuidedActionNotePanel, ResponsableSelect, registre d'actions.

## 3. Authentification & accès (à respecter dans chaque route API)

- **Client utilisateur** : `createRouteClient()` (`@/lib/supabase/server`) → lit la session, RLS active.
- **Client admin** : `createAdminClient()` (`@/lib/supabase/admin`) → **service role**, bypass RLS. Utilisé pour les données une fois l'accès vérifié.
- **Vérification d'accès** :
  - Apps RSE marbre : `canAccessDiagnostic(appSlug, table, userId, diagnosticId, { requireEdit })` (`@/lib/rseShares`).
  - Apps org-keyed : `canAccessOrgDossier(appSlug, userId, orgId, { requireEdit })`.
  - Cas spécifiques (tables de partage dédiées, rôles) : garde locale — ex. `eudr-fournisseurs/coa/_access.ts`, ou la route `iso26000/[id]/members`.
- **Membres / responsables** : chaque app expose `GET /api/<slug>/[id]/members` (propriétaire + partagés) consommée par `ResponsableSelect` (§14.A du marbre — protéger en **lecture**, pas `canManage`).

## 4. Ajouter une application

### RSE (diagnostic marbre)
1. Suivre **RSE_APP_PATTERN.md** de bout en bout (c'est un mode d'emploi).
2. Migration : tables `<slug>_diagnostics/_reponses/_actions/_notes` + RLS + fonction compteur d'annexes.
3. Routes `/api/<slug>/…` (voir un exemple conforme récent : `collecte-rse`).
4. Page `/rse/<slug>/page.tsx` (RequireSubscription → RseAppShell → composant).
5. Composant `src/components/apps/<Nom>DiagnosticApp.tsx` (5 onglets).
6. Déclarer la table `<slug>_actions` dans `rseActionSources.ts`.
7. Insérer la ligne catalogue dans `apps` (+ éventuel abonnement).

### Business / Métier (org-keyed)
Modèle : **`eudr-fournisseurs`** ou **`strategie-partagee`**. Page `RseAppShell requireYear={false}`, données scopées `org_id`, partage via `rse_diagnostic_shares` (`diagnostic_id = org_id`) — ajouter le slug à `ORG_KEYED` dans `src/app/api/rse/shared/route.ts` pour l'affichage sidebar du destinataire.

## 5. Conventions & style
- TypeScript strict. Style Tailwind + variables CSS (`--bg`, `--bg-card`, `--text`, `--text-muted`, `--accent`, `--border`) — thème clair/sombre géré globalement.
- `/* eslint-disable @typescript-eslint/no-explicit-any */` en tête si `as any` nécessaire.
- Icônes : `src/components/ui/Icon.tsx` (source unique) — pas d'emoji arbitraire dans les composants « chrome ».
- Toujours `RLS` à la création d'une table ; toujours re-vérifier l'accès côté route (service role).

## 6. Pièges connus
- **Cache `.next` sur OneDrive** : le build peut échouer avec `EINVAL readlink` → `rm -rf .next` puis rebuild. (Le dépôt vit dans un dossier OneDrive synchronisé.)
- **Contraintes CHECK** : `eudr_attachments.doc_type` / `entity_type` sont des listes fermées — étendre par migration avant d'introduire une nouvelle valeur.
- **EUDR** : V1/V2 SOAP désactivées côté Commission → utiliser **V3** (`tracesV3.ts`). Le username Web Service = identifiant EU Login (pas l'email).
- **RequireSubscription** ne reçoit **jamais** de render prop (page blanche) — la render prop va dans `RseAppShell`.
- **Fichiers** : jamais via Vercel/Supabase — toujours SharePoint (cf. MAINTENANCE §5).

## 7. Modules vendorisés du Catalogue-App

Certains modules sont **copiés** (vendorisés) depuis le dépôt privé `@sensetho/catalogue-app` puis adaptés à la plateforme. Chaque fichier vendorisé porte en tête sa provenance (`Vendorisé depuis @sensetho/catalogue-app vX.Y.Z (src/…)`).

**Règle** : toute évolution d'un module vendorisé doit être **reportée au Catalogue-App** (qui reste la source de vérité du module générique), et inversement. La version du paquet est bumpée **automatiquement par la CI** du Catalogue-App — ne jamais la bumper à la main (cf. MAINTENANCE §11).

Modules concernés : `src/lib/budget-association/`, `src/lib/budget-entreprise/` (module `src/budget` du Catalogue-App) et `src/components/apps/QontoImportModal.tsx` (module `src/qonto`).

## 8. Apps Budget (association & entreprise) + Qonto

Deux apps Business issues du **module budget du Catalogue-App** (vendorisé, cf. §7) : `budget-association` (v0.5.10) et sa dérivée `budget-entreprise`. Chacune : page `/business/<slug>`, composant `Budget…App.tsx`, handlers serveur dans `src/lib/budget-<variante>/handlers.ts`, schéma SQL de référence dans `schema.ts` (copie appliquée : migrations `20260713_budget_association.sql` / `20260714_budget_entreprise.sql` — garder les deux synchronisés).

| | Budget **association** | Budget **entreprise** |
|---|---|---|
| Tables | `budget_*` | `budget_ent_*` |
| Plan comptable | associatif (loi 1901), comptes `charge` / `produit` | **général** (classes 1 à 7), comptes `charge` / `produit` / `actif` / `passif` |
| Axe analytique | **actions** (`budget_actions`) | **centres de coût** (`budget_ent_centres_cout`) |
| Restitution | compte de résultat | compte de résultat **+ bilan** |

Adaptations plateforme communes (détaillées en tête de chaque `handlers.ts`) : la « structure » d'un exercice est une **organisation** (alias PostgREST `raison_sociale:denomination`), rôle admin lu dans `profiles.role`, fonction SQL `budget_is_admin()` partagée, RLS multi-tenant (propriétaire d'organisation ou admin).

Fonctionnalités ajoutées côté plateforme :
- **Import Excel 6 colonnes** (masque d'import des lignes budgétaires) + dépôt des **factures clients / fournisseurs vers SharePoint** (types de pièce `facture_client` / `facture_fournisseur`) — commit `952b9f5`.
- **Panneau pièces justificatives** par ligne (flux SharePoint standard, MAINTENANCE §5).
- **Date de valeur** (`date_valeur`, date comptable de l'écriture) sur les lignes de détail — migration `20260717_budget_pieces_dates.sql`.
- **Import bancaire Qonto** : composant unique `src/components/apps/QontoImportModal.tsx` partagé par les deux apps (props `apiBase` + `plan`). Connexion par organisation, multi-comptes, chargement paginé complet (100 transactions/page côté Qonto), **ventilation automatique par IA** puis import par cible commune ou par transaction (409 = déjà importée). Règle comptable portée par la modale : un compte de **bilan** (actif/passif) va toujours au sous-budget « général ». Côté serveur : routes `/api/qonto/*` et chiffrement — voir MAINTENANCE §6.

## 9. Veille Sindup

App Business `veille-sindup` (`VeilleSindupApp.tsx`, org-keyed) : suivi de sources de veille et de leurs mentions. Architecture **double connecteur** (`src/lib/sindup/`) :

- **RSS — opérationnel** : `rss.ts`, parseur RSS 2.0/Atom fait main (regex tolérantes, aucune dépendance XML ajoutée au projet) ; `collect.ts` fait le fetch + upsert anti-doublon des mentions et tient le statut de la source (`last_fetch_at/status/error`).
- **API Sindup — préparée, en attente** : la table `sindup_connections` et `auth.ts`/`crypto.ts` existent, mais le connecteur ne sera branché qu'à réception de la **documentation client Sindup** (`collect.ts` refuse `type = 'api'` en attendant).

Collecte : bouton dans l'UI (`POST /api/veille-sindup/collect`) et **cron 3×/jour ouvré** `/api/cron/sindup-collect` protégé par `CRON_SECRET` (MAINTENANCE §7). Tables `sindup_sources` / `sindup_mentions` / `sindup_connections` (migration `20260807_sindup_tables.sql`).

## 10. Plan Stratégique (ex « Projet RSE », slug `projet-rse`)

App Business de gestion de projet selon la méthode du cours (PRiSM). **Renommée « Plan Stratégique » le 2026-08-30** — le nom change au catalogue (migration `20260830_rename_plan_strategique.sql`, cf. MAINTENANCE §12), mais le **slug, la route `/business/projet-rse`, les tables `projet_rse_*` et les préfixes de code restent `projet-rse`** (aucune rupture de liens ni d'abonnements — même logique que l'alias `diagnostic-initial`/`guided-diagnostic` du §1).

La documentation détaillée vit dans **`CLAUDE.md` (section « Projet RSE »)** : les **six sous-applications** (cadrage & business case durable, parties prenantes, analyse d'impact P5, plan de management de la durabilité, WBS/RACI/risques/jalons, théorie du changement & SROI), la règle du **registre** `src/lib/projetRseModules.tsx` (un onglet par module, une sous-app s'ajoute sans toucher au cœur `ProjetRseApp.tsx`), la règle « toute personne pointe vers `projet_rse_acteurs` » (succession suivie partout), la fabrique de routes `routesDeProjet()`/`ficheDeProjet()` (`src/lib/projet-rse/crud.ts`) et le piège des query strings sur routes dynamiques (`lireIdentifiant()`).

## 11. Pages publiques

Toute page accessible sans compte doit être déclarée dans `PUBLIC_ROUTES` (`src/middleware.ts`). Pages éditoriales : `/hebergement-responsable` (indicateurs **mesurés** — entretien : MAINTENANCE §9 bis), `/engagements-rse`, `/politique-de-confidentialite` (date de révision **manuelle** — MAINTENANCE §9 ter). Règle éditoriale commune : jamais de chiffre sans méthode, jamais une déclaration de fournisseur présentée comme une mesure.

## 12. Vérifier une modification
Le projet n'a pas de suite de tests. Vérifier ainsi :
1. `npm run build` (doit compiler).
2. Déployer et tester l'endpoint : sans session → `401` (routes protégées), page protégée → `307` vers login.
3. Test fonctionnel connecté sur `apps.sensetho.com` (l'admin bypass l'abonnement).
Pour la logique pure (ex. `coaConformity.ts`), un petit script Node (Node 24 exécute le TS) suffit à valider les cas.
