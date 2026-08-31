# Documentation sensetho-apps2 — index

Point d'entrée de la documentation. **Reprise sans l'auteur ?** Lire dans l'ordre : `../ONBOARDING.md` → ce fichier → `MAINTENANCE.md` → `HANDOVER.md`.
*Dernière mise à jour : 31 août 2026.*

| Document | Rôle |
|---|---|
| [../ONBOARDING.md](../ONBOARDING.md) | **Première demi-heure** : quoi lire, comment lancer, ce qu'on ne fait jamais. |
| [MAINTENANCE.md](MAINTENANCE.md) | **Livrable d'exploitation** : faire tourner, comprendre, déployer, dépanner. |
| [HANDOVER.md](HANDOVER.md) | **Reprise développeur** : organisation du code, conventions, ajouter une app. |
| [RSE_APP_PATTERN.md](RSE_APP_PATTERN.md) | Le patron « marbre » des diagnostics RSE (règles gravées). |
| [EUDR_PROCEDURE.md](EUDR_PROCEDURE.md) | Document **métier** (pas technique) : procédure de diligence raisonnée EUDR opposable, pour Trading & Services. |
| [../CLAUDE.md](../CLAUDE.md) | Règles non-négociables (lues par l'agent IA). |

## Les cinq questions d'un repreneur — où est la réponse

| Question | Réponse |
|---|---|
| Comment j'installe et je lance ? | MAINTENANCE §3 (variables, modèle de `.env.local`, installation) |
| Comment c'est architecturé ? | HANDOVER §1-2 (arborescence, trois familles d'apps) · RSE_APP_PATTERN (le marbre) |
| Comment j'applique une migration ? | MAINTENANCE §4 (procédure) · §12 (registre) · §12 bis (vérifier ce qui est appliqué) |
| Comment je déploie ? | MAINTENANCE §8 |
| Ça ne marche plus, je fais quoi ? | MAINTENANCE §9 (runbook) · §11 (incidents passés) · HANDOVER §6 et §6 bis (pièges, bugs du shell) |
| Qu'est-ce que je ne dois JAMAIS faire ? | ONBOARDING (liste) · CLAUDE.md (règles non négociables) |

---

## Carte code ↔ documentation

Chaque sous-système, son emplacement dans le code, et où il est documenté. Les fichiers-clés portent en tête un commentaire `@see docs/…` qui renvoie ici.

| Sous-système | Code (point d'entrée) | Documentation |
|---|---|---|
| **Portail & shell RSE** | `src/components/rse/RseAppShell.tsx`, `RequireSubscription.tsx` | HANDOVER §2 · **§6 bis (bugs du shell)** · CLAUDE.md |
| **Chargement du menu** | `src/hooks/useApps.ts` (`useApps(isAdmin, authReady)`) | HANDOVER §6 bis · CLAUDE.md (§ Sidebar & Menu) |
| **Patron marbre RSE** | `src/components/apps/*DiagnosticApp.tsx` | RSE_APP_PATTERN.md |
| **Accès & partage** | `src/lib/rseShares.ts` (`canAccessDiagnostic`, `canAccessOrgDossier`) | HANDOVER §3 |
| **Responsables / membres** | `src/components/rse/ResponsableSelect.tsx` + routes `/api/<slug>/[id]/members` | RSE_APP_PATTERN §14.A · HANDOVER §3 |
| **Récap actions (cron)** | `src/lib/rseActionSources.ts`, `src/app/api/cron/rse-actions-digest` | MAINTENANCE §7 · RSE_APP_PATTERN §14.C |
| **Fichiers / SharePoint** | `src/lib/sharepointMulti.ts`, `sharepointSecurity.ts` | MAINTENANCE §5 |
| **EUDR — API TRACES** | `src/lib/eudr/tracesV3.ts`, `tracesClient.ts`, `crypto.ts` | MAINTENANCE §6 |
| **EUDR — analyse COA (IA)** | `src/lib/eudr/coaAnalyze.ts`, `coaConformity.ts` | MAINTENANCE §6 · HANDOVER §12 |
| **App métier EUDR** | `src/components/apps/EudrFournisseursApp.tsx`, `/api/eudr-fournisseurs/*` | HANDOVER §2 (org-keyed) |
| **Stratégie Partagée** | `src/components/apps/StrategiePartageeApp.tsx`, `/api/strategie-partagee/*` | HANDOVER §2 |
| **Apps Budget (asso & entreprise)** | `src/lib/budget-association/`, `src/lib/budget-entreprise/`, `Budget…App.tsx` | HANDOVER §7-8 |
| **Import bancaire Qonto** | `src/components/apps/QontoImportModal.tsx`, `src/lib/qonto/`, `/api/qonto/*` | HANDOVER §8 · MAINTENANCE §6 |
| **Veille Sindup** | `src/lib/sindup/`, `VeilleSindupApp.tsx`, `/api/cron/sindup-collect` | HANDOVER §9 · MAINTENANCE §6-7 |
| **Plan Stratégique (slug `projet-rse`)** | `src/components/apps/ProjetRseApp.tsx`, `src/lib/projet-rse/`, `projetRseModules.tsx` | HANDOVER §10 · CLAUDE.md (§ Plan Stratégique) |
| **Pages publiques** | `src/middleware.ts` (`PUBLIC_ROUTES`), `src/app/hebergement-responsable`, `engagements-rse` | HANDOVER §11 · MAINTENANCE §9 bis-ter |
| **Garde-fous consommation** | `src/middleware.ts` (rate-limit), `scripts/check-polling.mjs`, `src/hooks/usePolling.ts` | MAINTENANCE §11 |
| **Catalogue & abonnements** | tables `apps`, `app_categories`, `app_subscriptions` ; admin `src/app/admin/*` | MAINTENANCE §4 |
| **Schéma base de données** | `supabase/migrations/*.sql` | MAINTENANCE §4 · **registre des migrations : §12** · **vérifier l'état réel : §12 bis** |
| **Déploiement & crons** | `vercel.json` | MAINTENANCE §7-8 |

## Cartographie visuelle
Une page interactive (inventaire des 41 apps par catégorie + audit de conformité au marbre) est publiée comme Artifact — demander le lien à l'exploitant. Générée depuis le catalogue en base et `RSE_APP_PATTERN.md`.
