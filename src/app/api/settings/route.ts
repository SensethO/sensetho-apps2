import { NextResponse } from 'next/server'
import { getSiteSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** Public endpoint — returns all site settings merged with defaults.
 *  Used by the homepage and public-facing pages. */
export async function GET() {
  const settings = await getSiteSettings()
  return NextResponse.json({ data: settings })
}
