# Onboarding — sensetho-apps2

Bienvenue. Ce dépôt est **Sens'ethO Apps** : une plateforme d'applications RSE, Business et Métier (Next.js 14 + Supabase + SharePoint), en production sur **apps.sensetho.com** (Vercel).

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
   Il faut un `.env.local` (variables listées dans `docs/MAINTENANCE.md §3`).

## À savoir absolument
- **Fichiers → SharePoint uniquement** (jamais Vercel/Supabase Storage).
- **RLS** sur toutes les tables ; les routes serveur re-vérifient l'accès (`createAdminClient` = service role).
- **Diagnostics RSE** : respecter le patron marbre (5 axes × 4 critères, 5 onglets, tables `<slug>_*`).
- **Apps Business/Métier** (ex. EUDR fournisseurs) : mode « document vivant » clé-organisation, hors marbre.
- **Migrations** : `supabase/migrations/*.sql` appliquées via l'API de gestion Supabase (cf. `docs/MAINTENANCE.md §4`) — toujours committer le `.sql`. ⚠️ Certaines sont **committées mais pas encore appliquées** : voir `docs/MAINTENANCE.md §12`.
- **Garde-fous consommation** : le build exécute `scripts/check-polling.mjs` (prebuild) et refuse les `setInterval` risqués — utiliser le hook `usePolling`. Contexte : incident quotas du 30/07/2026 (`docs/MAINTENANCE.md §11`).
- **Modules vendorisés** (budget, Qonto) : toute évolution se reporte au dépôt `@sensetho/catalogue-app` (`docs/HANDOVER.md §7`). Ne jamais bumper sa version à la main (CI auto-bump).
- **Déploiement** : `git push origin master` → build Vercel automatique.

## Repères code
- `src/app/rse|business/<slug>/page.tsx` — pages des apps.
- `src/components/apps/<Nom>App.tsx` — un composant par app.
- `src/components/rse/RseAppShell.tsx` — shell obligatoire des apps RSE.
- `src/lib/` — helpers (Supabase, SharePoint, partage, EUDR, PDF). Les fichiers-clés portent une ancre `@see docs/…`.

En cas de doute, la carte **code ↔ documentation** de `docs/README.md` pointe vers la bonne section.
