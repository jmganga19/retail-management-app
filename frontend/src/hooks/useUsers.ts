import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  deleteUser,
  getAuditLogs,
  getUsers,
  resetUserPassword,
  updateUser,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '../api/users'

interface UserFilters {
  q?: string
  role?: string
  is_active?: boolean
  skip?: number
  limit?: number
}

interface AuditFilters {
  action?: string
  target_type?: string
  skip?: number
  limit?: number
}

export const useUsers = (filters: UserFilters = {}) =>
  useQuery({ queryKey: ['users', filters], queryFn: () => getUsers(filters) })

export const useAuditLogs = (filters: AuditFilters = {}) =>
  useQuery({ queryKey: ['audit-logs', filters], queryFn: () => getAuditLogs(filters) })

export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) => updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

export const useResetUserPassword = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) => resetUserPassword(id, newPassword),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-logs'] }),
  })
}

export const useDeleteUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}
