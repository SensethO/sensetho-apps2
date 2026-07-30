/**
 * POST /api/le-miroir/[campagneId]/invitations/envoyer
 * Envoie les liens d'invitation du Miroir par Microsoft Graph.
 *
 * ═══ TRANSACTIONNEL PAR CONSTRUCTION ═══
 * Le corps du message n'est PAS paramétrable : il est composé ici, côté serveur,
 * à partir des seules données de la campagne (organisation, année, cellule,
 * libellé du participant, lien). Aucun texte libre n'est accepté depuis le
 * client — cette route ne peut donc pas servir à envoyer un message commercial.
 *
 * Garde-fous de délivrabilité (tirés du retour d'expérience « mise en spam ») :
 *  - AUCUN pixel de suivi (l'ouverture du lien est déjà tracée par used_at)
 *  - AUCUN en-tête List-Unsubscribe : ce n'est pas du courrier de masse, et le
 *    déclarer tel quel suffit à faire basculer le message en indésirable
 *  - texte brut d'abord, HTML minimal, aucune image, un seul lien, zéro
 *    vocabulaire promotionnel
 *  - Reply-To = le responsable de la campagne (un humain répond)
 *  - cadence lente (1,2 s entre deux envois) et lot borné à 40 destinataires
 *  - envoi refusé si la collecte est close
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/msGraph'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOT_MAX = 40
const PAUSE_MS = 1200
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const emailValide = (e: unknown) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

/** Corps du message — figé. Aucune entrée client n'y accède. */
function composer(o: {
  organisation: string; annee: number; lien: string
  cellule: string | null; label: string | null; externe: boolean
}) {
  const bonjour = o.label ? `Bonjour ${o.label},` : 'Bonjour,'
  const cadre = o.externe
    ? `${o.organisation} mène une démarche d'observation interne et souhaite y recueillir votre regard extérieur.`
    : `${o.organisation} lance une démarche d'observation de son fonctionnement (campagne ${o.annee}).`
  const contexte = o.cellule ? `\nVous participez avec le groupe « ${o.cellule} ».\n` : '\n'

  const text = [
    bonjour, '',
    cadre,
    "Vous êtes invité à décrire l'entreprise et ce qui l'entoure avec vos mots — comptez 5 à 10 minutes.",
    contexte,
    'Votre lien personnel :',
    o.lien, '',
    'Ce que vous écrirez est anonyme : vos réponses ne sont jamais rattachées à votre nom, rien ne remonte',
    "à votre évaluation, et un sujet n'est restitué qu'à partir de 4 regards. Les règles complètes sont",
    'rappelées au début du questionnaire.',
    '',
    'Ce lien vous est personnel : merci de ne pas le transmettre.',
    '',
    "Pour toute question, répondez simplement à ce message.",
  ].join('\n')

  // HTML minimal : pas d'image, pas de mise en page marketing, un seul lien.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222;line-height:1.5">
<p>${esc(bonjour)}</p>
<p>${esc(cadre)}<br>Vous êtes invité à décrire l'entreprise et ce qui l'entoure avec vos mots — comptez 5 à 10 minutes.</p>
${o.cellule ? `<p>Vous participez avec le groupe « ${esc(o.cellule)} ».</p>` : ''}
<p>Votre lien personnel :<br><a href="${o.lien}">${o.lien}</a></p>
<p style="color:#555">Ce que vous écrirez est anonyme : vos réponses ne sont jamais rattachées à votre nom, rien ne remonte à votre évaluation, et un sujet n'est restitué qu'à partir de 4 regards. Les règles complètes sont rappelées au début du questionnaire.</p>
<p style="color:#555">Ce lien vous est personnel : merci de ne pas le transmettre.</p>
<p>Pour toute question, répondez simplement à ce message.</p>
</div>`
  return { text, html }
}

export async function POST(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: camp } = await admin.from('le_miroir_campagnes')
      .select('id, org_id, annee, statut, owner_id').eq('id', params.campagneId).single()
    if (!camp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (camp.owner_id !== user.id) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (camp.statut !== 'collecte') {
      return NextResponse.json({ error: 'La collecte est close : aucun envoi.' }, { status: 409 })
    }

    // Cibles : uniquement des invitations de CETTE campagne, jamais une adresse libre.
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.invitation_ids) ? body.invitation_ids.slice(0, LOT_MAX) : []
    let q = admin.from('le_miroir_invitations')
      .select('id, token, email, label, kind, cellule_id, sent_at, sent_count, revoked')
      .eq('campagne_id', params.campagneId).eq('revoked', false).not('email', 'is', null)
    if (ids.length) q = q.in('id', ids)
    else q = q.is('sent_at', null)         // par défaut : ce qui n'a jamais été envoyé
    const { data: invitations } = await q.limit(LOT_MAX)
    if (!invitations?.length) {
      return NextResponse.json({ error: 'Aucune invitation à envoyer (adresse manquante, déjà envoyée ou révoquée).' }, { status: 400 })
    }

    const [{ data: org }, { data: cellules }, { data: prof }] = await Promise.all([
      admin.from('organisations').select('denomination').eq('id', camp.org_id).maybeSingle(),
      admin.from('le_miroir_cellules').select('id, nom').eq('campagne_id', camp.id),
      admin.from('profiles').select('full_name').eq('id', camp.owner_id).maybeSingle(),
    ])
    const organisation = org?.denomination ?? "l'organisation"
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    const nomCellule = (id: string | null) => cellules?.find((c) => c.id === id)?.nom ?? null

    const envoyes: string[] = []
    const echecs: { email: string; erreur: string }[] = []

    for (const inv of invitations) {
      const email = String(inv.email).trim()
      if (!emailValide(email)) { echecs.push({ email, erreur: 'adresse invalide' }); continue }
      const { text, html } = composer({
        organisation, annee: camp.annee,
        lien: `${base}/miroir/${inv.token}`,
        cellule: nomCellule(inv.cellule_id),
        label: inv.label,
        externe: inv.kind === 'externe',
      })
      try {
        await sendEmail(
          email,
          `Le Miroir — votre regard sur ${organisation}`,
          html,
          {
            // Note : Exchange Online remplace ce nom d'affichage par celui de la
            // boîte d'envoi (constaté chez un destinataire externe). Conservé au
            // cas où l'envoi passerait un jour par une autre voie.
            fromName: prof?.full_name ? `${prof.full_name} (via Sens'ethO)` : "Sens'ethO",
            // Pas de Reply-To : les réponses reviennent à la boîte d'envoi
            // (web@sensetho.com). From et Reply-To alignés — un écart entre les
            // deux est un motif d'hameçonnage que certains filtres pénalisent.
            // Décision du 2026-07-30 : la boîte partagée relève les questions.
            textBody: text,
            // Volontairement aussi : aucun en-tête de liste de diffusion, aucun pixel.
          }
        )
        await admin.from('le_miroir_invitations')
          .update({ sent_at: new Date().toISOString(), sent_count: (inv.sent_count ?? 0) + 1 })
          .eq('id', inv.id)
        envoyes.push(email)
      } catch (e) {
        echecs.push({ email, erreur: String(e).slice(0, 200) })
      }
      await pause(PAUSE_MS)   // cadence lente : on n'imite pas un envoi de masse
    }

    return NextResponse.json({
      envoyes: envoyes.length, echecs,
      note: echecs.length ? "Vérifiez la permission Mail.Send de l'application dans Azure AD." : undefined,
    })
  } catch (err) {
    console.error('[le-miroir/invitations/envoyer]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
