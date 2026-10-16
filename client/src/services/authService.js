import api, { TOKEN_KEY } from './api'

// Thin wrapper around the /api/auth endpoints. Keeps token storage in one
// place so AuthContext doesn't touch localStorage directly.

export async function register({ name, email, password }) {
  const res = await api.post('/auth/register', { name, email, password })
  const { token, user } = res.data.data
  localStorage.setItem(TOKEN_KEY, token)
  return user
}

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password })
  const { token, user } = res.data.data
  localStorage.setItem(TOKEN_KEY, token)
  return user
}

export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data.data // { user, profile }
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } catch (err) {
    // Network or server error — proceed with clearing local session anyway
  } finally {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export async function getAdminSetupStatus() {
  const res = await api.get('/auth/setup/status')
  return res.data?.data || res.data
}

export async function setupAdmin(payload) {
  const res = await api.post('/auth/setup', payload)
  return res.data
}

