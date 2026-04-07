import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getBootstrapStatus } from '../api/auth'
import { getPublicSettings } from '../api/settings'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function LoginPage() {
  const { isAuthenticated, login, bootstrapAdmin } = useAuth()

  const [appName, setAppName] = useState('RetailPro')
  const [bootstrapRequired, setBootstrapRequired] = useState(false)
  const [checkingBootstrap, setCheckingBootstrap] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        const [status, publicSettings] = await Promise.all([
          getBootstrapStatus(),
          getPublicSettings().catch(() => null),
        ])

        setBootstrapRequired(status.bootstrap_required)
        if (publicSettings?.app_name?.trim()) {
          setAppName(publicSettings.app_name.trim())
        }
      } catch {
        setError('Unable to reach server. Please check your backend connection.')
      } finally {
        setCheckingBootstrap(false)
      }
    }

    void run()
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(username, password)
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleBootstrap = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await bootstrapAdmin({
        username,
        full_name: fullName,
        email,
        password,
      })
    } catch {
      setError('Failed to create initial admin account. Review details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{appName}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {bootstrapRequired ? 'Create your first admin account' : 'Sign in to continue'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {checkingBootstrap ? (
          <p className="text-sm text-gray-600">Preparing sign-in...</p>
        ) : bootstrapRequired ? (
          <form className="space-y-3" onSubmit={handleBootstrap}>
            <Input label="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} required />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Create Admin & Sign In
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleLogin}>
            <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} required />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
