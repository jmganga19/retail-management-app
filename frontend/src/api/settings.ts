import client from './client'

export interface AppSettings {
  app_name: string
  currency_code: string
  business_phone: string | null
  pricing_update_policy: 'manual' | 'latest_received'
  low_margin_warning_percent: number
}

export interface AppSettingsUpdate {
  app_name: string
  currency_code: string
  business_phone?: string | null
  pricing_update_policy: 'manual' | 'latest_received'
  low_margin_warning_percent: number
}

export const getPublicSettings = () =>
  client.get<AppSettings>('/settings/public').then(r => r.data)

export const getSettings = () =>
  client.get<AppSettings>('/settings/').then(r => r.data)

export const updateSettings = (payload: AppSettingsUpdate) =>
  client.put<AppSettings>('/settings/', payload).then(r => r.data)
