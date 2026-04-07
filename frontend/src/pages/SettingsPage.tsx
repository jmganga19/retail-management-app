import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybe = error as { response?: { data?: { detail?: unknown } } }
  const detail = maybe?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return fallback
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useSettings()
  const update = useUpdateSettings()

  const [appName, setAppName] = useState('RetailPro')
  const [currencyCode, setCurrencyCode] = useState('TZS')
  const [businessPhone, setBusinessPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    setAppName(data.app_name)
    setCurrencyCode(data.currency_code)
    setBusinessPhone(data.business_phone ?? '')
  }, [data])

  if (!user) return null
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Manage app constants used across the system.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading settings...</p>
        ) : (
          <>
            {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{message}</p>}
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

            <Input label="Application Name" value={appName} onChange={e => setAppName(e.target.value)} />
            <Input label="Currency Code" value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} />
            <Input label="Business Phone (optional)" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} />

            <div className="pt-2">
              <Button
                loading={update.isPending}
                onClick={async () => {
                  if (!appName.trim()) {
                    setError('Application name is required')
                    setMessage('')
                    return
                  }
                  if (!currencyCode.trim()) {
                    setError('Currency code is required')
                    setMessage('')
                    return
                  }

                  try {
                    setError('')
                    setMessage('')
                    await update.mutateAsync({
                      app_name: appName.trim(),
                      currency_code: currencyCode.trim().toUpperCase(),
                      business_phone: businessPhone.trim() || null,
                    })
                    setMessage('Settings updated successfully.')
                  } catch (e) {
                    setError(getErrorMessage(e, 'Failed to update settings'))
                  }
                }}
              >
                Save Settings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
