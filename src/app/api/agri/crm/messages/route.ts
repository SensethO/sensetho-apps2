export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { makeSvc, getUser, checkPlantationAccess } from '../_auth'

// GET /api/agri/crm/messages?plantation_id=xxx&acheteur_user_id=yyy
export async function GET(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const plantationId = searchParams.get('plantation_id')
    const acheteurUserId = searchParams.get('acheteur_user_id')
    if (!plantationId || !acheteurUserId) return NextResponse.json({ error: 'plantation_id et acheteur_user_id requis' }, { status: 400 })

    const svc = makeSvc()
    const { allowed, isOwner } = await checkPlantationAccess(svc, user.id, plantationId)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Confidentialité absolue : seuls le planteur (owner) et l'acheteur
    // impliqué dans la conversation peuvent lire les messages.
    // Même un admin non-participant n'y a pas accès.
    if (!isOwner && user.id !== acheteurUserId) {
      return NextResponse.json({ error: 'Accès refusé — conversation privée' }, { status: 403 })
    }

    const { data } = await svc
      .from('agri_crm_messages')
      .select('*')
      .eq('plantation_id', plantationId)
      .eq('acheteur_user_id', acheteurUserId)
      .order('created_at', { ascending: true })

    // Marquer comme lu
    const unread = (data ?? []).filter((m: { lu_par: string[] }) => !((m.lu_par as string[]) ?? []).includes(user.id))
    for (const m of unread) {
      const updated = [...((m.lu_par as string[]) ?? []), user.id]
      await svc.from('agri_crm_messages').update({ lu_par: updated }).eq('id', m.id)
    }

    return NextResponse.json({ messages: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/agri/crm/messages
export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { plantation_id, acheteur_user_id, content, attachments } = await req.json()
    if (!plantation_id || !acheteur_user_id || !content?.trim()) return NextResponse.json({ error: 'Champs requis' }, { status: 400 })

    const svc = makeSvc()
    const { allowed, isOwner } = await checkPlantationAccess(svc, user.id, plantation_id)
    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    // Seuls le planteur et l'acheteur concerné peuvent envoyer des messages
    if (!isOwner && user.id !== acheteur_user_id) {
      return NextResponse.json({ error: 'Accès refusé — conversation privée' }, { status: 403 })
    }

    const { data: profile } = await svc.from('profiles').select('email, full_name').eq('id', user.id).maybeSingle()
    const senderNom = (profile as { full_name?: string; email?: string } | null)?.full_name
      || (profile as { full_name?: string; email?: string } | null)?.email
      || user.email || 'Inconnu'

    const { data, error } = await svc
      .from('agri_crm_messages')
      .insert({
        plantation_id,
        acheteur_user_id,
        sender_user_id: user.id,
        sender_nom: senderNom,
        content: content.trim(),
        attachments: attachments ?? [],
        lu_par: [user.id],
      })
      .select('*').single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ message: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
