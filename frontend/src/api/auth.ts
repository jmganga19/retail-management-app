import client from './client'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
}

export interface AuthUser {
  id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'staff'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BootstrapStatus {
  bootstrap_required: boolean
}

export interface BootstrapAdminPayload {
  username: string
  email: string
  full_name: string
  password: string
}

export const login = async (payload: LoginPayload) => {
  const body = new URLSearchParams()
  body.set('username', payload.username)
  body.set('password', payload.password)

  const { data } = await client.post<LoginResponse>('/auth/login', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const getMe = () => client.get<AuthUser>('/auth/me').then(r => r.data)

export const getBootstrapStatus = () =>
  client.get<BootstrapStatus>('/auth/bootstrap-status').then(r => r.data)

export const bootstrapAdmin = (payload: BootstrapAdminPayload) =>
  client.post<AuthUser>('/auth/bootstrap-admin', payload).then(r => r.data)
