'use client'

/**
 * Page publique d'invitation au miroir — /miroir/[token]
 * Aucun compte requis : le jeton du lien authentifie le participant.
 * Contrat de règles → identité fonctionnelle → parcours de peinture (le même
 * que dans l'app) → confirmation. Le miroir reste voilé : rien des autres
 * participants n'est jamais affiché ici.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Observer, type NewPortrait, type Etre } from '@/components/apps/LeMiroirObserver'
import { CONTRAT_REGLES, SEUIL_RESTITUTION, type EtreKind } from '@/lib/leMiroir'

interface Contexte {
  campagne: { annee: number; statut: string; organisation: string }
  invitation: { label: string | null; kind: 'interne' | 'externe'; cote: string | null }
  cellule: { nom: string; perimetre: string | null } | null
  socle: { etres?: string[]; son_service?: boolean } | null
  cascade: { key: string; label: string; kind: EtreKind; cote?: string | null }[]
  participant: { id: string; nom: string | null; poste: string | null; service: string | null; regles_acceptees: boolean } | null
  mesPortraits: number
}

const card = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' } as const

export default function MiroirPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [ctx, setCtx] = useState<Contexte | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [envoyes, setEnvoyes] = useState(0)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const r = await fetch(`/api/le-miroir/public/${token}`)
      const d = await r.json()
      if (!r.ok) { setErreur(d.error || 'Lien invalide.'); setCtx(null) }
      else { setCtx(d as Contexte); setEnvoyes((d as Contexte).mesPortraits) }
    } catch { setErreur('Impossible de charger cette invitation.') }
    setChargement(false)
  }, [token])

  useEffect(() => { charger() }, [charger])

  if (chargement) return <Centre>Chargement de votre invitation…</Centre>
  if (erreur || !ctx) return (
    <Centre>
      <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Ce lien n&apos;est pas valide</div>
      <p className="text-sm">{erreur ?? 'Lien inconnu ou révoqué.'} Demandez un nouveau lien au responsable de la campagne.</p>
    </Centre>
  )

  if (ctx.campagne.statut !== 'collecte') return (
    <Centre>
      <div className="text-3xl mb-3">🪞</div>
      <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>La collecte est close</div>
      <p className="text-sm">La campagne {ctx.campagne.annee} de {ctx.campagne.organisation} est passée en restitution. Merci de votre participation.</p>
    </Centre>
  )

  const dejaDeclare = Boolean(ctx.participant?.regles_acceptees)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Entete ctx={ctx} envoyes={envoyes} />
      <div className="max-w-4xl mx-auto px-4 pb-16">
        {!dejaDeclare
          ? <Accueil ctx={ctx} token={token} onFait={charger} />
          : <Peinture ctx={ctx} token={token} onEnvoye={() => setEnvoyes((n) => n + 1)} />}
      </div>
    </div>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-md text-center" style={{ color: 'var(--text-muted)' }}>{children}</div>
    </div>
  )
}

function Entete({ ctx, envoyes }: { ctx: Contexte; envoyes: number }) {
  return (
    <div className="border-b mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="font-semibold" style={{ color: 'var(--text)' }}>🪞 Le Miroir — {ctx.campagne.organisation}</div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Campagne {ctx.campagne.annee}
            {ctx.cellule && <> · Cellule <b>{ctx.cellule.nom}</b>{ctx.cellule.perimetre ? ` (${ctx.cellule.perimetre})` : ''}</>}
            {ctx.invitation.kind === 'externe' && ' · Regard extérieur'}
          </div>
        </div>
        {envoyes > 0 && (
          <span className="ml-auto text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--accent)' }}>
            {envoyes} portrait{envoyes > 1 ? 's' : ''} envoyé{envoyes > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function Accueil({ ctx, token, onFait }: { ctx: Contexte; token: string; onFait: () => void }) {
  const [nom, setNom] = useState(ctx.participant?.nom ?? ctx.invitation.label ?? '')
  const [poste, setPoste] = useState(ctx.participant?.poste ?? '')
  const [service, setService] = useState(ctx.participant?.service ?? '')
  const [accepte, setAccepte] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const externe = ctx.invitation.kind === 'externe'

  async function valider() {
    setBusy(true); setMsg(null)
    const r = await fetch(`/api/le-miroir/public/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, poste, service, regles_acceptees: true }),
    })
    const d = await r.json(); setBusy(false)
    if (!r.ok) { setMsg(d.error || 'Échec.'); return }
    onFait()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Bienvenue dans le miroir</h1>
      <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        Vous allez décrire {externe ? "cette organisation et ce qui l'entoure" : "l'entreprise et ce qui l'entoure"} comme
        des animaux dans leur milieu. Il n&apos;y a pas de bonne réponse ; personne ne sera noté — ni vous, ni vos collègues.
        On cherche l&apos;image la plus juste, pas la plus flatteuse. Comptez 5 à 10 minutes.
      </p>

      <div className="rounded-xl border p-4 mb-3" style={card}>
        <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>📜 Le contrat de règles</div>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-muted)' }}>
          {CONTRAT_REGLES.map((r, i) => <li key={i} className="flex gap-2"><span style={{ color: 'var(--accent)' }}>•</span><span>{r}</span></li>)}
        </ul>
      </div>

      <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-1" />
        <span>J&apos;ai lu le contrat de règles et je m&apos;engage à le respecter.</span>
      </label>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>Comment vous appeler ?</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="prénom ou pseudo"
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
          <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Jamais associé à vos réponses.</div>
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>{externe ? 'Votre rôle' : 'Votre poste'}</label>
          <input value={poste} onChange={(e) => setPoste(e.target.value)}
            placeholder={externe ? 'ex : client, fournisseur' : "ex : chargé d'affaires"}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text)' }}>{externe ? 'Votre organisation' : 'Votre service'}</label>
          <input value={service} onChange={(e) => setService(e.target.value)}
            placeholder={externe ? 'ex : société X' : 'ex : Commercial'}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm" style={card} />
        </div>
      </div>

      {msg && <div className="text-sm mb-3" style={{ color: '#a85b3b' }}>{msg}</div>}
      <button disabled={!accepte || !nom.trim() || busy} onClick={valider}
        className="px-5 py-2.5 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
        {busy ? '…' : 'Commencer'}
      </button>
    </div>
  )
}

function Peinture({ ctx, token, onEnvoye }: { ctx: Contexte; token: string; onEnvoye: () => void }) {
  // Socle imposé par le responsable : ces êtres passent en tête de liste.
  const socleKeys = new Set(ctx.socle?.etres ?? [])
  const monService = ctx.socle?.son_service && ctx.participant?.service ? 'service:' + ctx.participant.service : null
  if (monService) socleKeys.add(monService)

  const etres: Etre[] = [
    ...ctx.cascade.filter((e) => socleKeys.has(e.key)),
    ...ctx.cascade.filter((e) => !socleKeys.has(e.key)),
  ]
  const socleLabels = ctx.cascade.filter((e) => socleKeys.has(e.key)).map((e) => e.label)

  return (
    <>
      {socleLabels.length > 0 && (
        <div className="rounded-xl border p-3 mb-4 text-sm" style={{ ...card, color: 'var(--text-muted)' }}>
          <b style={{ color: 'var(--text)' }}>Ce qui est attendu de vous :</b> {socleLabels.join(' · ')}.
          Vous pouvez ensuite peindre librement les autres êtres que vous côtoyez — un être n&apos;est restitué qu&apos;à
          partir de {SEUIL_RESTITUTION} regards.
        </div>
      )}
      <Observer
        etres={etres}
        isOwner={false}
        myAutoDone={false}
        onSave={async (p: NewPortrait) => {
          const r = await fetch(`/api/le-miroir/public/${token}/portrait`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
          })
          if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.error || 'Échec de l’enregistrement') }
          onEnvoye()
        }}
      />
    </>
  )
}
