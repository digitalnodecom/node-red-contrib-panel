import { ref, computed } from 'vue'

// Auth token management composable
export function useAuth() {
  const authTokens = ref(null)
  
  // Get Node-RED auth tokens from localStorage
  const getAuthTokens = () => {
    try {
      // Node-RED stores auth tokens based on the admin root path, not the current path
      // Since we're at /panel, but Node-RED admin is at /, we need to use the root path
      const adminPath = '' // Node-RED admin root is typically '/'
      const suffix = adminPath.replace(/\//g, '-')
      const tokenKey = 'auth-tokens' + suffix
      console.log('[AUTH] Looking for tokens with key:', tokenKey)
      console.log('[AUTH] Using admin path:', adminPath, 'suffix:', suffix)
      
      // Debug: show all localStorage keys
      console.log('[AUTH] All localStorage keys:', Object.keys(localStorage))
      
      const tokens = localStorage.getItem(tokenKey)
      console.log('[AUTH] Raw tokens from localStorage:', tokens)
      
      const parsedTokens = tokens ? JSON.parse(tokens) : null
      console.log('[AUTH] Parsed tokens:', parsedTokens)
      
      return parsedTokens
    } catch (error) {
      console.warn('[AUTH] Failed to parse auth tokens:', error)
      return null
    }
  }
  
  // Load auth tokens
  const loadAuthTokens = () => {
    console.log('[AUTH] Loading auth tokens...')
    authTokens.value = getAuthTokens()
    console.log('[AUTH] Loaded tokens into reactive ref:', authTokens.value)
    return authTokens.value
  }
  
  // Check if user is authenticated
  const isAuthenticated = computed(() => {
    return authTokens.value && authTokens.value.access_token
  })
  
  // Get current user info from token
  const currentUser = computed(() => {
    if (!authTokens.value) return null
    
    // Node-RED tokens are encrypted and can't be decoded client-side
    // Return a generic user object when authenticated
    return {
      username: 'Node-RED User',
      permissions: ['flows.read'],
      scope: ['*']
    }
  })
  
  // Check if token is expired
  const isTokenExpired = computed(() => {
    console.log('[AUTH] Checking if token is expired...')
    if (!authTokens.value) {
      console.log('[AUTH] No tokens available, considering expired')
      return true
    }
    
    // Node-RED tokens are not JWTs, they are encrypted tokens
    // We can't decode them to check expiration, so we'll rely on the API response
    // If we have a token, assume it's valid until the API says otherwise
    console.log('[AUTH] Node-RED token found, assuming valid (will check via API)')
    return false
  })
  
  // Redirect to Node-RED login
  const redirectToLogin = () => {
    console.log('Redirecting to Node-RED login...')
    window.location.href = '/'
  }
  
  // Check if Node-RED auth is required
  const checkAuthRequired = async () => {
    // Make a test API call to see if auth is required
    console.log('[AUTH] Checking if auth is required by testing API...')
    try {
      const response = await fetch('/panel/api/system', {
        headers: {
          'Node-RED-API-Version': 'v2'
        }
      })
      
      console.log('[AUTH] API test response status:', response.status)
      
      if (response.status === 401) {
        // Auth is required but we don't have valid tokens
        console.log('[AUTH] Auth is required (got 401)')
        return true
      }
      
      console.log('[AUTH] Auth not required or we have valid tokens')
      return false // Either auth not required or we have valid tokens
    } catch (error) {
      console.warn('[AUTH] Error checking auth requirement:', error)
      return false
    }
  }
  
  // Initialize auth state
  const initialize = async () => {
    console.log('[AUTH] Initializing auth state...')
    loadAuthTokens()
    
    console.log('[AUTH] isAuthenticated:', isAuthenticated.value)
    console.log('[AUTH] isTokenExpired:', isTokenExpired.value)
    
    // If we have tokens, assume they're valid and don't redirect
    // The API will handle auth errors if the tokens are actually invalid
    if (isAuthenticated.value) {
      console.log('[AUTH] Tokens found, staying on page')
      return { authenticated: true, redirecting: false }
    }
    
    // Only check if auth is required when we have no tokens at all
    console.log('[AUTH] No tokens found, checking if auth is required...')
    const authRequired = await checkAuthRequired()
    if (authRequired) {
      console.warn('[AUTH] Auth is required but no tokens found - redirecting')
      redirectToLogin()
      return { authenticated: false, redirecting: true }
    } else {
      console.log('[AUTH] Auth not required, staying on page')
      return { authenticated: false, redirecting: false }
    }
  }
  
  return {
    authTokens,
    isAuthenticated,
    currentUser,
    isTokenExpired,
    loadAuthTokens,
    redirectToLogin,
    checkAuthRequired,
    initialize
  }
}