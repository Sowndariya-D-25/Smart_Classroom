import axios from 'axios'

// Central Axios instance. All frontend API calls should go through this
// so that auth headers, base URL, and error handling stay in one place.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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
// deliberately DON'T do this for /auth/login or /auth/register: a 401
// there just means "wrong password", which the login form should show
// inline, not treat as "your session expired" (that would be confusing,
// and could otherwise loop since login failures are also 401s).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')

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
