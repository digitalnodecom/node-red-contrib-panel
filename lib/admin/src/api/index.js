import axios from 'axios'

// Get Node-RED auth tokens from localStorage
const getAuthTokens = () => {
  try {
    // Node-RED stores auth tokens based on the admin root path, not the current path
    const adminPath = '' // Node-RED admin root is typically '/'
    const suffix = adminPath.replace(/\//g, '-')
    const tokens = localStorage.getItem('auth-tokens' + suffix)
    return tokens ? JSON.parse(tokens) : null
  } catch (error) {
    console.warn('Failed to parse auth tokens:', error)
    return null
  }
}

const api = axios.create({
  baseURL: '/panel/api',
  headers: {
    'Content-Type': 'application/json',
    'Node-RED-API-Version': 'v2'
  }
})

// Request interceptor to add Node-RED auth token
api.interceptors.request.use(
  config => {
    console.log('[API] Making request to:', config.url)
    const tokens = getAuthTokens()
    console.log('[API] Retrieved tokens for request:', tokens)
    
    if (tokens && tokens.access_token) {
      config.headers.Authorization = `Bearer ${tokens.access_token}`
      console.log('[API] Added Authorization header')
    } else {
      console.log('[API] No tokens available, sending request without auth')
    }
    return config
  },
  error => {
    console.log('[API] Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and auth redirect
api.interceptors.response.use(
  response => {
    console.log('[API] Response received:', response.status, response.config.url)
    return response
  },
  error => {
    console.log('[API] Response error:', error.response?.status, error.response?.config?.url)
    
    if (error.response?.status === 401) {
      // Token invalid/expired - redirect to Node-RED login
      console.log('[API] Authentication required - redirecting to Node-RED login')
      // Small delay to allow any pending UI updates
      setTimeout(() => {
        window.location.href = '/'
      }, 100)
      return Promise.reject(new Error('Authentication required'))
    }
    console.error('[API] API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api