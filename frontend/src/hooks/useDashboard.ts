import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '../api/dashboard'

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 60_000, // auto-refresh every minute
  })
