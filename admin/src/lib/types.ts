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
}
