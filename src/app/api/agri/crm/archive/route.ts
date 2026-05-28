export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { makeSvc, getUser, checkPlantationAccess } from '../_auth'

interface Attachment {
  name: string
  path?: string
  mime?: string
  size?: number
}

interface CrmMessage {
  id: string
  plantation_id: string
  acheteur_user_id: string | null
  sender_user_id: string
  sender_nom: string | null
  content: string
  attachments: Attachment[] | null
  created_at: string
}

interface Profile {
  id: string
  email: string | null
  full_name: string | null
}

function formatDateParis(isoString: string): string {
  return new Date(isoString).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConversation(messages: CrmMessage[]): string {
  return messages
    .map((m) => {
      const dateStr = formatDateParis(m.created_at)
      const sender = m.sender_nom ?? 'Inconnu'
      let line = `[${dateStr}] ${sender} : ${m.content}`
      const atts = (m.attachments ?? []).filter((a) => a.name)
      if (atts.length > 0) {
        line += '  📎 ' + atts.map((a) => a.name).join(', ')
      }
      return line
    })
    .join('\n')
}

// POST /api/agri/crm/archive
export async function POST(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { plantation_id, acheteur_user_id, label } = body as {
      plantation_id?: string
      acheteur_user_id?: string
      label?: string
    }

    if (!plantation_id || !acheteur_user_id) {
      return NextResponse.json({ error: 'plantation_id et acheteur_user_id requis' }, { status: 400 })
    }

    const svc = makeSvc()
    const { allowed, isOwner, isAdmin } = await checkPlantationAccess(svc, user.id, plantation_id)

    if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Archivage réservé au propriétaire ou à un administrateur' }, { status: 403 })
    }

    // Fetch messages
    const { data: messages, error: msgErr } = await svc
      .from('agri_crm_messages')
      .select('id, plantation_id, acheteur_user_id, sender_user_id, sender_nom, content, attachments, created_at')
      .eq('plantation_id', plantation_id)
      .eq('acheteur_user_id', acheteur_user_id)
      .order('created_at', { ascending: true })

    if (msgErr) throw new Error(msgErr.message)
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Aucun message à archiver' }, { status: 404 })
    }

    // Fetch acheteur profile
    const { data: acheteurProfile } = await svc
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', acheteur_user_id)
      .maybeSingle()

    const profile = acheteurProfile as Profile | null
    const acheteurNom =
      profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Acheteur'

    // Build titre
    const todayStr = new Date().toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const titre = label?.trim() || `Échanges du ${todayStr} — ${acheteurNom}`

    // Format contenu
    const contenu = formatConversation(messages as CrmMessage[])

    // Collecter toutes les pièces jointes (dédupliquées par path)
    const seenPaths = new Set<string>()
    const fichiers: Array<{ name: string; item_id: string; mime: string; size: number }> = []
    for (const m of messages as CrmMessage[]) {
      for (const att of m.attachments ?? []) {
        if (att.path && !seenPaths.has(att.path)) {
          seenPaths.add(att.path)
          fichiers.push({
            name: att.name,
            item_id: att.path, // item_id utilisé comme path Supabase Storage
            mime: att.mime ?? 'application/octet-stream',
            size: att.size ?? 0,
          })
        }
      }
    }

    // Insert note — acheteur_user_id stocké pour filtrage de confidentialité
    const { data: note, error: insertErr } = await svc
      .from('agri_crm_notes')
      .insert({
        plantation_id,
        acheteur_user_id,   // identifie les participants → note privée
        titre,
        contenu,
        fichiers,
        created_by: user.id,
        created_by_nom: 'Archivage CRM',
      })
      .select('*')
      .single()

    if (insertErr) throw new Error(insertErr.message)

    // Supprimer les messages archivés de l'onglet Messages
    const msgIds = (messages as CrmMessage[]).map((m) => m.id)
    const { error: delErr } = await svc
      .from('agri_crm_messages')
      .delete()
      .in('id', msgIds)

    if (delErr) {
      // Log mais ne pas bloquer — la note est créée, on retourne quand même succès
      console.error('[archive] Erreur suppression messages:', delErr.message)
    }

    return NextResponse.json({ note })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
