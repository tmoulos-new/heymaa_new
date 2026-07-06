export interface Offer {
  id: string
  title: string
  body?: string
  badge?: string
  lang?: string
  link?: string
  expires_at?: string
  image_key?: string
  image_url?: string
  region_ids?: string[]
  regions?: RegionRow[]
  created_by_name?: string
  is_deleted?: boolean
}

export interface Promotion {
  id: string
  title: string
  body?: string
  link?: string
  expires_at?: string
  image_key?: string
  image_url?: string
  target_countries?: string[]
  target_cities?: string[]
  target_zips?: string[]
  child_count_min?: number | null
  child_count_max?: number | null
  target_pregnancy?: boolean | null
  child_age_min_months?: number | null
  child_age_max_months?: number | null
  region_ids?: string[]
  regions?: RegionRow[]
  created_by_name?: string
  is_deleted?: boolean
}

export interface RegionRow {
  id: string
  name: string
  languages: string[]
  active?: boolean
  is_deleted?: boolean
  created_at?: string
  updated_at?: string
  created_by_name?: string
}

export interface InviteCodeRow {
  id?: string
  code: string
  status: 'active' | 'inactive' | 'expired' | string
  label?: string | null
  notes?: string | null
  expires_at?: string | null
  is_deleted?: boolean
  created_at?: string
  updated_at?: string
  created_by_name?: string
}

export interface UserRow {
  id: string
  email: string
  name?: string
  plan?: string
  subscription_status?: string
  created_at?: string
  last_login?: string
  trial_ends_at?: string
  role?: string | null
  account_kind?: 'registered' | 'auth_only'
  must_change_password?: boolean
  data_summary?: UserDataSummary
}

export interface UserDataSummary {
  children: number
  members: number
  chat_messages: number
  memories: number
  threads: number
}

export interface AdminUser {
  id: string
  email: string
  name?: string | null
  role?: string | null
}

export interface ActivityLogRow {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Record<string, unknown>
  value_before?: Record<string, unknown> | null
  value_after?: Record<string, unknown> | null
  created_at: string
  actor_name?: string
}

export interface UserActivityRow {
  id: string
  user_id?: string | null
  token?: string | null
  action: string
  path: string
  label?: string | null
  details?: Record<string, unknown>
  created_at: string
  actor_name?: string
}

export interface ProviderStatus {
  ok: boolean
  msg: string
}

export interface PromoFormData {
  title: string
  body: string
  link: string | null
  expires_at: string | null
  target_countries: string[] | null
  target_cities: string[] | null
  target_zips: string[] | null
  child_count_min: number | null
  child_count_max: number | null
  target_pregnancy: boolean | null
  child_age_min_months: number | null
  child_age_max_months: number | null
  image_key: string | null
  region_ids: string[] | null
}
