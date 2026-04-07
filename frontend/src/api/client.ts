import axios from 'axios'

const TOKEN_STORAGE_KEY = 'retail_auth_token'
const API_TIMEOUT_MS = 8000

let authToken: string | null = null

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

export const getTokenStorageKey = () => TOKEN_STORAGE_KEY

export const setAuthToken = (token: string | null) => {
  authToken = token
}

client.interceptors.request.use(config => {
  if (authToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})

client.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401 && authToken) {
      authToken = null
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default client
