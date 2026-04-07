import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

type UserRole = 'admin' | 'manager' | 'staff'

interface RequireRolesProps {
  allowed: UserRole[]
  children: JSX.Element
}

export default function RequireRoles({ allowed, children }: RequireRolesProps) {
  const { user } = useAuth()

  if (!user) return null
  if (!allowed.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}
