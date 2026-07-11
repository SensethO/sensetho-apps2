# Livrable d'exploitation — sensetho-apps2

> **But** : permettre à un exploitant/mainteneur de faire tourner, comprendre, déployer et dépanner la plateforme **sans l'auteur d'origine**.
> Voir aussi [HANDOVER.md](HANDOVER.md) (reprise du code) et [README de la doc](README.md) (carte code ↔ doc).

---

## 1. Vue d'ensemble

Portail web multi-tenant. Un utilisateur se connecte (Supabase Auth), sélectionne une **organisation** (client), et accède à des **applications** rangées par catégorie (RSE, Business, Applications métiers, Collaboration, Administration). L'accès à chaque app est conditionné par un **abonnement** (`app_subscriptions`) ou le rôle **admin**.

- **Framework** : Next.js 14 (App Router, TypeScript strict).
- **Auth + base de données** : Supabase (PostgreSQL + Auth SSR).
- **Fichiers** : **SharePoint uniquement** (via Microsoft Graph). Aucun fichier n'est stocké sur Vercel ou Supabase Storage — règle absolue.
- **IA** : API Anthropic (Claude) pour l'analyse des COA (app EUDR fournisseurs).
- **Hébergement** : Vercel (build à chaque push sur `master`).

## 2. Comptes & ressources externes

| Ressource | Identifiant | Accès |
|---|---|---|
| Dépôt Git | `github.com/SensethO/sensetho-apps2` (branche `master`) | GitHub |
| Hébergement | Vercel — projet `sensetho-apps2` | Console Vercel |
| Domaine | `apps.sensetho.com` | Vercel / DNS OVHcloud |
| Base de données | Supabase — projet **`ketnixnfrbpdpduypfbv`** | Console Supabase |
| Fichiers | SharePoint (tenant Microsoft 365 SCDB PRO) via Graph API | Azure AD app registration |
| IA | Anthropic API | console.anthropic.com |
| Admin plateforme | `sylvain.cassaro@sensetho.com` (rôle `admin` dans `profiles`) | — |

## 3. Variables d'environnement

À définir dans **Vercel → Settings → Environment Variables** (production) et en local dans `.env.local`. **Ne jamais committer les valeurs.**

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase (public, RLS active) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (serveur uniquement — bypass RLS dans les routes API) |
| `DATABASE_URL` | Connexion Postgres directe (usages ponctuels) |
| `MS_TENANT_ID` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET` | App Azure AD pour Microsoft Graph (SharePoint) |
| `SHAREPOINT_DRIVE_ID` | Drive SharePoint par défaut |
| `SHAREPOINT_BASE_FOLDER_ID` / `SHAREPOINT_BASE_FOLDER_NAME` | Dossier racine autorisé |
| `EUDR_CRED_SECRET` | Secret de chiffrement AES-256-GCM des clés Web Service EUDR TRACES (par organisation) |
| `ANTHROPIC_API_KEY` | Clé API Claude (analyse COA) |
| `CRON_SECRET` | Protège les endpoints cron (`Authorization: Bearer …`) |
| `ALPHA_VANTAGE_API_KEY` | Données météo (app AgriTracker) |

## 4. Base de données (Supabase)

### Tables « framework » (transverses)
- `profiles` — utilisateurs (dont `role = 'admin'`).
- `organisations` — clients (colonnes clés : `denomination`, `siret_siege`, `ville`, `user_id` = propriétaire). **RLS : privées au propriétaire.**
- `app_categories` — catégories du catalogue.
- `apps` — catalogue des applications (slug, route, `category_id`, `pricing_type`, `is_active`…).
- `app_subscriptions` — abonnements par utilisateur/app (contrôle d'accès).
- `rse_diagnostic_shares` — partages génériques (`app_slug`, `diagnostic_id`, `shared_with_user_id`, `permission read|edit`). Support du partage pour les apps RSE **et** les apps org-keyed (où `diagnostic_id = org_id`).
- `sp_configs`, `sp_app_routes` — configuration SharePoint multi-tenant.

### Tables par application
Chaque app a ses tables préfixées `<slug>_*` (ex. `vigilance_diagnostics`, `eudr_buyers`, `iso26000_actions`, `strategie_partagee`…). Le patron RSE impose `<slug>_diagnostics / _reponses / _actions / _notes` (voir [RSE_APP_PATTERN.md](RSE_APP_PATTERN.md)).

### Migrations
Les fichiers **`supabase/migrations/*.sql`** sont la trace de référence du schéma. **Elles ne sont pas jouées automatiquement** : elles sont appliquées via l'**API de gestion Supabase** (endpoint `POST /v1/projects/ketnixnfrbpdpduypfbv/database/query`) avec un **PAT Supabase** (jeton personnel, gardé hors dépôt). Pour appliquer une migration :

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/ketnixnfrbpdpduypfbv/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" -H "Content-Type: application/json" \
  --data-binary '{"query": "<contenu SQL>"}'
```

> ⚠️ **Toujours** committer le `.sql` dans `supabase/migrations/` en même temps qu'on l'applique, pour garder le dépôt fidèle au schéma réel.

## 5. Fichiers — flux SharePoint (jamais Vercel/Supabase)

Pattern universel :
1. Le navigateur demande une **upload session** à une route serveur (`.../upload-session`) qui la crée via Graph.
2. Le navigateur **envoie le fichier directement à SharePoint** (PUT sur l'`uploadUrl`) — aucun octet ne transite par le serveur.
3. Une route `.../upload-confirm` enregistre les **métadonnées** en base (jamais le contenu).
4. Téléchargement : le serveur renvoie une **URL signée Graph**, le navigateur télécharge directement.

Helper central : `src/lib/sharepointMulti.ts` (`spGraphForApp`, `getConfigForApp`). Sécurité des IDs : `src/lib/sharepointSecurity.ts`.

## 6. Intégrations externes

- **Microsoft Graph / SharePoint** — stockage fichiers (cf. §5). Auth client_credentials (app Azure AD).
- **EUDR TRACES (Commission européenne)** — API **SOAP V3** du registre EUDR (dépôt/vérification de DDS). Client fait main : `src/lib/eudr/tracesV3.ts`. Identifiants Web Service chiffrés par organisation (`eudr_traces_credentials`, secret `EUDR_CRED_SECRET`). Environnements : acceptation (`eudr-test`) / production (`eudr-repository`). Détails : [memory du projet] + commentaires du code.
- **Anthropic (Claude)** — analyse des COA (`src/lib/eudr/coaAnalyze.ts`, modèle `claude-opus-4-8`, vision). Le fichier COA est lu depuis SharePoint et **transmis à l'API le temps de l'analyse** (rien stocké ailleurs).
- **Alpha Vantage** — météo pour AgriTracker.

## 7. Tâches planifiées (Vercel Cron — `vercel.json`)

| Endpoint | Fréquence | Rôle |
|---|---|---|
| `/api/agri/weather/sync` | tous les jours 6h UTC | Synchronisation météo AgriTracker |
| `/api/cron/rse-actions-digest` | lun→ven 7h & 8h UTC | Récap quotidien des actions RSE par responsable (envoi ~9h Europe/Paris via gate interne). Protégé par `CRON_SECRET`. Sources : `src/lib/rseActionSources.ts`. |

## 8. Déploiement

1. `git push origin master` → Vercel build automatiquement (~1–2 min).
2. Vérifier le build dans la console Vercel (ou `gh run list` si Actions).
3. Pour un changement de schéma : appliquer la migration Supabase (cf. §4) **avant ou avec** le déploiement du code qui en dépend.
4. Nouvelles variables d'env : les ajouter dans Vercel **avant** le déploiement qui les utilise.

## 9. Runbook — incidents fréquents

| Symptôme | Cause probable | Action |
|---|---|---|
| Build échoue `EINVAL readlink .next/…` | Cache `.next` corrompu (dossier sur OneDrive) | `rm -rf .next` puis rebuild |
| `violates check constraint "…_check"` à l'insert | Valeur hors liste autorisée d'une contrainte CHECK | Étendre la contrainte via migration (ex. `eudr_attachments` doc_type/entity_type) |
| Page blanche sur une app RSE | Render prop passée à `RequireSubscription` au lieu de `RseAppShell` | Voir RSE_APP_PATTERN §4 |
| Upload fichier échoue | Config SharePoint (`sp_configs`) manquante pour l'app, ou secret Azure expiré | Vérifier `sp_app_routes`/`sp_configs` + `MS_CLIENT_SECRET` |
| Dépôt DDS EUDR rejeté « use V3 » | V1/V2 désactivées côté Commission | Déjà géré : client V3 (`tracesV3.ts`) |
| Analyse COA en erreur | `ANTHROPIC_API_KEY` absente/invalide en prod | Vérifier la variable Vercel |
| Cron n'envoie pas | `CRON_SECRET` ou gate horaire | Tester `/api/cron/rse-actions-digest?dry=1` |

## 10. Sauvegardes & sécurité
- **Base** : sauvegardes gérées par Supabase (vérifier la rétention dans la console).
- **Fichiers** : sur SharePoint (versioning Microsoft 365).
- **Secrets** : uniquement dans Vercel / gestionnaire de secrets — jamais dans le dépôt. `.env.local` est git-ignored.
- **RLS** activée sur les tables ; les routes serveur utilisent le service role (`createAdminClient`) et refont les contrôles d'accès (voir HANDOVER §Authentification).
