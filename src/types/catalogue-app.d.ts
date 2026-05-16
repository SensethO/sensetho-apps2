// Type declarations for @sensetho/catalogue-app subpath exports
// These types mirror the source in Catalogue-App/src/guided-diagnostic/types.ts
// Remove this file once the package publishes proper .d.ts for Pass 2 modules.

declare module '@sensetho/catalogue-app/guided-diagnostic' {
  export interface Phase {
    id: 1 | 2 | 3 | 4
    label: string
    color: string
    bg: string
    border: string
  }

  export interface Domain {
    id: string
    nom: string
    isoRef: string
    phase: 1 | 2 | 3 | 4
    qcNom: string
    qcIcone: string
    rationale: string
    actions: string[]
    focusActionIndices: number[]
    kpis: string[]
    ods: string[]
  }

  export interface DiagnosticRecord {
    id: string
    user_id: string
    organisation_id: string
    year: number
    scores: Record<string, number>
    action_progress: Record<string, number>
    action_na: Record<string, boolean>
    ai_analysis: string | null
    ai_scores: Record<string, number> | null
    ai_generated_at: string | null
  }

  export interface DiagnosticShare {
    id: string
    permission: 'read' | 'edit'
    created_at: string
    profiles: { email: string; full_name: string | null } | null
  }

  export interface ActionNote {
    action_key: string
    content: string
  }

  export const SCORE_LABELS: readonly string[]
  export const PHASES: readonly Phase[]
  export const DOMAINS: readonly Domain[]
}
