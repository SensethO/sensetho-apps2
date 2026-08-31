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

Il faut un fichier `.env.local` : **modèle complet et rôle de chaque variable dans [docs/MAINTENANCE.md §3](docs/MAINTENANCE.md)**. Node 20 minimum. Le projet **n'a pas de suite de tests** ni d'environnement de recette : `npm run build` (qui exécute d'abord le garde anti-polling) est la seule barrière automatique.

---

## Documentation (à lire dans cet ordre)

| Document | Pour qui | Contenu |
|---|---|---|
| **[ONBOARDING.md](ONBOARDING.md)** | Qui arrive | La première demi-heure : quoi lire, comment lancer, **ce qu'on ne fait jamais** |
| **[docs/README.md](docs/README.md)** | Tous | **Index** + carte **code ↔ documentation** (le point d'entrée) |
| **[docs/MAINTENANCE.md](docs/MAINTENANCE.md)** | Exploitant / mainteneur | Comment le site fonctionne, hébergement, secrets, base de données, déploiement, intégrations externes, tâches planifiées, runbook incidents |
| **[docs/HANDOVER.md](docs/HANDOVER.md)** | Développeur qui reprend | Organisation du code, conventions, comment ajouter/modifier une application, pièges connus |
| **[docs/RSE_APP_PATTERN.md](docs/RSE_APP_PATTERN.md)** | Développeur | Le patron « marbre » des applications RSE (règles gravées) |
| **[CLAUDE.md](CLAUDE.md)** | Agent IA + dev | Règles non-négociables du projet (lues par Claude Code) |

> **Reprendre le projet sans l'auteur ?** Commencer par `ONBOARDING.md`, puis `docs/README.md` (carte), puis `docs/MAINTENANCE.md` (faire tourner + déployer), puis `docs/HANDOVER.md` (modifier le code).

*Dernière mise à jour : 31 août 2026.*
