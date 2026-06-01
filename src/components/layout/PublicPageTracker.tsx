'use client'
import { usePageLogger } from '@/hooks/usePageLogger'

/** Tracker invisible pour les pages publiques (catalogue, accueil, auth...) */
export default function PublicPageTracker() {
  usePageLogger()
  return null
}
