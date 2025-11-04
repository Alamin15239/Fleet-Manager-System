// API Route Permission Mapping
export const API_PERMISSIONS = {
  // Dashboard
  '/api/dashboard/stats': { resource: 'dashboard', action: 'read' },
  
  // Trucks
  '/api/trucks': {
    GET: { resource: 'trucks', action: 'read' },
    POST: { resource: 'trucks', action: 'create' },
    PUT: { resource: 'trucks', action: 'update' },
    DELETE: { resource: 'trucks', action: 'delete' }
  },
  
  // Tires
  '/api/tires': {
    GET: { resource: 'tire-management', action: 'read' },
    POST: { resource: 'tire-management', action: 'create' },
    PUT: { resource: 'tire-management', action: 'update' },
    DELETE: { resource: 'tire-management', action: 'delete' }
  },
  '/api/tires/analytics': { resource: 'tire-management', action: 'read' },
  '/api/tires/filters': { resource: 'tire-management', action: 'read' },
  
  // Vehicles
  '/api/vehicles': {
    GET: { resource: 'trucks', action: 'read' },
    POST: { resource: 'trucks', action: 'create' },
    PUT: { resource: 'trucks', action: 'update' },
    DELETE: { resource: 'trucks', action: 'delete' }
  },
  '/api/vehicles/initialize': {
    GET: { resource: 'trucks', action: 'read' },
    POST: { resource: 'trucks', action: 'create' }
  },
  
  // Maintenance
  '/api/maintenance': {
    GET: { resource: 'maintenance', action: 'read' },
    POST: { resource: 'maintenance', action: 'create' },
    PUT: { resource: 'maintenance', action: 'update' },
    DELETE: { resource: 'maintenance', action: 'delete' }
  },
  
  // Mechanics
  '/api/mechanics': {
    GET: { resource: 'mechanics', action: 'read' },
    POST: { resource: 'mechanics', action: 'create' },
    PUT: { resource: 'mechanics', action: 'update' },
    DELETE: { resource: 'mechanics', action: 'delete' }
  },
  
  // Trailers
  '/api/trailers': {
    GET: { resource: 'trailers', action: 'read' },
    POST: { resource: 'trailers', action: 'create' },
    PUT: { resource: 'trailers', action: 'update' },
    DELETE: { resource: 'trailers', action: 'delete' }
  },
  
  // Users
  '/api/users': {
    GET: { resource: 'users', action: 'read' },
    POST: { resource: 'users', action: 'create' },
    PUT: { resource: 'users', action: 'update' },
    DELETE: { resource: 'users', action: 'delete' }
  },
  
  // Settings
  '/api/settings': {
    GET: { resource: 'settings', action: 'read' },
    POST: { resource: 'settings', action: 'update' },
    PUT: { resource: 'settings', action: 'update' }
  },
  
  // Reports
  '/api/reports': { resource: 'reports', action: 'read' },
  
  // Database
  '/api/database/storage': { resource: 'admin', action: 'read' },
  
  // Profile (always allowed for own profile)
  '/api/profile': { resource: 'profile', action: 'read' }
}

export function getRequiredPermission(pathname: string, method: string) {
  const route = API_PERMISSIONS[pathname as keyof typeof API_PERMISSIONS]
  
  if (!route) {
    return null
  }
  
  if (typeof route === 'object' && 'resource' in route) {
    return route
  }
  
  if (typeof route === 'object' && method in route) {
    return route[method as keyof typeof route]
  }
  
  return null
}