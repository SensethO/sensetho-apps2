# Livrable d'exploitation — sensetho-apps2

> **But** : permettre à un exploitant/mainteneur de faire tourner, comprendre, déployer et dépanner la plateforme **sans l'auteur d'origine**.
> Voir aussi [HANDOVER.md](HANDOVER.md) (reprise du code) et [README de la doc](README.md) (carte code ↔ doc).
> *Dernière mise à jour : 31 août 2026.*

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
| Base de données | Supabase — projet **`pjrwjfozzynmjvbygqev`** | Console Supabase |
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
| `QONTO_CRED_SECRET` | Secret de chiffrement AES-256-GCM des identifiants Qonto par organisation. **Repli** : si absente, `EUDR_CRED_SECRET` est utilisée (`src/lib/qonto/crypto.ts`). ⚠️ Une fois des secrets chiffrés avec le repli, introduire `QONTO_CRED_SECRET` **casse le déchiffrement** existant — prévoir un re-chiffrement (re-saisie des connexions) si on la crée après coup |
| `ANTHROPIC_API_KEY` | Clé API Claude (analyse COA + ventilation comptable Qonto) |
| `CRON_SECRET` | Protège les endpoints cron (`Authorization: Bearer …`) : récap actions RSE, collecte Sindup |
| `SINDUP_CRED_SECRET` | Secret de chiffrement des identifiants Sindup par organisation. **Repli** : `EUDR_CRED_SECRET` si absente (`src/lib/sindup/crypto.ts`) — même avertissement que pour Qonto : l'introduire après coup casse le déchiffrement des secrets déjà chiffrés avec le repli |
| `SENTINEL_CLIENT_ID` / `SENTINEL_CLIENT_SECRET` | Copernicus Data Space (Sentinel Hub) — imagerie satellite Sentinel-2 des parcelles EUDR (`src/lib/eudr/sentinel.ts`). Absentes : la fonctionnalité renvoie une erreur explicite, le reste de l'app fonctionne |
| `WHISP_API_KEY` | API Whisp — analyse de déforestation des parcelles EUDR (`/api/eudr-fournisseurs/deforestation`). Absente : la route renvoie 400 avec un message clair |
| `ALPHA_VANTAGE_API_KEY` | Cours des matières premières (`/api/agri/marches`, app AgriTracker). ⚠️ **Pas** la météo : la météo vient d'Open-Meteo, qui ne demande aucune clé |
| `NEXT_PUBLIC_APP_URL` | Base des liens absolus dans les courriels d'invitation Le Miroir. **Repli** : l'origine de la requête. À définir en production pour que les liens ne dépendent pas de l'URL de déploiement Vercel |

### Modèle de `.env.local`

Le dépôt ne contient **volontairement aucun `.env.example`** (risque de le remplir par mégarde et de le committer). Modèle à recopier, valeurs à récupérer dans la console Vercel :

```bash
# --- Indispensables : sans elles l'application ne démarre pas ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# --- Indispensables dès qu'on touche aux fichiers (toutes les apps ou presque) ---
MS_TENANT_ID=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
SHAREPOINT_DRIVE_ID=
SHAREPOINT_BASE_FOLDER_ID=
SHAREPOINT_BASE_FOLDER_NAME=

# --- Par fonctionnalité : absentes, seule la fonctionnalité concernée est inerte ---
ANTHROPIC_API_KEY=
EUDR_CRED_SECRET=
QONTO_CRED_SECRET=
SINDUP_CRED_SECRET=
SENTINEL_CLIENT_ID=
SENTINEL_CLIENT_SECRET=
WHISP_API_KEY=
ALPHA_VANTAGE_API_KEY=
CRON_SECRET=
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

> Les trois premières suffisent à ouvrir le portail, se connecter et naviguer. Les autres
> n'ouvrent que leur propre fonctionnalité : le code de chaque intégration teste sa variable
> et renvoie un message explicite plutôt que de tomber en panne.

### Installer et lancer en local

```bash
npm install
npm run dev      # http://localhost:3002
npm run build    # build de production (exécute d'abord scripts/check-polling.mjs)
npm run lint
```

- **Node 18.17 minimum** (exigence de Next.js 14) ; **Node 20 ou plus recommandé**. Le dépôt ne fixe aucune version (pas de `.nvmrc`, pas de champ `engines`) et Vercel construit avec la version réglée dans les paramètres du projet — à vérifier dans la console si le build diverge du local.
- Le port **3002** est figé dans le script `dev` — ne pas le changer sans raison, plusieurs procédures et captures y renvoient.
- Le dépôt vit dans un dossier **OneDrive synchronisé** : si le build échoue avec `EINVAL readlink`, supprimer `.next` (parfois deux fois) — cf. §11.
- Il n'y a **pas de base locale ni d'environnement de recette** : un seul projet Supabase est documenté (§2), donc un `.env.local` renseigné avec ces valeurs fait écrire le développement **dans la base de production**. Travailler sur une organisation de test, ou créer un projet Supabase séparé et y rejouer `supabase/migrations/*.sql` dans l'ordre des noms de fichiers.

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
Les fichiers **`supabase/migrations/*.sql`** sont la trace de référence du schéma. **Elles ne sont pas jouées automatiquement** : elles sont appliquées via l'**API de gestion Supabase** (endpoint `POST /v1/projects/pjrwjfozzynmjvbygqev/database/query`) avec un **PAT Supabase** (jeton personnel, gardé hors dépôt). Pour appliquer une migration :

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/pjrwjfozzynmjvbygqev/database/query" \
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

5. Aperçu inline : `/api/sharepoint/image` renvoie une **URL signée** (et un `embedUrl` Graph `/preview` pour les PDF en iframe) — jamais les octets. Mise en conformité du 2026-08-30, cf. [RSE_APP_PATTERN.md](RSE_APP_PATTERN.md) §11.

Helper central : `src/lib/sharepointMulti.ts` (`spGraphForApp`, `getConfigForApp`). Sécurité des IDs : `src/lib/sharepointSecurity.ts`.

> ⚠️ **Exception résiduelle connue** : `src/app/api/sharepoint/download/route.ts` proxifie encore le corps du fichier à travers Vercel (appelée par `SharePointBrowser` et `FileUpload`). À convertir en URL signée comme les autres. Détail et raisonnement : RSE_APP_PATTERN §11.

## 6. Intégrations externes

- **Microsoft Graph / SharePoint** — stockage fichiers (cf. §5). Auth client_credentials (app Azure AD).
- **EUDR TRACES (Commission européenne)** — API **SOAP V3** du registre EUDR (dépôt/vérification de DDS). Client fait main : `src/lib/eudr/tracesV3.ts`. Identifiants Web Service chiffrés par organisation (`eudr_traces_credentials`, secret `EUDR_CRED_SECRET`). Environnements : acceptation (`eudr-test`) / production (`eudr-repository`). Détails : [memory du projet] + commentaires du code.
- **Anthropic (Claude)** — analyse des COA (`src/lib/eudr/coaAnalyze.ts`, modèle `claude-opus-4-8`, vision). Le fichier COA est lu depuis SharePoint et **transmis à l'API le temps de l'analyse** (rien stocké ailleurs). Également : ventilation comptable Qonto (voir ci-dessous).
- **Qonto (banque en ligne)** — lecture des transactions bancaires pour les apps budget. Connexion **par organisation** : identifiants (login + secret key) stockés chiffrés AES-256-GCM dans `qonto_connections` (`src/lib/qonto/crypto.ts`, secret `QONTO_CRED_SECRET`, repli `EUDR_CRED_SECRET` — cf. §3). Routes `/api/qonto/credentials|accounts|transactions|suggest-comptes`, garde `requireOrgOwner` (`src/lib/qonto/connections.ts`). Aucun ordre de paiement n'est jamais émis (lecture seule). **Ventilation IA** : `/api/qonto/suggest-comptes` propose un compte du plan comptable par transaction (modèle `claude-haiku-4-5`, sortie structurée) — les transactions sont découpées en **lots de 50 traités en parallèle** car 180 transactions séquentielles dépassaient les 60 s de la fonction Vercel (**504 constaté en production**). Rien n'est stocké côté IA.
- **Sindup (veille stratégique)** — double connecteur (`src/lib/sindup/`) : **RSS opérationnel** (parseur RSS 2.0/Atom fait main `rss.ts` — volontairement tolérant, aucune dépendance XML ajoutée) et **API préparée mais en attente** de la documentation client Sindup (`sindup_connections`, `type = 'api'` refusé par `collect.ts` tant que non branché). Collecte : à la demande (`POST /api/veille-sindup/collect`) et par cron (cf. §7). Tables `sindup_sources` / `sindup_mentions` / `sindup_connections` (migration `20260807_sindup_tables.sql`).
- **Copernicus Data Space (Sentinel Hub)** — imagerie satellite Sentinel-2 des parcelles EUDR (`src/lib/eudr/sentinel.ts`). OAuth client_credentials, jeton mis en cache en mémoire. Le serveur *lit* l'image pour la traiter : c'est l'une des exemptions admises à la règle « aucun octet par Vercel » (marbre §11).
- **Whisp** — analyse de risque de déforestation d'un GeoJSON de parcelles (`/api/eudr-fournisseurs/deforestation`, clé `WHISP_API_KEY`).
- **Open-Meteo** — météo d'AgriTracker (`/api/agri/weather/sync`, cron quotidien). **Aucune clé** : API publique.
- **Alpha Vantage** — cours des matières premières d'AgriTracker (`/api/agri/marches`, clé `ALPHA_VANTAGE_API_KEY`).

## 7. Tâches planifiées (Vercel Cron — `vercel.json`)

| Endpoint | Fréquence | Rôle |
|---|---|---|
| `/api/agri/weather/sync` | tous les jours 6h UTC | Synchronisation météo AgriTracker |
| `/api/cron/rse-actions-digest` | lun→ven 7h & 8h UTC | Récap quotidien des actions RSE par responsable (envoi ~9h Europe/Paris via gate interne). Protégé par `CRON_SECRET`. Sources : `src/lib/rseActionSources.ts`. |
| `/api/cron/sindup-collect` | lun→ven 6h, 12h & 17h UTC | Collecte des flux de veille Sindup (toutes les sources actives, toutes organisations). Budget 27 s : les sources restantes sont rattrapées à l'exécution suivante (plus ancien `last_fetch_at` d'abord). Protégé par `CRON_SECRET`. |

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
| **Plus de barre latérale** dans une app (impossible d'en sortir) | `RequireSubscription` placé **autour** de `RseAppShell` : il remplace tout ce qu'il enveloppe | Rétablir l'ordre shell dehors / barrière dedans — RSE_APP_PATTERN §4, HANDOVER §6 bis |
| **Des applications entières manquent** dans la barre latérale | `useApps` appelé avant la fin de l'authentification : la liste filtrée par abonnement est mise en cache module | Passer `authReady` (`!authLoading`) — HANDOVER §6 bis |
| **La page se fige, ne répond plus aux clics** (onglet qui chauffe) | Boucle de rendu : un effet dépend de `ctx` et appelle `ctx.setActions` | `ctx` doit rester mémoïsé dans `RseAppShell` — HANDOVER §6 bis |
| Upload fichier échoue | Config SharePoint (`sp_configs`) manquante pour l'app, ou secret Azure expiré | Vérifier `sp_app_routes`/`sp_configs` + `MS_CLIENT_SECRET` |
| Dépôt DDS EUDR rejeté « use V3 » | V1/V2 désactivées côté Commission | Déjà géré : client V3 (`tracesV3.ts`) |
| Analyse COA en erreur | `ANTHROPIC_API_KEY` absente/invalide en prod | Vérifier la variable Vercel |
| Cron n'envoie pas | `CRON_SECRET` ou gate horaire | Tester `/api/cron/rse-actions-digest?dry=1` |

## 9 bis. Indicateurs publiés sur `/hebergement-responsable`

La page publie des chiffres **mesurés**, avec la méthode affichée sous chacun. Deux natures :

| Indicateur | Source | Entretien |
|---|---|---|
| Lignes de données + nombre de tables | Mesure **automatique** : RPC `list_public_tables` via `src/lib/impactMetrics.ts`, cache 24 h (`unstable_cache`) | Aucun — se met à jour seul. Si la mesure échoue, la page n'affiche rien (jamais d'approximation) |
| Taille du schéma public | RPC `public_schema_size_bytes` (migration `20260829_public_schema_size.sql`, **appliquée le 30/08/2026**) | Aucun. Si la RPC venait à disparaître, l'indicateur se masque proprement au lieu d'approximer |
| Pages vues sur 30 jours (+ cumul) | Mesure **automatique** : comptage exact `app_logs` (robots exclus) via PostgREST en HEAD, même cache 24 h | Aucun. Périmètre affiché sur la page : ni appels d'API ni ressources statiques. Les agrégats SQL sont refusés par PostgREST (`PGRST123`) — toute somme/moyenne demanderait une RPC |
| Poids transféré de la page d'accueil | Constante `PAGE_WEIGHT` **datée** dans `src/app/hebergement-responsable/page.tsx` | À re-mesurer quand le bundle change sensiblement, puis mettre à jour la date |

> 🔑 **Si la forme de l'objet mesuré change** (nouveau champ dans `ImpactMetrics`), incrémenter la version
> dans les `keyParts` de `unstable_cache` (`['impact-metrics', 'v3-usage']`) — sinon l'ancien objet en cache
> est resservi jusqu'à 24 h et les nouveaux champs restent vides. Le `tag` reste stable pour permettre un
> `revalidateTag('impact-metrics')`.

Re-mesurer le poids de l'accueil (HTML + JS/CSS + image du premier chargement, compression active) :

```bash
curl -s -H "Accept-Encoding: gzip, br" -o /dev/null -w "%{size_download}\n" https://apps.sensetho.com/
```

puis additionner les assets `/_next/static/*.js|css` référencés dans le HTML et la variante d'image servie
(`/_next/image?url=%2Flogo2.png&w=384&q=75`).

> ⚠️ **Règle éditoriale de la page** : on ne publie un chiffre que si on peut dire comment il est obtenu,
> et on ne convertit rien en équivalent carbone sans méthode publiée. Ce qui est déclaré par un
> fournisseur est présenté comme tel, jamais comme une performance mesurée par nous.

**Images** : les fichiers de `public/` doivent rester dimensionnés pour leur usage réel (le logo est affiché
à 300 px au maximum, le picto à 32 px) et être servis via `next/image` — un `<img>` brut transfère le
fichier source en entier à chaque chargement.

## 9 ter. Pages publiques

Les pages accessibles sans compte sont **exclusivement** celles listées dans `PUBLIC_ROUTES` (`src/middleware.ts`) — toute nouvelle page publique doit y être déclarée, sinon redirection vers le login. Parmi elles :

- **`/hebergement-responsable`** — engagements d'hébergement. Page riche restaurée de sensetho-apps v1 (2026-08), puis enrichie des **indicateurs mesurés** du §9 bis. Doctrine : « mesuré ≠ déclaré » — chaque chiffre publie sa méthode ; un engagement fournisseur reste présenté comme une déclaration.
- **`/engagements-rse`** — les engagements RSE de Sens'ethO elle-même. Règle de rédaction (en commentaire du fichier) : uniquement des engagements réels du corpus de marque et des pratiques vérifiables, avancement dit honnêtement.
- **`/politique-de-confidentialite`** (`src/app/(marketing)/politique-de-confidentialite/page.tsx`) — liste les **sous-traitants**, dont Anthropic (IA) et Qonto (banque, ajoutés le 6 août 2026). ⚠️ La constante `DERNIERE_REVISION` est **manuelle, volontairement** : la mettre à jour à chaque évolution du document (une date dynamique masquerait les révisions réelles).

## 10. Sauvegardes & sécurité
- **Base** : sauvegardes gérées par Supabase (vérifier la rétention dans la console).
- **Fichiers** : sur SharePoint (versioning Microsoft 365).
- **Secrets** : uniquement dans Vercel / gestionnaire de secrets — jamais dans le dépôt. `.env.local` est git-ignored.
- **RLS** activée sur les tables ; les routes serveur utilisent le service role (`createAdminClient`) et refont les contrôles d'accès (voir HANDOVER §Authentification).

## 11. Incidents passés & garde-fous en place

Synthèse des leçons apprises — les garde-fous listés ici sont **actifs dans le code** : ne pas les retirer sans comprendre l'incident d'origine.

| Incident / risque | Leçon | Garde-fou en place |
|---|---|---|
| **30-31/07/2026** — boucle infinie de requêtes sur `/api/eudr-fournisseurs/satellite` + pollings `setInterval` à 2-4 s tournant onglet en arrière-plan → quota d'egress Supabase (5 Go) et crédit Vercel épuisés | Tout rafraîchissement périodique doit être plafonné et suspendu en arrière-plan | Hook central `usePolling` (`src/hooks/usePolling.ts`) : pause si `document.hidden`, plancher d'intervalle, ralentissement adaptatif |
| Idem | Un garde-fou humain ne suffit pas : il faut échouer le **build** | `scripts/check-polling.mjs` exécuté en **`prebuild`** (donc aussi sur Vercel) : refuse tout `setInterval` < 8 s ou sans garde `document.hidden` dans un composant client (allowlist explicite dans le script) |
| Idem | Couper le coût **avant** les appels Supabase | Coupe-circuit dans `src/middleware.ts` : rate-limit en mémoire par IP (300 req/min glissant), best-effort par isolate |
| **08/2026** — pannes répétées du projet Supabase de Londres | — | **Migration vers Paris** le 01/08/2026 : projet actuel `pjrwjfozzynmjvbygqev` (eu-west-3). L'ancien projet londonien est **en veille et reste à supprimer** (vérifier qu'aucune donnée n'y manque avant). Les variables `NEXT_PUBLIC_SUPABASE_*` sont figées au build : tout changement de projet exige un redéploiement |
| **30/08/2026** — trois pannes de navigation coup sur coup (barre latérale emportée par la barrière d'abonnement sur 31 pages ; applications manquantes par cache d'auth prématuré ; boucle de rendu infinie figeant 4 apps) | Une même famille : l'**état et la mémoïsation React dans le shell**. Un shell partagé par 40 apps transforme chaque erreur d'imbrication ou de référence en panne de plateforme | Ordre d'imbrication gravé au marbre §4 ; `authReady` devenu **paramètre obligatoire** de `useApps` (l'oubli est une erreur de compilation) ; `ctx` mémoïsé et `setYearShiftHandler` stabilisé dans `RseAppShell`, avec commentaire d'avertissement dans le code. Explication pédagogique : **HANDOVER §6 bis** |
| Latence transatlantique base ↔ fonctions | Exécuter les fonctions près de la base | `vercel.json` : `"regions": ["cdg1"]` (Paris) — **ne pas retirer** |
| Versions divergentes du Catalogue-App | Le numéro de version de `@sensetho/catalogue-app` est **bumpé automatiquement par la CI** du dépôt Catalogue-App | **Ne jamais bumper la version à la main** (ni dans Catalogue-App, ni en épinglant ici une version inventée) |
| **08/2026** — PAT Supabase révoqués à répétition (2 jetons collés en clair dans un chat, révoqués par précaution) | Un secret exposé se révoque, sans discussion | Recréer un PAT : dashboard Supabase → compte → **Access Tokens** → Generate new token. Le garder hors dépôt et hors chat ; les migrations en attente (cf. §12) ne peuvent être appliquées qu'avec un jeton valide |
| Le dépôt vit dans un dossier **OneDrive** synchronisé | OneDrive corrompt/dématérialise des fichiers que Node et Git veulent lire en local | Trois parades éprouvées : `rm -rf .next` (parfois **deux fois** de suite) si `EINVAL readlink` au build ; `attrib +P -U /S /D` sur `.git` si Git échoue avec `mmap failed` (fichiers passés « cloud-only ») ; ne jamais laisser `node_modules` passer cloud-only (réinstaller au besoin) |

## 12. Registre des migrations récentes

`supabase/migrations/*.sql` est la trace du schéma, **pas un journal d'application** : rien dans le dépôt ne dit si un fichier a été joué en production. Ce registre tient donc l'état à la main, et le §12 bis donne le moyen de le vérifier en base plutôt que de le croire.

### Appliquées en production

| Migration | Objet | Appliquée le |
|---|---|---|
| `20260829_public_schema_size.sql` | RPC `public_schema_size_bytes` (indicateur de taille de base, §9 bis) | 30/08/2026 |
| `20260830_rename_plan_strategique.sql` | Renommage catalogue « Projet RSE » → « Plan Stratégique » (slug `projet-rse` inchangé) | 30/08/2026 |
| `20260830_projet_rse_notes.sql` | Notes de projet (`ProjetRseNotesPanel`) | 30/08/2026 |
| `20260830_icone_admin_sso.sql` | Icône de l'app `admin-sso` : `shieldCheck` (doublon) → `lock` | 30/08/2026 |
| `20260830_projet_rse_sous_programmes_et_acteurs.sql` | Niveau sous-programme + registre d'acteurs référencés | vérifié appliqué le 30/08/2026 |
| `20260831_projet_rse_modules.sql` | Tables des six sous-applications (cadrage, P5, SMP, WBS/RACI/jalons/risques/indicateurs, impact social) | vérifié appliqué le 30/08/2026 |

> Le renommage « Plan Stratégique » a dû être **appliqué deux fois** : une session
> parallèle avait réécrit l'entrée du catalogue entre-temps. Contrôle rapide :
> `SELECT name FROM apps WHERE slug = 'projet-rse'` doit renvoyer « Plan Stratégique ».
> Ce nom est aussi modifiable sans jeton depuis Administration → Catégories.

### En attente

*Aucune.* Les quatre migrations EUDR du 31/08/2026 ont été appliquées le jour même
sur le projet Paris `pjrwjfozzynmjvbygqev`, et vérifiées par lecture de
`information_schema` :

| Migration | Objet | Appliquée le |
|---|---|---|
| `20260831_eudr_signal_qualification.sql` | Table `eudr_signal_qualifications` : conclusion d'instruction (à instruire / déforestation confirmée / écartée…) par parcelle signalée par Whisp, onglet « Perturbation du couvert » | 31/08/2026 |
| `20260831_eudr_plots_supplier.sql` | `eudr_plots` : garantit `supplier_id` + sa clé étrangère, ajoute `supplier_assigned_at` / `supplier_assigned_by` (provenance d'un rattachement manuel), index des parcelles orphelines, politique RLS d'écriture — onglet « 🗺️ Parcelles » | 31/08/2026 |
| `20260831_eudr_attachment_origine.sql` | `eudr_attachments.corrige_de` : lien d'une version corrigée vers le fichier dont elle est issue. Empêche le double comptage des mêmes terres au référentiel, et rattrape le cas d'un fichier renommé à la main | 31/08/2026 |
| `20260831_eudr_dds_empreinte.sql` | `eudr_dds.geojson_sha256` / `geojson_simplify` : empreinte du GeoJSON **assaini** réellement transmis à TRACES au dépôt — voir §12 ter | 31/08/2026 |
| `20260901_eudr_fichiers_immuables.sql` | Versions suffixées, retrait logique, `eudr_dds.geojson_nom`, table `eudr_fichiers_journal` — voir §12 quater | 01/09/2026 |
| `20260901_eudr_fichiers_rattrapage.sql` | Renseigne `base_name` / `version_num` pour les fichiers déposés avant le versionnage (sans les renommer) | 01/09/2026 |

Les replis décrits ci-dessous restent en place dans le code : ils ne coûtent rien
et couvrent une base restaurée depuis une sauvegarde antérieure, ou un déploiement
de l'application sur un autre projet Supabase.

> Sans `20260831_eudr_signal_qualification`, le panneau « Perturbation du couvert »
> affiche « Qualification des signaux indisponible » et n'écrit rien ; la reprise des
> conclusions (`/api/eudr-fournisseurs/deforestation/reprise`) répond 503 avec le motif.

> Sans `20260831_eudr_plots_supplier`, le rattachement d'une parcelle à un fournisseur
> fonctionne (`supplier_id` existe depuis `20260806_eudr_plots.sql`) mais sa provenance
> (qui, quand) n'est pas consignée : la route retombe sur une écriture sans trace.

> Sans `20260831_eudr_attachment_origine`, original et version corrigée sont rapprochés
> par leur nom, que le code construit lui-même (« X (corrigé).geojson » ↔ « X.geojson »,
> même organisation). Le versement retire donc déjà l'autre version du périmètre courant.
> **Un fichier renommé à la main cesse d'être apparié** : les contrôles de version se
> taisent alors au lieu de se tromper — un fichier isolé est traité comme un fichier
> sans autre version.

> Sans `20260831_eudr_dds_empreinte`, le contrôle de contenu (§12 ter) ne s'exprime
> jamais ; le contrôle de version continue de s'appliquer.

### §12 quater — Fichiers EUDR : immuables, versionnés, journalisés

**Décision du 01/09/2026 : le dépôt passe exclusivement par l'application.** Plus
aucune action directe sur SharePoint pour déposer un fichier. L'application peut
donc imposer le nom — et le nom cesse d'être un libellé de confort pour devenir
une donnée probante.

#### Où sont les fichiers

Site : `https://scdbpro.sharepoint.com/sites/WebApp-Partage`, bibliothèque
« Documents partages ». Chaque application a son dossier, réglé en base dans
`sp_app_routes` (colonne `folder_name`) — voir §5. Pour l'EUDR :

```
Documents partages/EUDR-FOURNISSEURS/{org_id}/{supplier|contract}/{entity_id}/{base}__v{NNN}{ext}
```

`org_id` et `entity_id` sont les UUID Supabase : le classement est celui de la
base, pas celui d'un humain. Cherchez par l'application, pas dans l'arborescence.

#### Les trois règles

1. **Un dépôt crée une version, il n'écrase jamais.** Le serveur calcule le
   numéro suivant (`prochaineVersion`) et impose `{base}__v{NNN}{ext}`.
   `conflictBehavior` est passé de `rename` à **`fail`** : SharePoint n'a plus le
   droit d'inventer « fichier 1.geojson » en silence — l'ancien réglage a laissé
   des doublons du type `COA OT039  (2).pdf`, où le nom en base et le nom réel
   pouvaient diverger. Une collision est désormais une anomalie, et se voit.
2. **Rien ne se supprime.** `DELETE /api/eudr-fournisseurs/documents` ne touche
   plus SharePoint : c'est un **retrait logique** (`retire_le`), qui masque le
   document de l'usage courant en conservant fichier et trace. Un document déjà
   transmis dans une DDS ne peut même pas être retiré — la tentative est refusée
   et journalisée (`suppression_refusee`).
3. **Rien ne se renomme.** Aucune route ne l'offre. L'explorateur générique
   `/api/sharepoint/files` refuse PATCH et DELETE sur tout item situé sous
   `EUDR-FOURNISSEURS` (`zoneImmuable`) — la protection est côté serveur, pas
   dans l'interface : une protection qui ne vit que dans l'UI n'en est pas une.
   Un renommage exceptionnel relève d'une intervention technique consciente,
   à consigner en `renommage_technique` avec son motif.

Le nom est vérifié **à la source** : `upload-confirm` ne croit pas le client, il
relit `name` et `parentReference` sur SharePoint à partir du `spItemId` et
enregistre ce qu'il y trouve, plus `sp_path`. Un client qui se tromperait — ou
mentirait — ne peut pas décaler la traçabilité.

#### Quelle version est partie dans une déclaration

Trois informations, chacune nécessaire, figées au dépôt dans `eudr_dds` :

| Colonne | Rôle |
|---|---|
| `geojson_attachment_id` | **pointe** — quel document |
| `geojson_nom` | **se lit** — « X__v003.geojson », lisible par un inspecteur |
| `geojson_sha256` | **prouve** — empreinte des octets réellement transmis (§12 ter) |

Un identifiant technique ne se lit pas dans un dossier d'audit ; une empreinte ne
dit pas de quel fichier elle est l'empreinte. Les trois sont affichées dans la
colonne « Fichier déclaré » de l'onglet TRACES.

En parallèle, `eudr_fichiers_journal` conserve un événement `depot_dds` portant le
nom, la version, l'empreinte et l'UUID de la déclaration. C'est la trace qui
répond, des années plus tard, à « quelle version est partie ? » — indépendamment
de `eudr_dds`, et elle survit à la disparition de la ligne d'attachement.

#### Le journal

`eudr_fichiers_journal` est **append-only** : aucune route n'expose de mise à jour
ni de suppression, et la RLS n'accorde que le SELECT. Événements : `depot`,
`versement`, `retrait_referentiel`, `depot_dds`, `retrait_logique`,
`renommage_technique`, `suppression_refusee`.

`journaliser()` n'échoue jamais l'action appelante : un journal indisponible ne
doit pas bloquer un dépôt réglementaire. Le compromis est assumé — une trace
manquante se rattrape au rapprochement, un dépôt bloqué ne se rattrape pas.

#### Portée, et ce qui reste ouvert

Cette règle couvre **l'application EUDR uniquement**. Les autres apps conservent
la suppression de pièces jointes, qui y est un usage normal (notes et documents).
L'étendre supposerait de décider app par app ce qui relève de la conservation
probante — à faire si le besoin s'en présente, pas par symétrie.

Deux limites subsistent :

- **Un administrateur SharePoint garde la main.** Le garde-fou couvre les routes
  de l'application, pas l'interface Microsoft 365 ni les clients de
  synchronisation. Le verrouiller vraiment demanderait une stratégie de rétention
  Purview côté tenant — décision d'administration, hors application. En attendant,
  `sp_path` permet de détecter après coup un fichier déplacé ou renommé.
- **Les fichiers antérieurs au 01/09/2026 gardent leur nom**, sans suffixe : les
  renommer serait précisément l'acte que la règle interdit. Leur `base_name` a été
  renseigné par rattrapage, leur `version_num` reste nul et compte pour 1 ; la
  première version déposée après eux prend donc le numéro 2.

### §12 ter — Ce que le contrôle des déclarations voit, et ce qu'il ne voit pas

Deux contrôles distincts s'appliquent à une DDS déjà déposée, tous deux dans
`src/app/api/eudr-fournisseurs/traces/dds/route.ts`. Aucun des deux n'agit :
ils constatent, l'appréciation revient à l'opérateur.

1. **Contrôle de version** — suit le pointeur `eudr_dds.geojson_attachment_id`.
   Détecte qu'une *autre* version du fichier fait désormais référence
   (état `version_perimee`), ou que le fichier déclaré est sorti du périmètre
   courant (`hors_perimetre`).
2. **Contrôle de contenu** — compare `eudr_dds.geojson_sha256` à l'empreinte
   recalculée aujourd'hui (état `contenu_modifie`). Détecte le remplacement du
   contenu du *même* document sur SharePoint, hors du flux de correction de
   l'application — cas que le contrôle de version ne peut pas voir, puisque le
   pointeur reste valide.

L'empreinte porte sur le GeoJSON **après assainissement** (éclatement des
MultiPolygon, suppression des trous, arrondi, simplification optionnelle),
c'est-à-dire sur les octets effectivement transmis à TRACES — pas sur le fichier
brut. Le réglage de simplification est figé au dépôt dans `geojson_simplify` et
rejoué au contrôle : sans cela, une comparaison faite avec un assainissement
différent signalerait un faux écart. Dépôt et contrôle partagent pour cette raison
la même fonction, `src/app/api/eudr-fournisseurs/traces/_geojson.ts` — **ne pas
dupliquer cette logique**.

Le contrôle de contenu se tait volontairement dans trois cas : DDS déposée avant
le 31/08/2026 (empreinte nulle, rien à comparer), fichier illisible ou supprimé,
et écart de version déjà signalé (inutile de superposer deux alertes).

Ce qu'aucun des deux ne voit : **une modification faite sur SharePoint n'est pas
détectée au moment où elle a lieu.** L'application ne surveille pas SharePoint ;
l'écart apparaît au prochain affichage de la liste TRACES ou du tableau de bord.
Le tri et le versement, eux, relisent toujours le fichier depuis SharePoint — un
contenu modifié y est donc bien pris en compte dès qu'ils sont relancés, mais rien
ne les relance tout seul.

Le coût de lecture est borné : une seule lecture SharePoint par couple
(fichier, réglage), quel que soit le nombre de déclarations qui s'y rattachent, et
seules les DDS par ailleurs conformes sont vérifiées.

Toute nouvelle migration committée vient s'ajouter ici jusqu'à son application.

Application (une par une, dans l'ordre des noms de fichiers, cf. §4) :

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/pjrwjfozzynmjvbygqev/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" -H "Content-Type: application/json" \
  --data-binary "$(jq -Rs '{query: .}' < supabase/migrations/<fichier>.sql)"
```

> Après application : **déplacer la ligne** dans le tableau « Appliquées » avec sa date, et vérifier dans l'app que le message « migration manquante » a disparu. Un PAT Supabase valide est nécessaire (cf. §11, révocations d'août 2026).

## 12 bis. Vérifier ce qui est réellement appliqué

À faire **avant de croire le tableau du §12** — après une reprise, après une absence, ou au moindre doute. La requête liste les tables et fonctions attendues par les migrations récentes ; ce qui manque n'est pas appliqué.

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/pjrwjfozzynmjvbygqev/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" -H "Content-Type: application/json" \
  --data-binary '{"query": "select table_name from information_schema.tables where table_schema = '"'"'public'"'"' and table_name like '"'"'projet_rse_%'"'"' order by 1;"}'
```

Repères de lecture :

| Ce qu'on cherche | Présent ⇒ migration appliquée |
|---|---|
| Table `projet_rse_acteurs` | `20260830_projet_rse_sous_programmes_et_acteurs.sql` |
| Table `projet_rse_cadrage` (ou `projet_rse_lots`) | `20260831_projet_rse_modules.sql` |
| Table `projet_rse_notes` | `20260830_projet_rse_notes.sql` |
| Colonne `eudr_attachments.corrige_de` (`select column_name from information_schema.columns where table_name = 'eudr_attachments' and column_name = 'corrige_de';`) | `20260831_eudr_attachment_origine.sql` |
| Fonction `public_schema_size_bytes` (`select proname from pg_proc where proname = 'public_schema_size_bytes';`) | `20260829_public_schema_size.sql` |
| `select name from apps where slug = 'projet-rse';` → « Plan Stratégique » | `20260830_rename_plan_strategique.sql` |
| `select icon from apps where slug = 'admin-sso';` → `lock` | `20260830_icone_admin_sso.sql` |

> Le même raisonnement vaut pour toute migration future : elle doit laisser derrière elle **une trace vérifiable en une requête** (une table, une fonction, une valeur), et cette trace doit être écrite ici.
