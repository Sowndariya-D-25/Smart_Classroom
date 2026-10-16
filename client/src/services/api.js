import axios from 'axios'

// Central Axios instance. All frontend API calls should go through this
// so that auth headers, base URL, and error handling stay in one place.
export const getApiBaseUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '')
  // If the URL already ends with /api, use it as is. Otherwise, append /api
  return raw.endsWith('/api') ? raw : `${raw}/api`
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

const TOKEN_KEY = 'scaap_token'

// Attach JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If a request comes back 401, the token we sent (if any) is invalid or
// expired — clear it and tell AuthContext so it can update state. We
// deliberately DON'T do this for /auth/login, /auth/register or /auth/setup:
// a 401 there just means "wrong password" or "invalid key", which forms show
// inline, not treat as "your session expired".
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/setup')

    const hasToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
    if (status === 401 && !isAuthEndpoint && hasToken) {
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('scaap:unauthorized'))
    }

    return Promise.reject(error)
  },
)

export { TOKEN_KEY }
export default api
