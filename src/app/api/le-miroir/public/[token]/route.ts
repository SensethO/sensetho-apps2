/**
 * Accès public par lien d'invitation — /api/le-miroir/public/[token]
 *
 * GET  → contexte de la campagne pour ce jeton : organisation, cellule, socle
 *        d'êtres imposés, cascade complète, état du participant.
 * POST → déclare/actualise le participant (nom, poste, service, contrat de règles).
 *
 * Le jeton EST l'authentification : aucune session, aucun compte. Toutes les
 * écritures passent par le service_role après validation du jeton (RLS jamais
 * exposée à l'anonyme). Rien n'est jamais renvoyé sur les autres participants
 * ni sur leurs portraits — le miroir reste voilé pendant la collecte.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface Invitation {
  id: string; campagne_id: string; cellule_id: string | null
  label: string | null; kind: 'interne' | 'externe'; cote: string | null
  participant_id: string | null; revoked: boolean
}

/** Valide le jeton et renvoie l'invitation + la campagne, ou null. */
export async function resolveToken(admin: SupabaseClient, token: string) {
  if (!token || token.length < 10) return null
  const { data: inv } = await admin
    .from('le_miroir_invitations')
    .select('id, campagne_id, cellule_id, label, kind, cote, participant_id, revoked')
    .eq('token', token).maybeSingle()
  if (!inv || (inv as Invitation).revoked) return null
  const { data: camp } = await admin
    .from('le_miroir_campagnes')
    .select('id, org_id, annee, nom, statut, socle')
    .eq('id', (inv as Invitation).campagne_id).maybeSingle()
  if (!camp) return null
  return { inv: inv as Invitation, camp }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const res = await resolveToken(admin, params.token)
    if (!res) return NextResponse.json({ error: 'Lien invalide ou révoqué.' }, { status: 404 })
    const { inv, camp } = res

    const [{ data: org }, { data: cellule }, { data: parts }, { data: etres }] = await Promise.all([
      admin.from('organisations').select('denomination').eq('id', camp.org_id).maybeSingle(),
      inv.cellule_id
        ? admin.from('le_miroir_cellules').select('nom, perimetre').eq('id', inv.cellule_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('le_miroir_participants').select('service').eq('campagne_id', camp.id),
      admin.from('le_miroir_etres').select('id, kind, label, cote').eq('campagne_id', camp.id).order('created_at'),
    ])

    // Le participant déjà créé pour ce jeton (retour sur le lien)
    const { data: moi } = inv.participant_id
      ? await admin.from('le_miroir_participants')
          .select('id, nom, poste, service, regles_acceptees, cellule_id').eq('id', inv.participant_id).maybeSingle()
      : { data: null }

    // Combien de portraits ce participant a-t-il déjà peints (pour l'informer)
    const { count: mesPortraits } = inv.participant_id
      ? await admin.from('le_miroir_portraits')
          .select('id', { count: 'exact', head: true }).eq('participant_id', inv.participant_id)
      : { count: 0 }

    const orgNom = org?.denomination ?? "L'entreprise"
    const services = Array.from(new Set((parts ?? []).map((p) => p.service).filter(Boolean))) as string[]
    const cascade = [
      { key: 'entreprise', label: orgNom, kind: 'entreprise' as const },
      ...services.map((s) => ({ key: 'service:' + s, label: 'Service ' + s, kind: 'service' as const })),
      ...(etres ?? []).filter((e) => e.kind === 'poste').map((e) => ({ key: 'poste:' + e.id, label: e.label as string, kind: 'poste' as const })),
      ...(etres ?? []).filter((e) => e.kind === 'partie_prenante').map((e) => ({ key: 'pp:' + e.id, label: e.label as string, kind: 'partie_prenante' as const, cote: e.cote })),
    ]

    return NextResponse.json({
      campagne: { annee: camp.annee, statut: camp.statut, organisation: orgNom },
      invitation: { label: inv.label, kind: inv.kind, cote: inv.cote },
      cellule: cellule ?? null,
      socle: (camp.socle ?? null) as { etres?: string[]; son_service?: boolean } | null,
      cascade,
      participant: moi ?? null,
      mesPortraits: mesPortraits ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const res = await resolveToken(admin, params.token)
    if (!res) return NextResponse.json({ error: 'Lien invalide ou révoqué.' }, { status: 404 })
    const { inv, camp } = res
    if (camp.statut !== 'collecte') {
      return NextResponse.json({ error: 'La collecte de cette campagne est close.' }, { status: 409 })
    }

    const body = await req.json()
    if (!body.regles_acceptees) return NextResponse.json({ error: 'Le contrat de règles doit être accepté.' }, { status: 400 })
    const champ = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const payload = {
      campagne_id: camp.id,
      cellule_id: inv.cellule_id,
      nom: champ(body.nom) || inv.label || 'Participant',
      poste: champ(body.poste),
      service: champ(body.service),
      regles_acceptees: true,
      is_externe: inv.kind === 'externe',
    }

    let participantId = inv.participant_id
    if (participantId) {
      await admin.from('le_miroir_participants').update(payload).eq('id', participantId)
    } else {
      const { data, error } = await admin.from('le_miroir_participants').insert(payload).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      participantId = data.id
      await admin.from('le_miroir_invitations')
        .update({ participant_id: participantId, used_at: new Date().toISOString() }).eq('id', inv.id)
    }
    return NextResponse.json({ participant_id: participantId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
