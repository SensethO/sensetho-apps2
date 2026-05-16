# CLAUDE.md — sensetho-apps2

> Ce fichier est lu automatiquement par Claude Code à chaque session.  
> Il définit les règles **non-négociables** du projet. Toute déviation doit être explicitement autorisée par l'utilisateur.

---

## Stack technique

- **Framework** : Next.js 14 (App Router, TypeScript strict)
- **Auth / DB** : Supabase SSR (`@supabase/ssr`)
- **Style** : Tailwind CSS + variables CSS custom (`--bg`, `--bg-card`, `--bg-sidebar`, `--text`, `--text-muted`, `--text-subtle`, `--accent`, `--border`)
- **Icônes** : SVG inline custom, composant `src/components/ui/Icon.tsx`
- **Fichiers** : SharePoint exclusivement (jamais Vercel/Supabase Storage)

---

## Structure des dossiers critiques

```
src/
  app/
    dashboard/page.tsx          ← tableau de bord avec favoris
    admin/categories/page.tsx   ← gestion catégories + apps
    rse/                        ← toutes les apps RSE
  components/
    layout/
      AppShell.tsx              ← shell générique (pages non-RSE)
      Sidebar.tsx               ← nav principale + boutons ⭐ favoris
    rse/
      RseAppShell.tsx           ← ⚠️ shell OBLIGATOIRE pour toute app RSE
      RseHeader.tsx             ← bandeau org + années
      OrganisationsSidebar.tsx  ← panneau organisations
    dashboard/
      FavoritesBoard.tsx        ← grille des apps favorites
    admin/
      CategoriesManager.tsx     ← admin catégories/apps
    ui/
      Icon.tsx                  ← SOURCE UNIQUE de vérité pour les icônes
  hooks/
    useApps.ts          ← chargement menu + BroadcastChannel refresh
    useRseYears.ts      ← gestion années RSE par org+app
    useFavorites.ts     ← favoris localStorage par userId
    useAuth.ts          ← profil utilisateur + isAdmin
    useOrganisations.ts ← CRUD organisations
```

---

## Applications RSE — règles ABSOLUES

### 1. Toute app RSE DOIT utiliser `RseAppShell`

```tsx
// ✅ CORRECT
export default function MaPageRse() {
  return (
    <RseAppShell appSlug="mon-slug" title="Titre">
      {(ctx) => <MonComposant ctx={ctx} />}
    </RseAppShell>
  )
}

// ❌ INTERDIT — ne jamais utiliser AppShell directement pour une app RSE
export default function MaPageRse() {
  return <AppShell>...</AppShell>
}
```

### 2. Interface `RseContext` — contrat immuable

```typescript
export interface RseContext {
  org: Organisation | null
  year: number
  setActions: (node: React.ReactNode) => void
  setYearShiftHandler: (fn: ((delta: number) => Promise<void>) | null) => void
}
```

**Règles** :
- `org` : organisation sélectionnée (null si aucune)
- `year` : année active (toujours un entier ≥ 2000)
- `setActions` : injecter des boutons dans le header RSE (ex: Enregistrer)
- `setYearShiftHandler` : **OBLIGATOIRE** si l'app stocke des données par année

> ⚠️ Ne jamais supprimer ni renommer ces champs. Ajouter uniquement.

### 3. Gestion des années — règles strictes

**Ce qui est autorisé :**
- Ajouter l'année suivante (+1 par rapport au max) via `+ Année`
- Modifier l'année de départ → décale TOUTES les années du même delta

**Ce qui est INTERDIT :**
- Supprimer une année individuelle
- Modifier une année qui n'est pas la première
- Ajouter une année non consécutive

**Table Supabase** : `rse_years(organisation_id, app_slug, year, user_id)`  
Clé unique : `(organisation_id, app_slug, year)`

### 4. `changeStartYear` — ordre d'exécution CRITIQUE

```typescript
// ⚠️ ORDRE OBLIGATOIRE dans handleChangeStartYear (RseAppShell)
// 1. Décaler les données de l'app EN PREMIER (avant que selectedYear change)
if (yearShiftHandlerRef.current) {
  await yearShiftHandlerRef.current(delta)
}
// 2. Puis décaler rse_years (met à jour years + selectedYear → recharge le contenu)
await changeStartYear(newStartYear)
```

**Raison** : `changeStartYear` met à jour `selectedYear`, ce qui déclenche un rechargement du composant app. Si les données ne sont pas encore décalées à ce moment, le composant crée un enregistrement vide et entre en conflit avec le décalage tardif.

### 5. `setYearShiftHandler` — obligatoire pour toute app avec données par année

```typescript
// Dans chaque composant app RSE qui stocke des données par année :
useEffect(() => {
  ctx.setYearShiftHandler(async (delta: number) => {
    if (!org?.id) return
    await fetch('/api/[mon-app]/shift-year', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: org.id, delta }),
    })
  })
  return () => { ctx.setYearShiftHandler(null) }
}, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps
```

**Route API correspondante** (modèle) :
```typescript
// PATCH /api/[app]/shift-year
// Body: { org_id: string, delta: number }
// Action: UPDATE table SET year = year + delta WHERE user_id = user.id AND organisation_id = org_id
```

### 6. Prompt première année — comportement obligatoire

Quand `selectedOrg !== null && !yearsLoading && years.length === 0` :  
→ Afficher `<FirstYearPrompt>` à la place du contenu app  
→ Ne JAMAIS afficher le contenu app sans qu'une année soit sélectionnée  
→ Ce comportement est géré par `RseAppShell`, les apps enfant n'ont rien à faire

### 7. Chargement données par org ET par année

```typescript
// ✅ CORRECT — recharger quand org OU year change
useEffect(() => {
  if (!org) return
  loadData(org.id, year)
}, [org?.id, year]) // eslint-disable-line react-hooks/exhaustive-deps

// API call : toujours passer org_id ET year
fetch(`/api/mon-app?org_id=${org.id}&year=${year}`)
```

---

## Système d'icônes — règles

- **Source unique** : `src/components/ui/Icon.tsx`
- Toujours utiliser `<Icon name="..." size={n} />` — jamais d'SVG inline ad hoc
- Pour ajouter une icône : l'ajouter dans le `icons` object de `Icon.tsx`
- Mettre à jour `ALL_ICONS` dans `CategoriesManager.tsx` en conséquence
- Icônes disponibles (2025-05) : `app`, `alertTriangle`, `arrowDown`, `arrowUp`, `barChart`, `bell`, `calendarDays`, `check`, `chevronDown`, `chevronLeft`, `chevronRight`, `clock`, `creditCard`, `download`, `edit`, `eye`, `eyeOff`, `file`, `fileText`, `folder`, `folderOpen`, `folderPlus`, `grid`, `home`, `image`, `infinity`, `info`, `key`, `list`, `lock`, `logout`, `menu`, `monitor`, `moon`, `moreVertical`, `move`, `pencil`, `plus`, `search`, `send`, `settings`, `share`, `shield`, `shieldCheck`, `star`, `starFilled`, `sun`, `tag`, `ticket`, `trash`, `upload`, `user`, `video`, `x`

---

## Sidebar & Menu — règles

- Le menu est chargé par `useApps(isAdmin)` dans `AppShell` et `RseAppShell`
- Après toute modification admin (save/delete/move), appeler `broadcastAppsUpdate()` de `@/hooks/useApps`
- Les favoris sont gérés par `useFavorites(profile?.id)` **à l'intérieur de `Sidebar.tsx`** — ne pas le déplacer
- Stockage favoris : `localStorage` clé `fav_apps_{userId}`, synchronisé via `BroadcastChannel`

---

## Variables CSS — palette obligatoire

```css
--bg            /* fond principal */
--bg-card       /* fond des cartes/modals */
--bg-sidebar    /* fond sidebar + topbar */
--text          /* texte principal */
--text-muted    /* texte secondaire */
--text-subtle   /* texte très discret (labels catégories) */
--accent        /* couleur d'accentuation (indigo par défaut #6366f1) */
--border        /* couleur des bordures */
```

> Ne jamais hard-coder des couleurs là où une variable CSS existe.  
> Toujours préférer `style={{ color: 'var(--text)' }}` plutôt que des classes Tailwind de couleur.

---

## Supabase — patterns obligatoires

```typescript
// Client côté navigateur
import { createClient } from '@/lib/supabase/client'

// Client côté serveur (Server Components, Route Handlers)
import { createClient } from '@/lib/supabase/server'

// Client admin (contourne RLS — Route Handlers uniquement)
import { createAdminClient } from '@/lib/supabase/admin'
```

- Les Route Handlers exposés à l'utilisateur vérifient toujours l'auth : `const { data: { user } } = await supabase.auth.getUser()`
- Les opérations sensibles utilisent `createAdminClient()` côté serveur uniquement
- Jamais de clé `service_role` côté client

---

## Admin — CategoriesManager

- Champ icône : `<IconPicker>` visuel (grille + recherche) — ne jamais revenir à un `<input type="text">`
- Après chaque opération CRUD : appeler `reload()` ET `broadcastAppsUpdate()`
- Le menu se met à jour en temps réel via `BroadcastChannel` + `CustomEvent` — pas besoin de Supabase Realtime

---

## Fichiers — SharePoint exclusivement

```
src/lib/sharepoint.ts                        ← client Graph API (DriveID-based)
src/app/api/sharepoint/files/route.ts        ← CRUD fichiers/dossiers
src/app/api/sharepoint/upload-session/route.ts ← upload chunké
src/app/api/sharepoint/download/route.ts     ← proxy download authentifié
src/hooks/useSharePointFolder.ts             ← auto-création chemins
src/components/ui/SharePointBrowser.tsx      ← browser UI
src/components/ui/FileUpload.tsx             ← widget drag-and-drop
```

Variables d'environnement requises :
```
MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
SHAREPOINT_DRIVE_ID, SHAREPOINT_BASE_FOLDER_NAME
```

---

## Pièges connus (ne pas reproduire)

| Piège | Cause | Solution |
|---|---|---|
| Diagnostic vide après shift d'année | `selectedYear` change avant le shift des données | Appeler `yearShiftHandler` AVANT `changeStartYear` |
| Sidebar ne se met pas à jour après admin | Supabase Realtime non configuré | Utiliser `broadcastAppsUpdate()` |
| ESLint `'Interface' is defined but never used` | CRLF + interface utilisée comme type générique | Ajouter `// eslint-disable-next-line` sur la ligne d'interface |
| App RSE affiche contenu sans organisation | Pas de guard sur `org === null` | `RseAppShell` gère ça, les enfants reçoivent `ctx.org` potentiellement null |
| Données année N+1 chargées sur N | `useEffect` avec mauvaises deps | Dépendre de `[org?.id, year]` explicitement |

---

## Checklist — ajouter une nouvelle app RSE

- [ ] Page dans `src/app/rse/[slug]/page.tsx` qui utilise `<RseAppShell appSlug="...">`
- [ ] Composant enfant reçoit `ctx: RseContext`
- [ ] Enregistre `ctx.setYearShiftHandler(...)` si données par année
- [ ] Retourne `ctx.setYearShiftHandler(null)` dans le cleanup
- [ ] Route API `PATCH /api/[slug]/shift-year` avec body `{ org_id, delta }`
- [ ] Route API `GET /api/[slug]?org_id=&year=` filtre bien sur les deux
- [ ] Route API `POST /api/[slug]` crée un enregistrement avec `year`
- [ ] Icône de l'app présente dans `Icon.tsx`
- [ ] App déclarée dans Supabase via l'admin panel (`/admin/categories`)
- [ ] Abonnement vérifié dans les routes API si app payante
