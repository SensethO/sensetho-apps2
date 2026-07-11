# Sens'ethO Apps (`sensetho-apps2`)

Plateforme d'applications **RSE, Business et Métier** (Next.js 14 + Supabase + SharePoint), déployée sur Vercel à l'adresse **[apps.sensetho.com](https://apps.sensetho.com)**.

Un portail multi-tenant : chaque client (organisation) accède à un catalogue d'applications — diagnostics RSE, outils métier (suivi fournisseurs EUDR, stratégie partagée…), administration.

---

## Démarrage rapide

```bash
npm install
npm run dev        # http://localhost:3002
npm run build      # build de production
npm run lint       # ESLint
```

Il faut un fichier `.env.local` avec les variables listées dans **[docs/MAINTENANCE.md § Variables d'environnement](docs/MAINTENANCE.md)**.

---

## Documentation (à lire dans cet ordre)

| Document | Pour qui | Contenu |
|---|---|---|
| **[docs/README.md](docs/README.md)** | Tous | **Index** + carte **code ↔ documentation** (le point d'entrée) |
| **[docs/MAINTENANCE.md](docs/MAINTENANCE.md)** | Exploitant / mainteneur | Comment le site fonctionne, hébergement, secrets, base de données, déploiement, intégrations externes, tâches planifiées, runbook incidents |
| **[docs/HANDOVER.md](docs/HANDOVER.md)** | Développeur qui reprend | Organisation du code, conventions, comment ajouter/modifier une application, pièges connus |
| **[docs/RSE_APP_PATTERN.md](docs/RSE_APP_PATTERN.md)** | Développeur | Le patron « marbre » des applications RSE (règles gravées) |
| **[CLAUDE.md](CLAUDE.md)** | Agent IA + dev | Règles non-négociables du projet (lues par Claude Code) |

> **Reprendre le projet sans l'auteur ?** Commencer par `docs/README.md`, puis `docs/MAINTENANCE.md` (faire tourner + déployer), puis `docs/HANDOVER.md` (modifier le code).
