import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Client serveur pour Server Components (cookies async — Next.js 14/15) */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {}
      },
    },
  })
}

/** Client serveur pour Route Handlers (cookies sync — lecture seule) */
export function createRouteClient() {
  const cookieStore = cookies()
  return createServerClient(URL, KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
}
