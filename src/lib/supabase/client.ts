import { createBrowserClient } from '@supabase/ssr'

// Singleton — une seule instance par onglet navigateur pour éviter les
// conflits de lock sur le token d'authentification (@supabase/gotrue-js)
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
