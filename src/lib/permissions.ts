// Permission types and utilities

export interface Permission {
  canViewDashboard: boolean
  canViewTrucks: boolean
  canAddTrucks: boolean
  canEditTrucks: boolean
  canDeleteTrucks: boolean
  canViewMaintenance: boolean
  canAddMaintenance: boolean
  canEditMaintenance: boolean
  canDeleteMaintenance: boolean
  canViewMechanics: boolean
  canAddMechanics: boolean
  canEditMechanics: boolean
  canDeleteMechanics: boolean
  canViewTireManagement: boolean
  canAddTireManagement: boolean
  canEditTireManagement: boolean
  canDeleteTireManagement: boolean
  canViewTrailers: boolean
  canAddTrailers: boolean
  canEditTrailers: boolean
  canDeleteTrailers: boolean
  canViewReports: boolean
  canViewUsers: boolean
  canManageUsers: boolean
  canViewProfile: boolean
  canEditProfile: boolean
  canViewSettings: boolean
  canManageSettings: boolean
  canViewAdmin: boolean
  canManageAdmin: boolean
  canViewAdvancedAnalytics: boolean
}

export interface SettingsPermissions {
  rolePermissions: Record<string, Permission>
  userPermissions: Record<string, Partial<Permission>>
}

export const defaultPermissions: Permission = {
  canViewDashboard: true,
  canViewTrucks: true,
  canAddTrucks: false,
  canEditTrucks: false,
  canDeleteTrucks: false,
  canViewMaintenance: true,
  canAddMaintenance: false,
  canEditMaintenance: false,
  canDeleteMaintenance: false,
  canViewMechanics: true,
  canAddMechanics: false,
  canEditMechanics: false,
  canDeleteMechanics: false,
  canViewTireManagement: true,
  canAddTireManagement: false,
  canEditTireManagement: false,
  canDeleteTireManagement: false,
  canViewTrailers: true,
  canAddTrailers: false,
  canEditTrailers: false,
  canDeleteTrailers: false,
  canViewReports: false,
  canViewUsers: false,
  canManageUsers: false,
  canViewProfile: true,
  canEditProfile: true,
  canViewSettings: false,
  canManageSettings: false,
  canViewAdmin: false,
  canManageAdmin: false,
  canViewAdvancedAnalytics: false
}

export const adminPermissions: Permission = {
  canViewDashboard: true,
  canViewTrucks: true,
  canAddTrucks: true,
  canEditTrucks: true,
  canDeleteTrucks: true,
  canViewMaintenance: true,
  canAddMaintenance: true,
  canEditMaintenance: true,
  canDeleteMaintenance: true,
  canViewMechanics: true,
  canAddMechanics: true,
  canEditMechanics: true,
  canDeleteMechanics: true,
  canViewTireManagement: true,
  canAddTireManagement: true,
  canEditTireManagement: true,
  canDeleteTireManagement: true,
  canViewTrailers: true,
  canAddTrailers: true,
  canEditTrailers: true,
  canDeleteTrailers: true,
  canViewReports: true,
  canViewUsers: true,
  canManageUsers: true,
  canViewProfile: true,
  canEditProfile: true,
  canViewSettings: true,
  canManageSettings: true,
  canViewAdmin: true,
  canManageAdmin: true,
  canViewAdvancedAnalytics: true
}

export const managerPermissions: Permission = {
  canViewDashboard: true,
  canViewTrucks: true,
  canAddTrucks: true,
  canEditTrucks: true,
  canDeleteTrucks: false,
  canViewMaintenance: true,
  canAddMaintenance: true,
  canEditMaintenance: true,
  canDeleteMaintenance: false,
  canViewMechanics: true,
  canAddMechanics: true,
  canEditMechanics: true,
  canDeleteMechanics: false,
  canViewTireManagement: true,
  canAddTireManagement: true,
  canEditTireManagement: true,
  canDeleteTireManagement: false,
  canViewTrailers: true,
  canAddTrailers: true,
  canEditTrailers: true,
  canDeleteTrailers: false,
  canViewReports: true,
  canViewUsers: true,
  canManageUsers: false,
  canViewProfile: true,
  canEditProfile: true,
  canViewSettings: true,
  canManageSettings: false,
  canViewAdmin: false,
  canManageAdmin: false,
  canViewAdvancedAnalytics: true
}

// Structure for settings page - converts permission objects to array format
export const defaultRolePermissions = {
  ADMIN: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'trucks', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'maintenance', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'mechanics', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'tire-management', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'trailers', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'profile', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read', 'create', 'export'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'admin', actions: ['read', 'update'] },
    { resource: 'users', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'advanced-analytics', actions: ['read'] }
  ],
  MANAGER: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'trucks', actions: ['read', 'create', 'update'] },
    { resource: 'maintenance', actions: ['read', 'create', 'update'] },
    { resource: 'mechanics', actions: ['read', 'create', 'update'] },
    { resource: 'tire-management', actions: ['read', 'create', 'update'] },
    { resource: 'trailers', actions: ['read', 'create', 'update'] },
    { resource: 'profile', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read', 'create', 'export'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'users', actions: ['read'] },
    { resource: 'advanced-analytics', actions: ['read'] }
  ],
  USER: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'trucks', actions: ['read'] },
    { resource: 'maintenance', actions: ['read'] },
    { resource: 'mechanics', actions: ['read'] },
    { resource: 'tire-management', actions: ['read'] },
    { resource: 'trailers', actions: ['read'] },
    { resource: 'profile', actions: ['read', 'update'] }
  ]
}

// Export the structure that settings page expects
export const defaultSettingsPermissions = {
  rolePermissions: defaultRolePermissions,
  userPermissions: {}
}

const emptyPermissions: Permission = {
  canViewDashboard: false,
  canViewTrucks: false,
  canAddTrucks: false,
  canEditTrucks: false,
  canDeleteTrucks: false,
  canViewMaintenance: false,
  canAddMaintenance: false,
  canEditMaintenance: false,
  canDeleteMaintenance: false,
  canViewMechanics: false,
  canAddMechanics: false,
  canEditMechanics: false,
  canDeleteMechanics: false,
  canViewTireManagement: false,
  canAddTireManagement: false,
  canEditTireManagement: false,
  canDeleteTireManagement: false,
  canViewTrailers: false,
  canAddTrailers: false,
  canEditTrailers: false,
  canDeleteTrailers: false,
  canViewReports: false,
  canViewUsers: false,
  canManageUsers: false,
  canViewProfile: false,
  canEditProfile: false,
  canViewSettings: false,
  canManageSettings: false,
  canViewAdmin: false,
  canManageAdmin: false,
  canViewAdvancedAnalytics: false
}

const arrayPermissionFields: Record<string, Record<string, keyof Permission>> = {
  dashboard: { read: 'canViewDashboard' },
  trucks: {
    read: 'canViewTrucks', create: 'canAddTrucks', update: 'canEditTrucks', delete: 'canDeleteTrucks'
  },
  maintenance: {
    read: 'canViewMaintenance', create: 'canAddMaintenance', update: 'canEditMaintenance', delete: 'canDeleteMaintenance'
  },
  mechanics: {
    read: 'canViewMechanics', create: 'canAddMechanics', update: 'canEditMechanics', delete: 'canDeleteMechanics'
  },
  'tire-management': {
    read: 'canViewTireManagement', create: 'canAddTireManagement', update: 'canEditTireManagement', delete: 'canDeleteTireManagement'
  },
  trailers: {
    read: 'canViewTrailers', create: 'canAddTrailers', update: 'canEditTrailers', delete: 'canDeleteTrailers'
  },
  profile: { read: 'canViewProfile', update: 'canEditProfile' },
  reports: { read: 'canViewReports' },
  users: { read: 'canViewUsers', create: 'canManageUsers', update: 'canManageUsers', delete: 'canManageUsers' },
  settings: { read: 'canViewSettings', update: 'canManageSettings' },
  admin: { read: 'canViewAdmin', update: 'canManageAdmin' },
  'advanced-analytics': { read: 'canViewAdvancedAnalytics' }
}

/** Convert legacy resource/action arrays to the boolean shape used by PermissionManager. */
export function normalizeRolePermissions(value: unknown): Permission {
  if (!Array.isArray(value)) {
    const normalized = { ...emptyPermissions, ...(value && typeof value === 'object' ? value as Partial<Permission> : {}) }
    if (normalized.canManageUsers) normalized.canViewUsers = true
    return normalized
  }

  const normalized = { ...emptyPermissions }
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const { resource, actions } = entry as { resource?: unknown; actions?: unknown }
    if (typeof resource !== 'string' || !Array.isArray(actions)) continue
    const fields = arrayPermissionFields[resource]
    if (!fields) continue

    for (const [action, field] of Object.entries(fields)) {
      normalized[field] = actions.includes(action)
    }
  }
  if (normalized.canManageUsers) normalized.canViewUsers = true
  return normalized
}

/** Keep object overrides partial; legacy arrays remain complete permission sets. */
export function normalizePermissionOverrides(value: unknown): Partial<Permission> {
  let normalized: Partial<Permission>
  if (Array.isArray(value)) {
    normalized = normalizeRolePermissions(value)
  } else if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    normalized = {}
    for (const key of Object.keys(emptyPermissions) as (keyof Permission)[]) {
      if (typeof input[key] === 'boolean') normalized[key] = input[key]
    }
  } else {
    return {}
  }

  // A user who can change records must also be able to open the corresponding
  // page and read the records those actions operate on.
  const actionToRead: [keyof Permission, keyof Permission][] = [
    ['canAddTrucks', 'canViewTrucks'], ['canEditTrucks', 'canViewTrucks'], ['canDeleteTrucks', 'canViewTrucks'],
    ['canAddMaintenance', 'canViewMaintenance'], ['canEditMaintenance', 'canViewMaintenance'], ['canDeleteMaintenance', 'canViewMaintenance'],
    ['canAddMechanics', 'canViewMechanics'], ['canEditMechanics', 'canViewMechanics'], ['canDeleteMechanics', 'canViewMechanics'],
    ['canAddTireManagement', 'canViewTireManagement'], ['canEditTireManagement', 'canViewTireManagement'], ['canDeleteTireManagement', 'canViewTireManagement'],
    ['canAddTrailers', 'canViewTrailers'], ['canEditTrailers', 'canViewTrailers'], ['canDeleteTrailers', 'canViewTrailers'],
    ['canManageUsers', 'canViewUsers'], ['canEditProfile', 'canViewProfile'], ['canManageSettings', 'canViewSettings'],
    ['canManageAdmin', 'canViewAdmin']
  ]
  for (const [action, read] of actionToRead) {
    if (normalized[action] === true) normalized[read] = true
    if (normalized[read] === false) normalized[action] = false
  }
  return normalized
}

export function isValidPermissionOverrides(value: unknown): value is Partial<Permission> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return Object.entries(input).every(([key, permission]) =>
    Object.prototype.hasOwnProperty.call(emptyPermissions, key) && typeof permission === 'boolean'
  )
}

export class PermissionManager {
  private userRole: string
  private userId: string
  private userPermissions: any
  private settingsPermissions: SettingsPermissions | null

  constructor(userRole: string, userId: string, userPermissions?: any) {
    this.userRole = userRole
    this.userId = userId
    this.userPermissions = userPermissions
    this.settingsPermissions = null
  }

  setSettingsPermissions(settingsPermissions: SettingsPermissions) {
    this.settingsPermissions = settingsPermissions
  }

  private getEffectivePermissions(): Permission {
    if (this.userRole === 'ADMIN') return adminPermissions

    // Resolve the role baseline first, then apply legacy Settings overrides and
    // finally the user's own saved overrides. Per-user restrictions must not
    // accidentally discard an administrator's role-level configuration.
    const configuredRolePermissions = this.settingsPermissions?.rolePermissions?.[this.userRole]
    const rolePermissions = configuredRolePermissions
      ? normalizeRolePermissions(configuredRolePermissions)
      : this.getRolePermissions()
    const settingsUserPermissions = this.settingsPermissions?.userPermissions?.[this.userId]
    const userOverrides = normalizePermissionOverrides(this.userPermissions)

    return {
      ...rolePermissions,
      ...(settingsUserPermissions ? normalizePermissionOverrides(settingsUserPermissions) : {}),
      ...userOverrides
    }
  }

  private getRolePermissions(): Permission {
    switch (this.userRole) {
      case 'ADMIN':
        return adminPermissions
      case 'MANAGER':
        return managerPermissions
      default:
        return defaultPermissions
    }
  }

  hasPermission(resource: string, action: string): boolean {
    const permissions = this.getEffectivePermissions()

    // Admin pages also use admin-only APIs, so role settings must not grant
    // partial access that the server will reject.
    if (resource === 'admin' && this.userRole !== 'ADMIN') return false
    
    switch (resource) {
      case 'dashboard':
        return action === 'read' ? permissions.canViewDashboard : false
      case 'trucks':
        switch (action) {
          case 'read': return permissions.canViewTrucks
          case 'create': return permissions.canAddTrucks
          case 'update': return permissions.canEditTrucks
          case 'delete': return permissions.canDeleteTrucks
          default: return false
        }
      case 'maintenance':
        switch (action) {
          case 'read': return permissions.canViewMaintenance
          case 'create': return permissions.canAddMaintenance
          case 'update': return permissions.canEditMaintenance
          case 'delete': return permissions.canDeleteMaintenance
          default: return false
        }
      case 'mechanics':
        switch (action) {
          case 'read': return permissions.canViewMechanics
          case 'create': return permissions.canAddMechanics
          case 'update': return permissions.canEditMechanics
          case 'delete': return permissions.canDeleteMechanics
          default: return false
        }
      case 'tire-management':
        switch (action) {
          case 'read': return permissions.canViewTireManagement
          case 'create': return permissions.canAddTireManagement
          case 'update': return permissions.canEditTireManagement
          case 'delete': return permissions.canDeleteTireManagement
          default: return false
        }

      case 'profile':
        switch (action) {
          case 'read': return permissions.canViewProfile
          case 'update': return permissions.canEditProfile
          default: return false
        }
      case 'reports':
        return action === 'read' ? permissions.canViewReports : false
      case 'users':
        switch (action) {
          case 'read': return permissions.canViewUsers
          case 'create': return permissions.canManageUsers
          case 'update': return permissions.canManageUsers
          case 'delete': return permissions.canManageUsers
          default: return false
        }
      case 'settings':
        switch (action) {
          case 'read': return permissions.canViewSettings
          case 'update': return permissions.canManageSettings
          default: return false
        }
      case 'admin':
        switch (action) {
          case 'read': return permissions.canViewAdmin
          case 'update': return permissions.canManageAdmin
          default: return false
        }
      case 'trailers':
        switch (action) {
          case 'read': return permissions.canViewTrailers
          case 'create': return permissions.canAddTrailers
          case 'update': return permissions.canEditTrailers
          case 'delete': return permissions.canDeleteTrailers
          default: return false
        }
      case 'advanced-analytics':
        return action === 'read' ? permissions.canViewAdvancedAnalytics : false
      case 'excel-imports':
        return action === 'read' && (
          permissions.canAddTrucks || permissions.canEditTrucks ||
          permissions.canAddTrailers || permissions.canEditTrailers ||
          permissions.canAddMaintenance || permissions.canEditMaintenance ||
          permissions.canAddTireManagement || permissions.canEditTireManagement
        )
      default:
        return false
    }
  }

  canAccess(resource: string): boolean {
    return this.hasPermission(resource, 'read')
  }

  canCreate(resource: string): boolean {
    return this.hasPermission(resource, 'create')
  }

  canUpdate(resource: string): boolean {
    return this.hasPermission(resource, 'update')
  }

  canDelete(resource: string): boolean {
    return this.hasPermission(resource, 'delete')
  }

  canExport(resource: string): boolean {
    // Export permission is same as read for most resources
    return this.hasPermission(resource, 'read')
  }
}

export function getUserPermissions(userRole: string, userPermissions?: any): Permission {
  // If user has custom permissions, use those
  if (userPermissions && typeof userPermissions === 'object') {
    return {
      ...defaultPermissions,
      ...userPermissions
    }
  }

  // Otherwise, use role-based default permissions
  switch (userRole) {
    case 'ADMIN':
      return adminPermissions
    case 'MANAGER':
      return managerPermissions
    default:
      return defaultPermissions
  }
}

export function hasPermission(permissions: Permission, permission: keyof Permission): boolean {
  return permissions[permission] === true
}

export function canAccessPage(permissions: Permission, page: string): boolean {
  switch (page) {
    case '/':
    case '/dashboard':
      return permissions.canViewDashboard
    case '/trucks':
      return permissions.canViewTrucks
    case '/maintenance':
      return permissions.canViewMaintenance
    case '/job-cards':
      return permissions.canViewMaintenance
    case '/oil-changes':
      return permissions.canViewMaintenance
    case '/mechanics':
      return permissions.canViewMechanics
    case '/tire-management':
      return permissions.canViewTireManagement
    case '/profile':
      return permissions.canViewProfile
    case '/reports':
      return permissions.canViewReports
    case '/users':
      return permissions.canViewUsers
    case '/settings':
    case '/settings/permissions':
      return permissions.canViewSettings
    case '/admin':
    case '/admin/activity':
      return permissions.canViewAdmin
    case '/advanced-analytics':
      return permissions.canViewAdvancedAnalytics
    case '/trailers':
      return permissions.canViewTrailers
    default:
      return false
  }
}
