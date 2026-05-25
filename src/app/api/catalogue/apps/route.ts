import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()

    const { data: categories, error: catError } = await admin
      .from('app_categories')
      .select('id, name, slug, order_index')
      .order('order_index', { ascending: true })

    if (catError) throw catError

    const { data: apps, error: appError } = await admin
      .from('apps')
      .select('id, name, slug, description, icon, route, category_id, order_index, is_active')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (appError) throw appError

    // Regroupe apps par catégorie (exclut Administration)
    const result = (categories ?? [])
      .filter(c => c.slug !== 'administration')
      .map(cat => ({
        ...cat,
        apps: (apps ?? []).filter(a => a.category_id === cat.id),
      }))
      .filter(c => c.apps.length > 0)

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
