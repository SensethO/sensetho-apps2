#!/usr/bin/env node
/**
 * Garde-fou anti-surconsommation (exécuté avant chaque build, y compris sur Vercel).
 *
 * Contexte : le 30/07/2026, des boucles `setInterval` à 2-4 s qui continuaient de tourner
 * onglet en arrière-plan ont épuisé le quota d'egress Supabase (5 Go) et le crédit Vercel.
 *
 * Ce script échoue le build si un rafraîchissement périodique risqué est réintroduit :
 *   1. `setInterval` avec un délai < MIN_MS dans un composant/hook client ;
 *   2. `setInterval` qui déclenche un appel réseau sans garde `document.hidden`.
 * La solution recommandée est le hook `usePolling` (src/hooks/usePolling.ts), qui applique
 * pause en arrière-plan, plancher d'intervalle et ralentissement adaptatif.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath : indispensable pour les chemins contenant des espaces (« OneDrive - … »).
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'src')
const MIN_MS = 8000
// Fichiers autorisés à utiliser setInterval librement (minuteurs d'UI, pas de réseau).
const ALLOWLIST = [
  'hooks/usePolling.ts',              // l'implémentation elle-même
  'components/apps/AgriTracker/index.tsx', // carrousel d'images (aucun appel réseau)
  'components/apps/SecureScoreM365/index.tsx', // device-auth : polling court imposé par Microsoft, borné
]

const files = []
;(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e)) files.push(p)
  }
})(SRC)

const NETWORK = /\b(fetch\s*\(|supabase|\.from\s*\(|axios)/
const problems = []

for (const file of files) {
  const rel = relative(SRC, file).replace(/\\/g, '/')
  if (ALLOWLIST.includes(rel)) continue
  const src = readFileSync(file, 'utf8')
  if (!src.includes('setInterval(')) continue

  const lines = src.split('\n')
  lines.forEach((line, i) => {
    // Seuls les *appels* comptent : `ReturnType<typeof setInterval>` est une annotation de type.
    const call = line.replace(/typeof\s+setInterval/g, '')
    if (!/setInterval\s*\(/.test(call)) return
    // Fenêtre : la ligne + les 12 suivantes (corps du callback et son délai).
    const block = lines.slice(i, i + 13).join('\n')
    const delay = [...block.matchAll(/,\s*([0-9][0-9_]*)\s*\)/g)].map(m => Number(m[1].replace(/_/g, '')))
    const ms = delay.length ? Math.min(...delay) : null
    const doesNetwork = NETWORK.test(block)
    const hasGuard = /document\.hidden|visibilityState/.test(block)

    if (ms !== null && ms < MIN_MS && doesNetwork) {
      problems.push(`${rel}:${i + 1} — setInterval à ${ms} ms avec appel réseau (minimum ${MIN_MS} ms).`)
    } else if (doesNetwork && !hasGuard) {
      problems.push(`${rel}:${i + 1} — setInterval avec appel réseau sans garde « document.hidden ».`)
    }
  })
}

if (problems.length) {
  console.error('\n❌ Contrôle anti-surconsommation : ' + problems.length + ' problème(s)\n')
  problems.forEach(p => console.error('   • ' + p))
  console.error(`
   Utilisez le hook usePolling :

       import { usePolling } from '@/hooks/usePolling'
       usePolling(async () => { /* ... */ return changed }, { intervalMs: 15_000 })

   Il met en pause en arrière-plan, impose un intervalle plancher et espace
   automatiquement les appels quand rien ne change.
`)
  process.exit(1)
}

console.log(`✅ Contrôle anti-surconsommation : ${files.length} fichiers analysés, aucun polling risqué.`)
