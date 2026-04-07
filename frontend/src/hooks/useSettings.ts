import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, type AppSettingsUpdate } from '../api/settings'

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: getSettings })

export const useUpdateSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AppSettingsUpdate) => updateSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
