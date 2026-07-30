/**
 * Invitations par lien (le responsable de campagne) — /api/le-miroir/[campagneId]/invitations
 *
 * GET    → liste des invitations (avec l'état d'usage et le participant rattaché)
 * POST   → crée N invitations { nombre, cellule_id?, label?, kind, cote? }
 * DELETE → révoque une invitation (?invitation_id=…) — le lien cesse de fonctionner
 *
 * Le token est le secret : il n'est lisible que par le responsable (RLS owner-only)
 * et sert de clé d'accès à la page publique /miroir/[token].
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function assertOwner(userId: string, campagneId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('le_miroir_campagnes').select('owner_id').eq('id', campagneId).single()
  if (data?.owner_id === userId) return true
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).single()
  return prof?.role === 'admin'
}

export async function GET(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data } = await admin
      .from('le_miroir_invitations')
      .select('id, token, label, email, kind, cote, cellule_id, participant_id, revoked, used_at, sent_at, sent_count, created_at')
      .eq('campagne_id', params.campagneId)
      .order('created_at')
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const kind: 'interne' | 'externe' = body.kind === 'externe' ? 'externe' : 'interne'
    const cote = ['marche', 'cite', 'groupe'].includes(body.cote) ? body.cote : null
    const celluleId = body.cellule_id || null
    const labelBase = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null
    const lien = () => randomBytes(18).toString('base64url')

    // Deux modes : une liste d'adresses (un lien par personne, prêt à envoyer)
    // ou un simple nombre de liens anonymes à distribuer soi-même.
    const emails: string[] = Array.isArray(body.emails)
      ? body.emails.map((e: unknown) => String(e).trim().toLowerCase())
          .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
          .slice(0, 40)
      : []

    const rows = emails.length
      ? emails.map((email) => ({
          campagne_id: params.campagneId, cellule_id: celluleId, token: lien(),
          email,
          // Le label sert d'accroche personnelle (« Bonjour Marc, ») : il est TOUJOURS
          // déduit de l'adresse, jamais du libellé de groupe — sinon tous les
          // destinataires d'un même lot recevraient la même salutation.
          label: email.split('@')[0].split(/[._-]/)[0].replace(/^./, (c) => c.toUpperCase()) || null,
          kind, cote: kind === 'externe' ? cote : null,
        }))
      : Array.from({ length: Math.min(Math.max(Number(body.nombre) || 1, 1), 40) }, (_, i, a) => ({
          campagne_id: params.campagneId, cellule_id: celluleId, token: lien(),
          email: null,
          label: labelBase ? (a.length > 1 ? `${labelBase} ${i + 1}` : labelBase) : null,
          kind, cote: kind === 'externe' ? cote : null,
        }))

    const admin = createAdminClient()
    const { data, error } = await admin.from('le_miroir_invitations').insert(rows).select('id, token, label, kind, cote, cellule_id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwner(user.id, params.campagneId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const id = new URL(req.url).searchParams.get('invitation_id')
    if (!id) return NextResponse.json({ error: 'invitation_id manquant' }, { status: 400 })

    const admin = createAdminClient()
    // On révoque plutôt qu'on supprime : le portrait déjà peint reste rattaché à son participant.
    const { error } = await admin.from('le_miroir_invitations')
      .update({ revoked: true }).eq('id', id).eq('campagne_id', params.campagneId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
