# Pattern RSE — Règles de l'art (gravées dans le marbre)

> Document de référence pour la création de toute nouvelle application RSE sur la plateforme Sens'ethO.
> Validé sur : EcoVadis, Devoir de Vigilance, EUDR, Label Engagé RSE AFNOR.
> **Ne pas dévier de ce pattern sans validation explicite.**

---

## 1. Structure obligatoire

### 5 axes × 4 critères = 20 points d'évaluation (minimum)

```
Axe 1 (icon, color, weight 20%) — Description
  critere-1.1 — label + description longue
  critere-1.2
  critere-1.3
  critere-1.4

Axe 2 ...
...
Axe 5 ...
```

### 5 onglets obligatoires (dans cet ordre)

| # | ID | Label | Icône |
|---|---|---|---|
| 1 | `presentation` | Présentation | 📋 |
| 2 | `dashboard` | Tableau de bord | 📊 |
| 3 | `diagnostic` | [Nom du diagnostic propre au référentiel] | 🎯 |
| 4 | `actions` | Plan d'actions | 📝 |
| 5 | `correspondances` | Correspondances | 🔗 |

### Niveaux de maturité (5 niveaux)

```typescript
{ value: 0, shortLabel: 'NC', label: 'Non conforme/initié', pct: 0 }
{ value: 1, shortLabel: '1',  label: 'Initial/Basique',     pct: 0.25 }
{ value: 2, shortLabel: '2',  label: 'En développement',    pct: 0.50 }
{ value: 3, shortLabel: '3',  label: 'Appliqué/Conforme',   pct: 0.75 }
{ value: 4, shortLabel: '4',  label: 'Leader/Exemplaire',   pct: 1.00 }
```
> Adapter les labels au référentiel (ex: AFNOR utilise ⭐ Engagé, ⭐⭐ Confirmé...).

---

## 2. Tables Supabase

**Nommage :** `<slug>_*` (ex: `vigilance_*`, `eudr_*`, `afnor_*`)

```sql
-- Diagnostic principal
CREATE TABLE <slug>_diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  annee INTEGER NOT NULL,
  statut TEXT DEFAULT 'en_cours',
  score_global INTEGER,
  attachment_counter INTEGER NOT NULL DEFAULT 0,  -- préfixes A001_
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id, annee)
);

-- Réponses par critère
CREATE TABLE <slug>_reponses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES <slug>_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  niveau INTEGER DEFAULT 0,
  commentaire TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnostic_id, critere_id)
);

-- Actions d'amélioration
CREATE TABLE <slug>_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES <slug>_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  priorite TEXT DEFAULT 'moyenne',
  statut TEXT DEFAULT 'a_faire',
  echeance TEXT,
  responsable TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes & documents (Tiptap + pièces jointes SharePoint)
CREATE TABLE <slug>_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES <slug>_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  content TEXT,
  sections JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnostic_id, critere_id)
);

-- RLS sur toutes les tables
ALTER TABLE <slug>_* ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... USING (user_id = auth.uid() OR EXISTS (admin check));

-- Fonction atomique pour les préfixes d'annexes
CREATE OR REPLACE FUNCTION increment_<slug>_notes_counter(p_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE <slug>_diagnostics SET attachment_counter = attachment_counter + 1,
  updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $$;
```

---

## 3. Routes API (9 fichiers)

```
src/app/api/<slug>/
  route.ts                          — GET (find org+year) / POST (create)
  [id]/
    route.ts                        — GET (full) / PATCH (score/status)
    reponses/route.ts               — GET all / POST (upsert by critere_id)
    actions/route.ts                — GET / POST / PATCH / DELETE
    notes/
      route.ts                      — GET all / PUT (upsert sections)
      upload-session/route.ts       — Génère préfixe A001_ + session SP
      upload-confirm/route.ts       — Confirme métadonnées (PAS de var admin inutilisée !)
      signed-url/route.ts           — URL de téléchargement SharePoint
    export-excel/route.ts           — 6 onglets ExcelJS
```

### upload-session : pattern atomique obligatoire
```typescript
// 1. Incrémenter compteur atomiquement
const { data: counterData } = await admin.rpc('increment_<slug>_notes_counter', { p_id: diagnosticId })
const annexeIndex = counterData as number
const prefix = 'A' + String(annexeIndex).padStart(3, '0') + '_'
const finalName = prefix + safeName

// 2. Créer session SharePoint
const spPath = `/root:/${config.rootFolder}/${diagnosticId}/notes/${actionKey}/${finalName}:/createUploadSession`
const spRes = await spGraphForApp('<slug>-diagnostic', spPath, { method: 'POST', ... })
```

**Règle absolue :** `appKey = '<slug>-diagnostic'` pour spGraphForApp.

---

## 4. Page RSE

```typescript
// src/app/rse/<slug>/page.tsx
'use client'
import AppShell from '@/components/layout/AppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import dynamic from 'next/dynamic'

const DiagApp = dynamic(() => import('@/components/apps/<Slug>DiagnosticApp'), { ssr: false })

export default function Page() {
  return (
    <AppShell>
      <RequireSubscription appSlug="<slug>" appName="<Nom>">
        {(ctx) => <DiagApp ctx={ctx} />}
      </RequireSubscription>
    </AppShell>
  )
}
```

---

## 5. Composant principal — structure imposée

```typescript
// src/components/apps/<Slug>DiagnosticApp.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'

const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// DONNÉES STATIQUES
export const <SLUG>_AXES = [ ... ]  // 5 axes × 4 critères
export const <SLUG>_NIVEAUX = [ ... ]  // 5 niveaux

// COMPOSANT PRINCIPAL
export default function <Slug>DiagnosticApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions } = ctx

  // ÉTAT
  const [view, setView] = useState<View>('presentation')
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [actions, setActionsState] = useState<Action[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteSections, setNoteSections] = useState<Record<string, NoteSection[]>>({})

  // CHARGEMENT
  const load = useCallback(async () => { ... }, [org, year])
  useEffect(() => { load() }, [load])

  // HANDLERS
  async function handleReponseChange(...) { ... }
  function handleNoteChange(key: string, content: string) { ... }
  function handleNoteSectionsChange(key: string, sections: NoteSection[]) { ... }

  // BOUTONS HEADER (obligatoire)
  useEffect(() => {
    if (!diagnostic) { setActions(null); return }
    setActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExportExcel}>⬇ Excel</button>
        <button onClick={() => window.print()}>📄 PDF</button>
        <button onClick={() => setShowShare(true)}>👥 Partager</button>
      </div>
    )
  }, [diagnostic, exportingExcel])

  // VUES
  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex border-b ...">
        {VIEWS.map(v => <button key={v.id} ...>{v.label}</button>)}
      </div>

      {view === 'presentation'    && <PresentationView />}
      {view === 'dashboard'       && <TableauDeBordView reponses={reponses} actions={actions} score={...} />}
      {view === 'diagnostic'      && <DiagnosticView ... />}
      {view === 'actions'         && <ActionsView ... />}
      {view === 'correspondances' && <CorrespondancesView />}
    </div>
  )
}
```

---

## 6. Vue Tableau de bord — obligatoire

```
┌─────────────────────────────────────────────────────────────┐
│  Score global    │  Radar SVG 5 axes                        │
│  [0-100] [Badge] │  (même SVG que VSME/EcoVadis)            │
│                  │  Légende : icône + axe + % couleur       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Détail par axe et critère (2 colonnes)                     │
│  Barre de progression colorée + niveau NC/1/2/3/4           │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────────────┐
│  Plan d'actions — synthèse       │
│  À faire | En cours | Terminées  │
└──────────────────────────────────┘
```

Radar SVG : même code que VsmeEfragApp/EcoVadis — pure SVG, pas de lib externe.

---

## 7. Vue Diagnostic — structure imposée

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar gauche               │ Panel droit                   │
│ (liste axes + critères)      │                               │
│                              │ 1. Header critère (couleur)   │
│ [AXE 1 — icon]               │ 2. Sélecteur niveaux NC/1/2/3/4│
│   ● Critère 1.1 (NC)         │ 3. Commentaire & contexte     │
│   ○ Critère 1.2              │    + GuidedActionNotePanel    │
│   ○ ...                      │ 4. Actions d'amélioration     │
│ [AXE 2 — icon]               │    (édition inline + notes)   │
│   ...                        │                               │
└──────────────────────────────────────────────────────────────┘
```

**GuidedActionNotePanel sur chaque critère :**
```tsx
<GuidedActionNotePanel
  diagnosticId={diagnosticId}
  actionKey={critere.id}           // clé unique critère
  apiBase="/api/<slug>"
  noteTable="<slug>_notes"
  readOnly={false}
  note={allNotes[critere.id] ?? ''}
  onNoteChange={v => onNoteChange(critere.id, v)}
  initialSections={allNoteSections[critere.id] ?? []}
  onSectionsChange={s => onNoteSectionsChange(critere.id, s)}
/>
```

**Pour les notes par action :**
```tsx
actionKey={`${critere.id}_action_${action.id}`}
```

---

## 8. Vue Correspondances — contenu obligatoire

Deux sections minimum :

### A. Applications RSE Sens'ethO
- Lister toutes les apps de la plateforme pertinentes avec lien ↗ et correspondances par axe
- Badge coloré par axe de correspondance

### B. Référentiels externes
- ISO 26000 (toujours)
- CSRD/ESRS (toujours)
- GRI Standards (toujours)
- ODD/SDGs (toujours)
- Certifications/labels sectoriels spécifiques au référentiel

---

## 9. Export Excel — 6 onglets obligatoires

```
1. Couverture       — org, année, score global, badge, date export
2. Tableau de bord  — scores par axe, radar data, progression
3. Critères         — 20 critères, niveau, commentaire
4. Plan d'actions   — statut, priorité, échéance, responsable
5. Notes & Annexes  — pièces jointes avec réf A001_, taille, critère
6. Correspondances  — liens avec autres référentiels
```

**Pattern ExcelJS :**
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck uniquement si types ExcelJS incompatibles
import ExcelJS from 'exceljs'

// Palette couleurs ARGB thématique à l'app
// Palette vert pour EcoVadis, rouge pour Vigilance, vert pour EUDR, violet pour AFNOR
```

---

## 10. Présentation — contenu obligatoire

```
Hero :
  - Titre officiel du référentiel (loi, règlement, certification)
  - Sous-titre description en 1 phrase
  - Texte explicatif 2-3 paragraphes

Badges de maturité (score global → badge) :
  0-30%   → [❌ Insuffisant / Non conforme]
  30-60%  → [🔄 En développement]
  60-85%  → [✅ Conforme / Confirmé]
  85-100% → [⭐ Exemplaire / Leader]

Les 5 axes (cartes avec icône + couleur + description)
Informations légales/réglementaires (si applicable) :
  - Entreprises concernées
  - Date d'entrée en vigueur
  - Sanctions
```

---

## 11. Règles absolues (JAMAIS déroger)

| Règle | Détail |
|---|---|
| **Aucun fichier via Vercel/Supabase** | Upload : navigateur → SharePoint direct. Download : URL signée Graph API → navigateur |
| **RLS sur TOUTES les tables** | Immédiatement à la création |
| **createAdminClient()** | Dans TOUTES les routes API (bypass RLS côté serveur) |
| **eslint-disable en haut** | `/* eslint-disable @typescript-eslint/no-explicit-any */` si `as any` utilisé |
| **Variable admin** | Si déclarée dans upload-confirm, DOIT être utilisée ou ne pas être déclarée |
| **appKey SharePoint** | `'<slug>-diagnostic'` — configurer dans `sp_configs` si nouveau tenant |
| **attachement_counter** | Jamais décrémenté, jamais réinitialisé — compteur séquentiel permanent |
| **5 onglets** | Présentation → Tableau de bord → Diagnostic → Plan d'actions → Correspondances |
| **setHeaderActions** | Boutons Excel + PDF + Partager dans le header RseAppShell |
| **GuidedActionNotePanel** | Sur CHAQUE critère + sur chaque action (clé = critère_id_action_actionId) |

---

## 12. Commandes de déploiement

```bash
# 1. Créer tables Supabase via Management API
# PAT disponible dans .env.local (SUPABASE_PAT) ou dans le gestionnaire de secrets
curl -X POST "https://api.supabase.com/v1/projects/<PROJECT_REF>/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" \
  -d '{"query": "..."}'

# 2. Ajouter dans le catalogue apps + abonnements
# INSERT INTO apps ... ON CONFLICT DO NOTHING
# INSERT INTO app_subscriptions ... ON CONFLICT DO NOTHING

# 3. Lint avant commit (obligatoire)
npx next lint 2>&1 | grep "Error"  # Doit être vide

# 4. Commit + push
git add -A && git commit -m "feat(rse): application <Nom>" && git push

# 5. Vérifier build Vercel
gh run list --limit 1  # Doit être "success"
```

---

## 13. Applications créées (historique)

| App | Slug | Route | Référentiel | Date |
|---|---|---|---|---|
| EcoVadis Diagnostic | `ecovadis` | `/rse/ecovadis` | EcoVadis 2024 | 2026-05 |
| Devoir de Vigilance | `vigilance` | `/rse/vigilance` | Loi n°2017-399 | 2026-06 |
| EUDR Sans Déforestation | `eudr` | `/rse/eudr` | Règlement (UE) 2023/1115 | 2026-06 |
| Label Engagé RSE AFNOR | `afnor-rse` | `/rse/afnor-rse` | Label AFNOR / ISO 26000 | 2026-06 |

---

*Mis à jour : juin 2026 — validé sur 4 applications RSE en production*
