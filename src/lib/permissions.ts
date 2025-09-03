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
  userPermissions: Record<string, Permission>
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
    // First check if user has specific permissions in settings
    if (this.settingsPermissions?.userPermissions?.[this.userId]) {
      return {
        ...this.getRolePermissions(),
        ...this.settingsPermissions.userPermissions[this.userId]
      }
    }

    // Then check if role has custom permissions in settings
    if (this.settingsPermissions?.rolePermissions?.[this.userRole]) {
      return this.settingsPermissions.rolePermissions[this.userRole]
    }

    // Fall back to default role permissions
    return this.getRolePermissions()
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
      return permissions.canViewDashboard
    case '/trucks':
      return permissions.canViewTrucks
    case '/maintenance':
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
      return permissions.canViewSettings
    case '/admin':
      return permissions.canViewAdmin
    case '/advanced-analytics':
      return permissions.canViewAdvancedAnalytics
    case '/trailers':
      return permissions.canViewTrailers
    default:
      return false
  }
}