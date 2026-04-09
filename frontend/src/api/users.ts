import client from './client'

export interface SystemUser {
  id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'staff'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserPayload {
  username: string
  email: string
  full_name: string
  password: string
  role: 'admin' | 'manager' | 'staff'
}

export interface UpdateUserPayload {
  email?: string
  full_name?: string
  role?: 'admin' | 'manager' | 'staff'
  is_active?: boolean
}

export interface AuditLogEntry {
  id: number
  actor_user_id: number | null
  actor_username: string | null
  action: string
  target_type: string
  target_id: number | null
  description: string | null
  created_at: string
}

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

export const getUsers = (params?: UserFilters) =>
  client.get<SystemUser[]>('/users/', { params }).then(r => r.data)

export const createUser = (payload: CreateUserPayload) =>
  client.post<SystemUser>('/users/', payload).then(r => r.data)

export const updateUser = (id: number, payload: UpdateUserPayload) =>
  client.put<SystemUser>(`/users/${id}`, payload).then(r => r.data)

export const resetUserPassword = (id: number, new_password: string) =>
  client.patch(`/users/${id}/reset-password`, null, { params: { new_password } })

export const deleteUser = (id: number) =>
  client.delete(`/users/${id}`)

export const getAuditLogs = (params?: AuditFilters) =>
  client.get<AuditLogEntry[]>('/audit-logs/', { params }).then(r => r.data)


