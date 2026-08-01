import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Annuaires Microsoft autorisés à se connecter en SSO.
 *
 * Le middleware n'authentifie pas les routes /api/ : requireAdmin s'en charge
 * ici, et distingue une base injoignable d'un refus de droits.
 */

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET() {
  const refus = await requireAdmin()
  if (refus) return refus
  const { data, error } = await createAdminClient()
    .from('sso_tenants').select('*').order('nom')
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ tenants: data ?? [] })
}

export async function POST(req: NextRequest) {
  const refus = await requireAdmin()
  if (refus) return refus
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const tenantId = String(body?.tenant_id ?? '').trim().toLowerCase()
  const nom = String(body?.nom ?? '').trim()

  // Un identifiant mal saisi ne bloquerait rien tout de suite : il créerait une
  // entrée inerte, et l'administrateur croirait l'organisation autorisée.
  if (!GUID.test(tenantId)) {
    return NextResponse.json({ error: 'Identifiant d’annuaire invalide : il doit être un GUID (36 caractères).' }, { status: 400 })
  }
  if (!nom) return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })

  const domaines = String(body?.domaines ?? '')
    .split(',').map(d => d.trim().toLowerCase()).filter(Boolean)

  const { data, error } = await createAdminClient()
    .from('sso_tenants')
    .insert({ tenant_id: tenantId, nom, domaines, org_id: body?.org_id ?? null, notes: body?.notes ?? null })
    .select().single()
  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'Cet annuaire est déjà déclaré.' : error.message },
      { status: error.code === '23505' ? 409 : 502 },
    )
  }
  return NextResponse.json({ tenant: data })
}

export async function PATCH(req: NextRequest) {
  const refus = await requireAdmin()
  if (refus) return refus
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const champs: Record<string, unknown> = {}
  if (typeof body?.actif === 'boolean') champs.actif = body.actif
  if (typeof body?.nom === 'string' && body.nom.trim()) champs.nom = body.nom.trim()
  if (typeof body?.notes === 'string') champs.notes = body.notes
  if (!Object.keys(champs).length) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('sso_tenants').update(champs).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ tenant: data })
}

export async function DELETE(req: NextRequest) {
  const refus = await requireAdmin()
  if (refus) return refus
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  const { error } = await createAdminClient().from('sso_tenants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ ok: true })
}
