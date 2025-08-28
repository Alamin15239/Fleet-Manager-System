// API utility function that includes authentication
export async function apiFetch(url: string, options: RequestInit = {}) {
  // Get token from localStorage
  let token = null
  
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('authToken')
    console.log('API Fetch - Token from localStorage:', token ? 'Present' : 'Missing')
    if (!token) {
      console.log('API Fetch - No token found in localStorage')
      // Try to get token from cookie as fallback
      const cookies = document.cookie.split(';')
      const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='))
      if (authCookie) {
        token = authCookie.split('=')[1]
        console.log('API Fetch - Token found in cookie')
        // Store it in localStorage for future requests
        localStorage.setItem('authToken', token)
      }
    }
  } else {
    console.log('API Fetch - Running on server side, no localStorage available')
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    console.log('API Fetch - Authorization header added')
  } else {
    console.log('API Fetch - No token available, request will be unauthenticated')
  }

  const config: RequestInit = {
    ...options,
    headers,
  }

  try {
    console.log('API Fetch - Making request to:', url)
    const response = await fetch(url, config)
    console.log('API Fetch - Response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.log('API Fetch - Error response:', errorData)
      
      // If authentication error, try to redirect to login
      if (response.status === 401) {
        console.log('API Fetch - Authentication error, redirecting to login')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }
    
    return response
  } catch (error) {
    console.error('API request failed:', error)
    throw error
  }
}

// Helper function for GET requests
export async function apiGet(url: string) {
  return apiFetch(url, { method: 'GET' })
}

// Helper function for POST requests
export async function apiPost(url: string, data: any) {
  return apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Helper function for PUT requests
export async function apiPut(url: string, data: any) {
  return apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Helper function for DELETE requests
export async function apiDelete(url: string) {
  return apiFetch(url, { method: 'DELETE' })
}