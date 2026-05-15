export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
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
