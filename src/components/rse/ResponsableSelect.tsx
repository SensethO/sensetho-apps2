'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Sélecteur de responsable d'action — pattern RSE §14.A (gravé dans le marbre).
 * Liste stricte des membres du dossier (propriétaire + utilisateurs partagés).
 * Valeur stockée = nom affiché (full_name sinon email). Préserve les anciennes
 * valeurs texte saisies hors liste. Réutilisable par toutes les apps RSE.
 */

export interface Member {
  user_id: string
  email: string
  full_name: string | null
  isOwner: boolean
  permission: 'read' | 'edit' | null
}

export function memberLabel(m: Member): string {
  return (m.full_name && m.full_name.trim()) || m.email
}

/** Nom de l'événement à émettre après un changement de partage pour rafraîchir les listes. */
export const MEMBERS_CHANGED_EVENT = 'rse-members-changed'

/** Émet l'événement de rafraîchissement des membres (à appeler après ajout/retrait de partage). */
export function notifyMembersChanged(appSlug: string, diagnosticId: string | null | undefined) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MEMBERS_CHANGED_EVENT, { detail: { appSlug, diagnosticId } }))
}

/**
 * Charge propriétaire + partagés d'un diagnostic via GET /api/<appSlug>/[id]/members.
 * Se recharge aussi quand un événement `rse-members-changed` correspondant est émis
 * (ex. après un ajout/retrait de partage), sans attendre un rechargement du dossier.
 */
export function useDiagnosticMembers(appSlug: string, diagnosticId: string | null | undefined): Member[] {
  const [members, setMembers] = useState<Member[]>([])
  const load = useCallback(async () => {
    if (!diagnosticId) { setMembers([]); return }
    try {
      const res = await fetch(`/api/${appSlug}/${diagnosticId}/members`)
      const { data } = await res.json()
      setMembers(data ?? [])
    } catch { /* ignore */ }
  }, [appSlug, diagnosticId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    function onChanged(e: Event) {
      const d = (e as CustomEvent).detail as { appSlug?: string; diagnosticId?: string } | undefined
      if (!d || (d.appSlug === appSlug && (!d.diagnosticId || d.diagnosticId === diagnosticId))) load()
    }
    window.addEventListener(MEMBERS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(MEMBERS_CHANGED_EVENT, onChanged)
  }, [load, appSlug, diagnosticId])
  return members
}

export default function ResponsableSelect({ value, members, onChange, className }: {
  value: string
  members: Member[]
  onChange: (v: string) => void
  className?: string
}) {
  const v = value ?? ''
  const labels = members.map(memberLabel)
  const hasLegacy = v.trim() !== '' && !labels.includes(v)
  return (
    <select className={className} value={v} onChange={e => onChange(e.target.value)}>
      <option value="">— Non assigné —</option>
      {members.map(m => {
        const lbl = memberLabel(m)
        return <option key={m.user_id} value={lbl}>{lbl}{m.isOwner ? ' (propriétaire)' : ''}</option>
      })}
      {hasLegacy && <option value={v}>{v} (ancienne valeur)</option>}
    </select>
  )
}
