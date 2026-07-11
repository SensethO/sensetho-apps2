# Guide de reprise développeur — sensetho-apps2

> **But** : permettre à un·e développeur·se de reprendre et faire évoluer le code sans l'auteur d'origine.
> Prérequis : avoir lu [MAINTENANCE.md](MAINTENANCE.md) (faire tourner + déployer).

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
    pdf/                       ← génération PDF (strategiePdf, exportReport)
  hooks/                       ← useApps, useRseYears, useFavorites, useAuth, useOrganisations
supabase/migrations/           ← schéma SQL (trace de référence — cf. MAINTENANCE §4)
docs/                          ← cette documentation
```

**Convention de nommage** : `slug` de l'app = préfixe des tables (`<slug>_*`), base des routes API (`/api/<slug>`), et dossier du composant. ⚠️ Quelques apps historiques ont un **slug de catalogue ≠ slug de code** : `diagnostic-initial → guided-diagnostic`, `iso26000 → iso26000-diagnostic`, `ecovadis-diagnostic → ecovadis`.

## 2. Trois familles d'applications

| Famille | Shell | Clé | Exemple |
|---|---|---|---|
| **RSE « marbre »** (diagnostics) | `RseAppShell` (avec année) | org + année | vigilance, eudr, ecovadis, iso26000… |
| **RSE spécialisées** (structure propre) | `RseAppShell` | variable | parties-prenantes, le-miroir, gestion-temps… |
| **Business / Métier** (document vivant) | `RseAppShell requireYear={false}` | **org** (`diagnostic_id = org_id`) | eudr-fournisseurs, strategie-partagee |

Le patron **marbre** (obligatoire pour les diagnostics RSE) est décrit dans **[RSE_APP_PATTERN.md](RSE_APP_PATTERN.md)** : 5 axes × 4 critères, 5 onglets, tables `<slug>_*`, export Excel 6 onglets, radar, GuidedActionNotePanel, ResponsableSelect, registre d'actions.

## 3. Authentification & accès (à respecter dans chaque route API)

- **Client utilisateur** : `createRouteClient()` (`@/lib/supabase/server`) → lit la session, RLS active.
- **Client admin** : `createAdminClient()` (`@/lib/supabase/admin`) → **service role**, bypass RLS. Utilisé pour les données une fois l'accès vérifié.
- **Vérification d'accès** :
  - Apps RSE marbre : `canAccessDiagnostic(appSlug, table, userId, diagnosticId, { requireEdit })` (`@/lib/rseShares`).
  - Apps org-keyed : `canAccessOrgDossier(appSlug, userId, orgId, { requireEdit })`.
  - Cas spécifiques (tables de partage dédiées, rôles) : garde locale — ex. `eudr-fournisseurs/coa/_access.ts`, ou la route `iso26000-diagnostic/[id]/members`.
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

## 7. Vérifier une modification
Le projet n'a pas de suite de tests. Vérifier ainsi :
1. `npm run build` (doit compiler).
2. Déployer et tester l'endpoint : sans session → `401` (routes protégées), page protégée → `307` vers login.
3. Test fonctionnel connecté sur `apps.sensetho.com` (l'admin bypass l'abonnement).
Pour la logique pure (ex. `coaConformity.ts`), un petit script Node (Node 24 exécute le TS) suffit à valider les cas.
