export type UserRole = 'user' | 'admin'
export type PricingType = 'free' | 'subscription' | 'perpetual' | 'quote'
/** Type de shell utilisé par les apps de cette catégorie */
export type ShellType = 'standard' | 'rse'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export interface AppCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  order_index: number
  is_admin_only: boolean
  is_active: boolean
  /** Type de shell appliqué aux apps de cette catégorie. Default: 'standard' */
  shell_type: ShellType
  created_at: string
  updated_at: string
  apps?: App[]
}

export interface App {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  route: string
  category_id: string | null
  order_index: number
  is_active: boolean
  is_admin_only: boolean
  is_for_sale: boolean
  pricing_type: PricingType
  price_monthly: number | null
  price_annual: number | null
  annual_discount_pct: number
  price_perpetual: number | null
  created_at: string
  updated_at: string
  category?: AppCategory
}

export interface SiteSetting {
  key: string
  value: string
  label?: string
  description?: string
  category?: string
  updated_at?: string
  updated_by?: string
}

export interface UserAppPermission {
  user_id: string
  app_id: string
  can_access: boolean
  granted_at: string
  granted_by: string | null
}

export interface UserWithPermissions extends Profile {
  permissions: { app_id: string; can_access: boolean }[]
}

export type Theme = 'light' | 'dark' | 'system'

export interface UserPreferences {
  user_id: string
  theme: Theme
  updated_at: string
}

export type TicketType = 'support' | 'password_reset' | 'forgot_password'
export type TicketStatus = 'open' | 'in_progress' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Ticket {
  id: string
  user_id: string | null
  email: string | null
  type: TicketType
  subject: string
  message: string | null
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  updated_at: string
  resolved_at: string | null
  profile?: Pick<Profile, 'email' | 'full_name'>
}

// ── Billing ──────────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'monthly' | 'annual' | 'perpetual'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired'
export type QuoteStatus = 'pending' | 'processing' | 'accepted' | 'rejected'

export interface AppSubscription {
  id: string
  user_id: string
  app_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  price_paid: number | null
  notes: string | null
  started_at: string
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  profile?: Pick<Profile, 'email' | 'full_name'>
  app?: Pick<App, 'name' | 'slug' | 'icon'>
}

export interface AppQuote {
  id: string
  user_id: string | null
  app_id: string
  email: string
  company: string | null
  users_count: number | null
  message: string | null
  status: QuoteStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
  profile?: Pick<Profile, 'email' | 'full_name'>
  app?: Pick<App, 'name' | 'slug' | 'icon' | 'pricing_type'>
}
