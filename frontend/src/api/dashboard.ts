import client from './client'
import type { DashboardSummary } from '../types'

export const getDashboardSummary = () =>
  client.get<DashboardSummary>('/dashboard/summary').then(r => r.data)
