export type EngagementMode = 'voluntaire' | 'csrd' | 'both'
export type MaterialityType = 'simple' | 'double'
export type StakeholderCategory = 'interne' | 'externe'
export type SessionStatus = 'actif' | 'archivé'
export type SurveyStatus = 'brouillon' | 'en_cours' | 'terminé'
export type QuestionDimension = 'impact' | 'financial' | 'general'

export interface Stakeholder {
  id: string
  name: string
  organisation?: string
  email?: string
  category: StakeholderCategory
  type: string
  influence: 1 | 2 | 3 | 4 | 5
  interest: 1 | 2 | 3 | 4 | 5
  engagement_type: EngagementMode
  notes?: string
  created_at: string
}

export interface SurveyQuestion {
  id: string
  esrs: string
  esrs_name: string
  dimension: QuestionDimension
  text: string
  required: boolean
}

export interface SurveyResponse {
  stakeholder_id: string
  stakeholder_name: string
  completed_at: string
  answers: Record<string, number>
}

export interface Survey {
  id: string
  name: string
  description?: string
  materiality_type: MaterialityType
  status: SurveyStatus
  esrs_topics: string[]
  questions: SurveyQuestion[]
  stakeholder_ids: string[]
  responses: SurveyResponse[]
  created_at: string
  updated_at: string
  anonymous?: boolean
  share_token?: string | null
  token_expires_at?: string | null
}

export interface MaterialityScore {
  esrs: string
  esrs_name: string
  impact_score: number
  financial_score: number
  combined_score: number
  is_material: boolean
  respondents: number
}

export interface PPSession {
  id: string
  user_id: string
  name: string
  organisation?: string
  secteur?: string
  exercice: string
  mode: EngagementMode
  materiality_type: MaterialityType
  status: SessionStatus
  stakeholders: Stakeholder[]
  surveys: Survey[]
  materiality_scores: MaterialityScore[]
  session_notes?: string | null
  created_at: string
  updated_at: string
}
