# Onboarding — sensetho-apps2

Bienvenue. Ce dépôt est **Sens'ethO Apps** : une plateforme d'applications RSE, Business et Métier (Next.js 14 + Supabase + SharePoint), en production sur **apps.sensetho.com** (Vercel).
*Dernière mise à jour : 31 août 2026.*

## Prendre le projet en main (30 min)

1. **Lire la doc dans cet ordre** :
   - [`docs/README.md`](docs/README.md) — index + carte **code ↔ documentation**.
   - [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) — comment le site fonctionne, secrets, base de données, déploiement, **runbook incidents**.
   - [`docs/HANDOVER.md`](docs/HANDOVER.md) — organisation du code, conventions, **comment ajouter une application**, pièges connus.
   - [`docs/RSE_APP_PATTERN.md`](docs/RSE_APP_PATTERN.md) — le patron « marbre » des diagnostics RSE (règles gravées).
   - [`CLAUDE.md`](CLAUDE.md) — règles non-négociables.

2. **Faire tourner en local** :
   ```bash
   npm install
   npm run dev      # http://localhost:3002
   ```
   Il faut un `.env.local` : **modèle complet à recopier dans `docs/MAINTENANCE.md §3`**. Trois variables Supabase suffisent à ouvrir le portail et naviguer ; les autres n'ouvrent que leur propre fonctionnalité. Node 20 minimum.

## Ce qu'on ne fait JAMAIS

Neuf interdits. Chacun vient d'une panne réelle, pas d'une préférence de style.

| Interdit | Pourquoi | Où c'est expliqué |
|---|---|---|
| Faire transiter un fichier par Vercel ou Supabase Storage | Coût, quotas, et le stockage contractuel est SharePoint | MAINTENANCE §5 · RSE_APP_PATTERN §11 |
| Envelopper `RseAppShell` dans `RequireSubscription` | La barrière remplace tout ce qu'elle enveloppe : plus de barre latérale, utilisateur bloqué (31 pages, 30/08/2026) | HANDOVER §6 bis · marbre §4 |
| Appeler `useApps(isAdmin)` sans `authReady` | Cache module rempli avant l'auth : des catégories entières disparaissent du menu | HANDOVER §6 bis |
| Dé-mémoïser `ctx` dans `RseAppShell` | Boucle de rendu infinie : la page se fige et ne répond plus aux clics | HANDOVER §6 bis · CLAUDE.md §2 |
| Un `setInterval` sous 8 s, ou sans garde `document.hidden` | Quotas Vercel et Supabase épuisés en une nuit (30/07/2026). Le build **refuse** de passer | MAINTENANCE §11 · hook `usePolling` |
| Bumper à la main la version de `@sensetho/catalogue-app` | La CI du Catalogue-App s'en charge ; les versions divergent sinon | HANDOVER §7 · MAINTENANCE §11 |
| Écrire un secret dans le dépôt, dans un ticket ou dans un chat | Un secret exposé se révoque, sans discussion (2 PAT Supabase révoqués en 08/2026) | MAINTENANCE §10-11 |
| Créer une table sans RLS | Toutes les données sont multi-clients | HANDOVER §5 |
| Renommer un slug, une `appKey` SharePoint ou une table `<slug>_*` | Abonnements, partages et configuration SharePoint y sont indexés | HANDOVER §1 |

## À savoir absolument
- **RLS** sur toutes les tables ; les routes serveur re-vérifient l'accès (`createAdminClient` = service role).
- **Diagnostics RSE** : respecter le patron marbre (5 axes × 4 critères, 5 onglets, tables `<slug>_*`).
- **Apps Business/Métier** (ex. EUDR fournisseurs, Plan Stratégique) : mode « document vivant » clé-organisation, hors marbre.
- **Migrations** : `supabase/migrations/*.sql` appliquées via l'API de gestion Supabase (cf. `docs/MAINTENANCE.md §4`) — toujours committer le `.sql`. ⚠️ Le dépôt ne dit **pas** ce qui est appliqué : le registre est en `§12`, et la vérification en base en **`§12 bis`**. Certaines migrations sont committées mais pas encore appliquées.
- **Pas de tests, pas d'environnement de recette** : la seule barrière automatique est `npm run build`. Le reste se vérifie à la main (`docs/HANDOVER.md §12`), et un `.env.local` renseigné écrit dans la base de **production**.
- **Déploiement** : `git push origin master` → build Vercel automatique.

## Repères code
- `src/app/rse|business/<slug>/page.tsx` — pages des apps.
- `src/components/apps/<Nom>App.tsx` — un composant par app.
- `src/components/rse/RseAppShell.tsx` — shell obligatoire des apps RSE.
- `src/lib/` — helpers (Supabase, SharePoint, partage, EUDR, PDF). Les fichiers-clés portent une ancre `@see docs/…`.

En cas de doute, la carte **code ↔ documentation** de `docs/README.md` pointe vers la bonne section.
