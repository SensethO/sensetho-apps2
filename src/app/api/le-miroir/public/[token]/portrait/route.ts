/**
 * POST /api/le-miroir/public/[token]/portrait
 * Enregistre un portrait peint par un participant anonyme (invitation par lien).
 * Le jeton authentifie ; les champs sont validés et contraints aux catalogues.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ESPECES, HABITATS, RELATIONS } from '@/lib/leMiroir'
import { resolveToken } from '../route'

export const dynamic = 'force-dynamic'

const okEspece = (v: unknown) => (typeof v === 'string' && ESPECES.some((e) => e.id === v) ? v : null)
const okHabitat = (v: unknown) => (typeof v === 'string' && HABITATS.some((h) => h.id === v) ? v : null)
const okRelation = (v: unknown) => (typeof v === 'string' && RELATIONS.some((r) => r.id === v) ? v : null)
const okVerdict = (v: unknown) => { const n = Number(v); return n >= 1 && n <= 4 ? Math.round(n) : null }
const texte = (v: unknown, max = 1200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const res = await resolveToken(admin, params.token)
    if (!res) return NextResponse.json({ error: 'Lien invalide ou révoqué.' }, { status: 404 })
    const { inv, camp } = res

    if (camp.statut !== 'collecte') {
      return NextResponse.json({ error: 'La collecte de cette campagne est close.' }, { status: 409 })
    }
    if (!inv.participant_id) {
      return NextResponse.json({ error: 'Déclarez-vous et acceptez le contrat de règles avant de peindre.' }, { status: 409 })
    }
    // Le contrat de règles doit avoir été accepté
    const { data: part } = await admin.from('le_miroir_participants')
      .select('regles_acceptees').eq('id', inv.participant_id).maybeSingle()
    if (!part?.regles_acceptees) {
      return NextResponse.json({ error: 'Le contrat de règles doit être accepté.' }, { status: 409 })
    }

    const b = await req.json()
    const espece = okEspece(b.espece_id)
    if (!espece) return NextResponse.json({ error: 'Espèce invalide.' }, { status: 400 })
    const etreKey = texte(b.etre_key, 120)
    if (!etreKey) return NextResponse.json({ error: 'Être manquant.' }, { status: 400 })

    // L'être doit appartenir à la cascade de la campagne (pas d'injection d'être arbitraire)
    const { data: parts } = await admin.from('le_miroir_participants').select('service').eq('campagne_id', camp.id)
    const { data: etres } = await admin.from('le_miroir_etres').select('id, kind').eq('campagne_id', camp.id)
    const clesValides = new Set<string>([
      'entreprise',
      ...((parts ?? []).map((p) => 'service:' + p.service).filter((s) => s !== 'service:null')),
      ...((etres ?? []).map((e) => (e.kind === 'poste' ? 'poste:' : 'pp:') + e.id)),
    ])
    if (!clesValides.has(etreKey)) return NextResponse.json({ error: 'Être hors de la campagne.' }, { status: 400 })

    const { error } = await admin.from('le_miroir_portraits').insert({
      campagne_id: camp.id,
      user_id: null,
      participant_id: inv.participant_id,
      etre_key: etreKey,
      etre_label: texte(b.etre_label, 160) ?? etreKey,
      espece_id: espece,
      espece_cite_id: okEspece(b.espece_cite_id),
      habitat_marche_id: okHabitat(b.habitat_marche_id),
      habitat_cite_id: okHabitat(b.habitat_cite_id),
      verdict_marche: okVerdict(b.verdict_marche),
      verdict_cite: okVerdict(b.verdict_cite),
      milieu_libre: texte(b.milieu_libre),
      relation: okRelation(b.relation),
      signaux: texte(b.signaux),
      dedicace: texte(b.dedicace),
      justification: texte(b.justification),
      kind: 'individuel',                       // un lien public n'est jamais le portrait de référence
      methode: b.ia ? 'ia' : 'manuel',
      prompt: b.prompt ?? null,
      ia: b.ia ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
