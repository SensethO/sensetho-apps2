# Documentation sensetho-apps2 — index

Point d'entrée de la documentation. **Reprise sans l'auteur ?** Lire dans l'ordre : ce fichier → `MAINTENANCE.md` → `HANDOVER.md`.

| Document | Rôle |
|---|---|
| [MAINTENANCE.md](MAINTENANCE.md) | **Livrable d'exploitation** : faire tourner, comprendre, déployer, dépanner. |
| [HANDOVER.md](HANDOVER.md) | **Reprise développeur** : organisation du code, conventions, ajouter une app. |
| [RSE_APP_PATTERN.md](RSE_APP_PATTERN.md) | Le patron « marbre » des diagnostics RSE (règles gravées). |
| [../CLAUDE.md](../CLAUDE.md) | Règles non-négociables (lues par l'agent IA). |

---

## Carte code ↔ documentation

Chaque sous-système, son emplacement dans le code, et où il est documenté. Les fichiers-clés portent en tête un commentaire `@see docs/…` qui renvoie ici.

| Sous-système | Code (point d'entrée) | Documentation |
|---|---|---|
| **Portail & shell RSE** | `src/components/rse/RseAppShell.tsx`, `RequireSubscription.tsx` | HANDOVER §2 · CLAUDE.md |
| **Patron marbre RSE** | `src/components/apps/*DiagnosticApp.tsx` | RSE_APP_PATTERN.md |
| **Accès & partage** | `src/lib/rseShares.ts` (`canAccessDiagnostic`, `canAccessOrgDossier`) | HANDOVER §3 |
| **Responsables / membres** | `src/components/rse/ResponsableSelect.tsx` + routes `/api/<slug>/[id]/members` | RSE_APP_PATTERN §14.A · HANDOVER §3 |
| **Récap actions (cron)** | `src/lib/rseActionSources.ts`, `src/app/api/cron/rse-actions-digest` | MAINTENANCE §7 · RSE_APP_PATTERN §14.C |
| **Fichiers / SharePoint** | `src/lib/sharepointMulti.ts`, `sharepointSecurity.ts` | MAINTENANCE §5 |
| **EUDR — API TRACES** | `src/lib/eudr/tracesV3.ts`, `tracesClient.ts`, `crypto.ts` | MAINTENANCE §6 |
| **EUDR — analyse COA (IA)** | `src/lib/eudr/coaAnalyze.ts`, `coaConformity.ts` | MAINTENANCE §6 · HANDOVER §7 |
| **App métier EUDR** | `src/components/apps/EudrFournisseursApp.tsx`, `/api/eudr-fournisseurs/*` | HANDOVER §2 (org-keyed) |
| **Stratégie Partagée** | `src/components/apps/StrategiePartageeApp.tsx`, `/api/strategie-partagee/*` | HANDOVER §2 |
| **Catalogue & abonnements** | tables `apps`, `app_categories`, `app_subscriptions` ; admin `src/app/admin/*` | MAINTENANCE §4 |
| **Schéma base de données** | `supabase/migrations/*.sql` | MAINTENANCE §4 |
| **Déploiement & crons** | `vercel.json` | MAINTENANCE §7-8 |

## Cartographie visuelle
Une page interactive (inventaire des 41 apps par catégorie + audit de conformité au marbre) est publiée comme Artifact — demander le lien à l'exploitant. Générée depuis le catalogue en base et `RSE_APP_PATTERN.md`.
