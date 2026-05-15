export type UserRole = 'user' | 'admin'

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
  created_at: string
  updated_at: string
  category?: AppCategory
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
