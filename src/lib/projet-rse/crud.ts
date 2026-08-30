// Fabrique de routes pour les tables rattachées à un projet.
//
// Les sous-applications partagent la même mécanique : lire, créer, modifier,
// supprimer des lignes appartenant à un projet, sous la même garde. L'écrire
// une fois évite huit fichiers presque identiques — et huit occasions de se
// tromper sur la garde d'autorisation.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireProjet } from '@/lib/projet-rse/auth'
import { lireIdentifiant } from '@/lib/projet-rse/request'
import { messageErreur } from '@/lib/projet-rse/erreurs'

export interface OptionsTable {
  /** Nom de la table Supabase. */
  table: string
  /** Champs acceptés en écriture. */
  champs: readonly string[]
  /** Champ obligatoire à la création, s'il y en a un. */
  requis?: string
  /** Clé de la charge utile renvoyée : { [cle]: … }. */
  cle: string
  /** Tri de la liste. */
  tri?: { colonne: string; croissant?: boolean }
}

type Contexte = { params: { id: string } }

/** Fabrique les quatre gestionnaires d'une table rattachée à un projet. */
export function routesDeProjet(o: OptionsTable) {
  const tri = o.tri ?? { colonne: 'created_at', croissant: true }

  async function GET(_req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      const admin = createAdminClient()
      const { data, error } = await admin
        .from(o.table).select('*').eq('projet_id', params.id)
        .order(tri.colonne, { ascending: tri.croissant !== false })
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ [o.cle]: data ?? [] })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  async function POST(req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      const body = await req.json() as Record<string, unknown>

      if (o.requis) {
        const v = body[o.requis]
        if (typeof v !== 'string' || !v.trim())
          return NextResponse.json({ error: `${o.requis} requis` }, { status: 400 })
      }
      const insert: Record<string, unknown> = { projet_id: params.id }
      for (const c of o.champs) if (c in body) insert[c] = body[c]

      const admin = createAdminClient()
      const { data, error } = await admin.from(o.table).insert(insert).select().single()
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ [o.cle.replace(/s$/, '')]: data })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  async function PATCH(req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      const body = await req.json() as Record<string, unknown>
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

      const patch: Record<string, unknown> = {}
      for (const c of o.champs) if (c in body) patch[c] = body[c]
      if (!Object.keys(patch).length)
        return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

      const admin = createAdminClient()
      const { data, error } = await admin.from(o.table).update(patch)
        .eq('id', id).eq('projet_id', params.id).select().single()
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ [o.cle.replace(/s$/, '')]: data })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  async function DELETE(req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      // Route imbriquée sous un segment dynamique : la chaîne de requête
      // n'arrive pas toujours jusqu'ici, d'où la lecture tolérante.
      const id = await lireIdentifiant(req)
      if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
      const admin = createAdminClient()
      const { error } = await admin.from(o.table).delete()
        .eq('id', id).eq('projet_id', params.id)
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  return { GET, POST, PATCH, DELETE }
}

/**
 * Fabrique les gestionnaires d'une fiche unique par projet — cadrage, théorie
 * du changement. Le PUT crée ou met à jour indifféremment : une fiche unique
 * n'a pas d'identifiant propre, le projet suffit.
 */
export function ficheDeProjet(o: { table: string; champs: readonly string[]; cle: string }) {
  async function GET(_req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      const admin = createAdminClient()
      const { data, error } = await admin
        .from(o.table).select('*').eq('projet_id', params.id).maybeSingle()
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ [o.cle]: data ?? null })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  async function PUT(req: NextRequest, { params }: Contexte) {
    try {
      const guard = await requireProjet(params.id)
      if (guard instanceof NextResponse) return guard
      const body = await req.json() as Record<string, unknown>
      const ligne: Record<string, unknown> = { projet_id: params.id }
      for (const c of o.champs) if (c in body) ligne[c] = body[c]

      const admin = createAdminClient()
      const { data, error } = await admin
        .from(o.table).upsert(ligne, { onConflict: 'projet_id' }).select().single()
      if (error) return NextResponse.json({ error: messageErreur(error) }, { status: 500 })
      return NextResponse.json({ [o.cle]: data })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  return { GET, PUT }
}
