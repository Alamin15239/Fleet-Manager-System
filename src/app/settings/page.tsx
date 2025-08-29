'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Settings, Save, RefreshCw, Building, DollarSign, Bell, Wrench, Users, Shield, Crown, User, Briefcase, Activity, Clock } from 'lucide-react'
import SystemStatus from '@/components/SystemStatus'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { defaultSettingsPermissions } from '@/lib/permissions'
import { apiGet, apiPut } from '@/lib/api'

interface SettingsData {
  id: string
  currencySymbol: string
  currencyCode: string
  currencyName: string
  decimalPlaces: number
  thousandsSeparator: string
  decimalSeparator: string
  symbolPosition: 'before' | 'after'
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  timezone: string
  dateFormat: string
  maintenanceIntervals?: {
    oilChange?: number
    tireRotation?: number
    brakeInspection?: number
    engineTuneUp?: number
    transmissionService?: number
  }
  notifications?: {
    email?: boolean
    upcomingMaintenance?: boolean
    overdueMaintenance?: boolean
    lowStock?: boolean
  }
  rolePermissions?: any
  userPermissions?: any
  createdAt: string
  updatedAt: string
}

interface UserActivity {
  id: string
  userId: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  ipAddress?: string
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface LoginHistory {
  id: string
  userId: string
  loginTime: string
  logoutTime?: string
  ipAddress?: string
  sessionDuration?: number
  isActive: boolean
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

// Simplified role definitions
const roleDefinitions = {
  ADMIN: {
    name: 'Admin',
    description: 'Full access to everything',
    icon: Crown,
    color: 'destructive',
    permissions: {
      dashboard: 'Can view dashboard',
      trucks: 'Can add, edit, delete trucks',
      maintenance: 'Can manage all maintenance',
      mechanics: 'Can manage mechanics',
      reports: 'Can view and create reports',
      users: 'Can manage users',
      settings: 'Can change settings',
      admin: 'Full admin access'
    }
  },
  MANAGER: {
    name: 'Manager',
    description: 'Can manage most operations',
    icon: Briefcase,
    color: 'default',
    permissions: {
      dashboard: 'Can view dashboard',
      trucks: 'Can add and edit trucks',
      maintenance: 'Can manage maintenance',
      mechanics: 'Can manage mechanics',
      reports: 'Can view and create reports',
      users: 'Can view users only',
      settings: 'Can view settings',
      admin: 'No admin access'
    }
  },
  USER: {
    name: 'User',
    description: 'Basic read-only access',
    icon: User,
    color: 'secondary',
    permissions: {
      dashboard: 'Can view dashboard',
      trucks: 'Can view trucks only',
      maintenance: 'Can view maintenance only',
      mechanics: 'Can view mechanics only',
      reports: 'No report access',
      users: 'No user access',
      settings: 'No settings access',
      admin: 'No admin access'
    }
  }
}

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const { canAccess, refreshPermissions } = usePermissions()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [userActivities, setUserActivities] = useState<UserActivity[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (canAccess('settings')) {
      fetchSettings()
    }
  }, [canAccess])

  useEffect(() => {
    if (isAdmin) {
      fetchActivityData()
    }
  }, [isAdmin])

  const fetchSettings = async () => {
    try {
      const response = await apiGet('/api/settings')
      if (response.ok) {
        const data = await response.json()
        // Ensure maintenanceIntervals is properly initialized
        if (!data.maintenanceIntervals) {
          data.maintenanceIntervals = {
            oilChange: 5000,
            tireRotation: 10000,
            brakeInspection: 15000,
            engineTuneUp: 30000,
            transmissionService: 60000
          }
        }
        setSettings(data)
      } else {
        toast.error('Failed to fetch settings')
      }
    } catch (error) {
      toast.error('Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchActivityData = async () => {
    if (!isAdmin) return
    
    setActivityLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.log('No auth token available, skipping activity data fetch')
        setActivityLoading(false)
        return
      }
      
      const [activitiesResponse, loginResponse] = await Promise.all([
        fetch('/api/admin/activities?limit=25', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/login-history?limit=25', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json()
        setUserActivities(activitiesData.activities || [])
      }

      if (loginResponse.ok) {
        const loginData = await loginResponse.json()
        setLoginHistory(loginData.history || [])
      }
    } catch (error) {
      console.error('Error fetching activity data:', error)
      toast.error('Failed to fetch activity data')
    } finally {
      setActivityLoading(false)
    }
  }

  const updateSettings = (field: keyof SettingsData, value: any) => {
    if (settings) {
      const updatedSettings = { ...settings, [field]: value }
      setSettings(updatedSettings)
      setHasChanges(true)
    }
  }

  const updateNestedSettings = (parent: keyof SettingsData, field: string, value: any) => {
    if (settings) {
      const updatedSettings = { 
        ...settings, 
        [parent]: {
          ...(settings[parent] as any || {}),
          [field]: value
        }
      }
      setSettings(updatedSettings)
      setHasChanges(true)
    }
  }

  const updateRolePermission = (role: string, permissionType: string, enabled: boolean) => {
    if (!settings) return

    const rolePermissions = settings.rolePermissions || { ...defaultSettingsPermissions.rolePermissions }
    
    // Check if we're dealing with object format or array format
    const currentPermissions = rolePermissions[role]
    const isArrayFormat = Array.isArray(currentPermissions)
    
    if (!rolePermissions[role]) {
      if (isArrayFormat) {
        rolePermissions[role] = []
      } else {
        // Initialize with default permissions object
        rolePermissions[role] = {
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
          canViewReports: false,
          canViewUsers: false,
          canManageUsers: false,
          canViewSettings: false,
          canManageSettings: false,
          canViewAdmin: false,
          canManageAdmin: false
        }
      }
    }
    
    if (isArrayFormat) {
      // Array format handling (original logic)
      const permissionMap = {
        'dashboard': { resource: 'dashboard', actions: ['read'] },
        'trucks': { resource: 'trucks', actions: ['read', 'create', 'update'] },
        'trucks-delete': { resource: 'trucks', actions: ['delete'] },
        'maintenance': { resource: 'maintenance', actions: ['read', 'create', 'update'] },
        'maintenance-delete': { resource: 'maintenance', actions: ['delete'] },
        'mechanics': { resource: 'mechanics', actions: ['read', 'create', 'update'] },
        'mechanics-delete': { resource: 'mechanics', actions: ['delete'] },
        'reports': { resource: 'reports', actions: ['read', 'create', 'export'] },
        'users': { resource: 'users', actions: ['read'] },
        'users-manage': { resource: 'users', actions: ['create', 'update', 'delete'] },
        'settings': { resource: 'settings', actions: ['read'] },
        'settings-manage': { resource: 'settings', actions: ['update'] },
        'admin': { resource: 'admin', actions: ['read', 'update'] }
      }

      const permission = permissionMap[permissionType as keyof typeof permissionMap]
      if (!permission) return

      const permissionIndex = rolePermissions[role].findIndex((p: any) => p.resource === permission.resource)
      
      if (permissionIndex >= 0) {
        if (enabled) {
          permission.actions.forEach(action => {
            if (!rolePermissions[role][permissionIndex].actions.includes(action)) {
              rolePermissions[role][permissionIndex].actions.push(action)
            }
          })
        } else {
          permission.actions.forEach(action => {
            rolePermissions[role][permissionIndex].actions = rolePermissions[role][permissionIndex].actions.filter((a: string) => a !== action)
          })
          // Remove permission if no actions left
          if (rolePermissions[role][permissionIndex].actions.length === 0) {
            rolePermissions[role].splice(permissionIndex, 1)
          }
        }
      } else if (enabled) {
        rolePermissions[role].push({ resource: permission.resource, actions: [...permission.actions] })
      }
    } else {
      // Object format handling
      const permissionUpdates: Record<string, (obj: any, enabled: boolean) => void> = {
        'dashboard': (obj, enabled) => { obj.canViewDashboard = enabled },
        'trucks': (obj, enabled) => { 
          obj.canViewTrucks = enabled
          obj.canAddTrucks = enabled
          obj.canEditTrucks = enabled
        },
        'trucks-delete': (obj, enabled) => { obj.canDeleteTrucks = enabled },
        'maintenance': (obj, enabled) => { 
          obj.canViewMaintenance = enabled
          obj.canAddMaintenance = enabled
          obj.canEditMaintenance = enabled
        },
        'maintenance-delete': (obj, enabled) => { obj.canDeleteMaintenance = enabled },
        'mechanics': (obj, enabled) => { 
          obj.canViewMechanics = enabled
          obj.canAddMechanics = enabled
          obj.canEditMechanics = enabled
        },
        'mechanics-delete': (obj, enabled) => { obj.canDeleteMechanics = enabled },
        'reports': (obj, enabled) => { obj.canViewReports = enabled },
        'users': (obj, enabled) => { obj.canViewUsers = enabled },
        'users-manage': (obj, enabled) => { obj.canManageUsers = enabled },
        'settings': (obj, enabled) => { obj.canViewSettings = enabled },
        'settings-manage': (obj, enabled) => { obj.canManageSettings = enabled },
        'admin': (obj, enabled) => { obj.canViewAdmin = enabled }
      }
      
      const updater = permissionUpdates[permissionType]
      if (updater) {
        updater(rolePermissions[role], enabled)
      }
    }

    updateSettings('rolePermissions', rolePermissions)
  }

  const hasPermission = (role: string, permissionType: string): boolean => {
    if (!settings) return false

    const rolePermissions = settings.rolePermissions || defaultSettingsPermissions.rolePermissions
    const permissions = rolePermissions[role] || []

    // Handle both object format (from API) and array format (for UI)
    const isArrayFormat = Array.isArray(permissions)
    
    const permissionMap = {
      'dashboard': { resource: 'dashboard', actions: ['read'] },
      'trucks': { resource: 'trucks', actions: ['read', 'create', 'update'] },
      'trucks-delete': { resource: 'trucks', actions: ['delete'] },
      'maintenance': { resource: 'maintenance', actions: ['read', 'create', 'update'] },
      'maintenance-delete': { resource: 'maintenance', actions: ['delete'] },
      'mechanics': { resource: 'mechanics', actions: ['read', 'create', 'update'] },
      'mechanics-delete': { resource: 'mechanics', actions: ['delete'] },
      'reports': { resource: 'reports', actions: ['read', 'create', 'export'] },
      'users': { resource: 'users', actions: ['read'] },
      'users-manage': { resource: 'users', actions: ['create', 'update', 'delete'] },
      'settings': { resource: 'settings', actions: ['read'] },
      'settings-manage': { resource: 'settings', actions: ['update'] },
      'admin': { resource: 'admin', actions: ['read', 'update'] }
    }

    const permission = permissionMap[permissionType as keyof typeof permissionMap]
    if (!permission) return false

    if (isArrayFormat) {
      // Array format: [{ resource: 'trucks', actions: ['read', 'create'] }]
      return permissions.some((p: any) => 
        p.resource === permission.resource && 
        permission.actions.every(action => p.actions.includes(action))
      )
    } else {
      // Object format: { canViewTrucks: true, canAddTrucks: false, ... }
      const permissionChecks: Record<string, (obj: any) => boolean> = {
        'dashboard': (obj) => obj.canViewDashboard,
        'trucks': (obj) => obj.canViewTrucks && obj.canAddTrucks && obj.canEditTrucks,
        'trucks-delete': (obj) => obj.canDeleteTrucks,
        'maintenance': (obj) => obj.canViewMaintenance && obj.canAddMaintenance && obj.canEditMaintenance,
        'maintenance-delete': (obj) => obj.canDeleteMaintenance,
        'mechanics': (obj) => obj.canViewMechanics && obj.canAddMechanics && obj.canEditMechanics,
        'mechanics-delete': (obj) => obj.canDeleteMechanics,
        'reports': (obj) => obj.canViewReports,
        'users': (obj) => obj.canViewUsers,
        'users-manage': (obj) => obj.canManageUsers,
        'settings': (obj) => obj.canViewSettings,
        'settings-manage': (obj) => obj.canManageSettings,
        'admin': (obj) => obj.canViewAdmin
      }
      
      const checker = permissionChecks[permissionType]
      return checker ? checker(permissions) : false
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const response = await apiPut('/api/settings', settings)

      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
        setHasChanges(false)
        refreshPermissions()
        toast.success('Settings saved successfully!')
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    fetchSettings()
    setHasChanges(false)
  }

  if (!canAccess('settings')) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access settings.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Settings Not Available</h2>
          <p className="text-gray-600">Unable to load settings. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your fleet management system</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System Status</TabsTrigger>
          {isAdmin && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {isAdmin && <TabsTrigger value="activity">User Activity</TabsTrigger>}
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Set up your company details that appear on reports and documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Enter company name"
                    value={settings.companyName || ''}
                    onChange={(e) => updateSettings('companyName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder="company@example.com"
                    value={settings.companyEmail || ''}
                    onChange={(e) => updateSettings('companyEmail', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input
                    id="companyPhone"
                    placeholder="+966 12 345 6789"
                    value={settings.companyPhone || ''}
                    onChange={(e) => updateSettings('companyPhone', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => updateSettings('timezone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Riyadh">Asia/Riyadh (Saudi Arabia)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Company Address</Label>
                <Textarea
                  id="companyAddress"
                  placeholder="Enter company address"
                  value={settings.companyAddress || ''}
                  onChange={(e) => updateSettings('companyAddress', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency Settings */}
        <TabsContent value="currency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Currency Settings
              </CardTitle>
              <CardDescription>
                Configure how currency values are displayed throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currencySymbol">Currency Symbol</Label>
                  <Input
                    id="currencySymbol"
                    placeholder="﷼"
                    value={settings.currencySymbol}
                    onChange={(e) => updateSettings('currencySymbol', e.target.value)}
                    maxLength={3}
                  />
                  <p className="text-xs text-muted-foreground">Example: ﷼, $, €, £</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currencyCode">Currency Code</Label>
                  <Select value={settings.currencyCode} onValueChange={(value) => updateSettings('currencyCode', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currencyName">Currency Name</Label>
                  <Input
                    id="currencyName"
                    placeholder="Saudi Riyal"
                    value={settings.currencyName}
                    onChange={(e) => updateSettings('currencyName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="decimalPlaces">Decimal Places</Label>
                  <Select value={settings.decimalPlaces.toString()} onValueChange={(value) => updateSettings('decimalPlaces', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 (1000)</SelectItem>
                      <SelectItem value="2">2 (1000.00)</SelectItem>
                      <SelectItem value="3">3 (1000.000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="thousandsSeparator">Thousands Separator</Label>
                  <Input
                    id="thousandsSeparator"
                    placeholder=","
                    value={settings.thousandsSeparator}
                    onChange={(e) => updateSettings('thousandsSeparator', e.target.value)}
                    maxLength={1}
                  />
                  <p className="text-xs text-muted-foreground">Example: , or . or space</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="decimalSeparator">Decimal Separator</Label>
                  <Input
                    id="decimalSeparator"
                    placeholder="."
                    value={settings.decimalSeparator}
                    onChange={(e) => updateSettings('decimalSeparator', e.target.value)}
                    maxLength={1}
                  />
                  <p className="text-xs text-muted-foreground">Example: . or ,</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="symbolPosition">Symbol Position</Label>
                <Select value={settings.symbolPosition} onValueChange={(value) => updateSettings('symbolPosition', value as 'before' | 'after')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before amount (﷼ 1,000.00)</SelectItem>
                    <SelectItem value="after">After amount (1,000.00 ﷼)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Preview</h4>
                <p className="text-lg font-semibold">
                  {settings.symbolPosition === 'before' ? settings.currencySymbol : ''}
                  1{settings.thousandsSeparator}000{settings.decimalPlaces > 0 ? settings.decimalSeparator + '00' : ''}
                  {settings.symbolPosition === 'after' ? ` ${settings.currencySymbol}` : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Settings */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Maintenance Intervals
              </CardTitle>
              <CardDescription>
                Set default maintenance intervals for your fleet (in kilometers)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="oilChange">Oil Change Interval</Label>
                  <Input
                    id="oilChange"
                    type="number"
                    placeholder="5000"
                    value={settings.maintenanceIntervals?.oilChange || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'oilChange', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Kilometers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tireRotation">Tire Rotation</Label>
                  <Input
                    id="tireRotation"
                    type="number"
                    placeholder="10000"
                    value={settings.maintenanceIntervals?.tireRotation || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'tireRotation', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Kilometers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="brakeInspection">Brake Inspection</Label>
                  <Input
                    id="brakeInspection"
                    type="number"
                    placeholder="15000"
                    value={settings.maintenanceIntervals?.brakeInspection || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'brakeInspection', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Kilometers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="engineTuneUp">Engine Tune-up</Label>
                  <Input
                    id="engineTuneUp"
                    type="number"
                    placeholder="30000"
                    value={settings.maintenanceIntervals?.engineTuneUp || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'engineTuneUp', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Kilometers</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transmissionService">Transmission Service</Label>
                  <Input
                    id="transmissionService"
                    type="number"
                    placeholder="60000"
                    value={settings.maintenanceIntervals?.transmissionService || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'transmissionService', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Kilometers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={settings.notifications?.email || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'email', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="upcomingMaintenance">Upcoming Maintenance</Label>
                    <p className="text-sm text-muted-foreground">Get notified when maintenance is due</p>
                  </div>
                  <Switch
                    id="upcomingMaintenance"
                    checked={settings.notifications?.upcomingMaintenance || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'upcomingMaintenance', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="overdueMaintenance">Overdue Maintenance</Label>
                    <p className="text-sm text-muted-foreground">Get notified when maintenance is overdue</p>
                  </div>
                  <Switch
                    id="overdueMaintenance"
                    checked={settings.notifications?.overdueMaintenance || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'overdueMaintenance', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="lowStock">Low Stock Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified when parts are running low</p>
                  </div>
                  <Switch
                    id="lowStock"
                    checked={settings.notifications?.lowStock || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'lowStock', checked)}
                  />
                </div>
              </div>
              
              {/* Test Notifications */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800">Test Notifications</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Test if your notification settings are working by triggering a notification check.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/notifications/check', { method: 'POST' })
                      if (response.ok) {
                        toast.success('Notification check completed! Check your notifications panel.')
                      } else {
                        toast.error('Failed to run notification check')
                      }
                    } catch (error) {
                      toast.error('Failed to run notification check')
                    }
                  }}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Test Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Permissions - Only for Admin */}
        {isAdmin && (
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role Permissions
                </CardTitle>
                <CardDescription>
                  Configure what each role can do in the system. Admin users always have full access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Role Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(roleDefinitions).map(([roleKey, role]) => {
                    const IconComponent = role.icon
                    return (
                      <Card key={roleKey} className="text-center">
                        <CardHeader className="pb-2">
                          <div className="flex justify-center mb-2">
                            <IconComponent className="h-8 w-8" />
                          </div>
                          <CardTitle className="text-lg">{role.name}</CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Badge variant={role.color as any}>{role.name}</Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Permission Matrix */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Configure Permissions</h3>
                  
                  {/* Dashboard Permissions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Dashboard Access
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can view the main dashboard
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <role.icon className="h-4 w-4" />
                              <span className="font-medium">{role.name}</span>
                            </div>
                            <Switch
                              checked={hasPermission(roleKey, 'dashboard')}
                              onCheckedChange={(checked) => updateRolePermission(roleKey, 'dashboard', checked)}
                              disabled={roleKey === 'ADMIN'} // Admin always has access
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Truck Management */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Truck Management
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can manage trucks
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="space-y-2">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <role.icon className="h-4 w-4" />
                                <span className="font-medium">{role.name}</span>
                              </div>
                            </div>
                            <div className="space-y-2 ml-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">View Trucks</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'trucks')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'trucks', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Delete Trucks</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'trucks-delete')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'trucks-delete', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Maintenance Management */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Maintenance Management
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can manage maintenance records
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="space-y-2">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <role.icon className="h-4 w-4" />
                                <span className="font-medium">{role.name}</span>
                              </div>
                            </div>
                            <div className="space-y-2 ml-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Manage Maintenance</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'maintenance')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'maintenance', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Delete Records</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'maintenance-delete')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'maintenance-delete', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Reports Access */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Reports Access
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can view and create reports
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <role.icon className="h-4 w-4" />
                              <span className="font-medium">{role.name}</span>
                            </div>
                            <Switch
                              checked={hasPermission(roleKey, 'reports')}
                              onCheckedChange={(checked) => updateRolePermission(roleKey, 'reports', checked)}
                              disabled={roleKey === 'ADMIN'}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* User Management */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        User Management
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can manage users
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="space-y-2">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <role.icon className="h-4 w-4" />
                                <span className="font-medium">{role.name}</span>
                              </div>
                            </div>
                            <div className="space-y-2 ml-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">View Users</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'users')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'users', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Manage Users</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'users-manage')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'users-manage', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Settings Access */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Settings Access
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Control who can change settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                          <div key={roleKey} className="space-y-2">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <role.icon className="h-4 w-4" />
                                <span className="font-medium">{role.name}</span>
                              </div>
                            </div>
                            <div className="space-y-2 ml-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">View Settings</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'settings')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'settings', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Change Settings</span>
                                <Switch
                                  checked={hasPermission(roleKey, 'settings-manage')}
                                  onCheckedChange={(checked) => updateRolePermission(roleKey, 'settings-manage', checked)}
                                  disabled={roleKey === 'ADMIN'}
                                  size="sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Summary */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-blue-800">Quick Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">👑 Admin</h4>
                        <p className="text-blue-700">Full access to everything. Cannot be changed.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">💼 Manager</h4>
                        <p className="text-blue-700">Can manage most operations but cannot delete important data or manage users.</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">👤 User</h4>
                        <p className="text-blue-700">Read-only access. Can view information but cannot make changes.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* System Status Tab */}
        <TabsContent value="system" className="space-y-6">
          <SystemStatus />
        </TabsContent>

        {/* User Activity Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  User Activity Monitoring
                </CardTitle>
                <CardDescription>
                  Monitor user activities and login history across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Recent Activities */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activities
                      </h3>
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">User</th>
                              <th className="text-left p-3 font-medium">Action</th>
                              <th className="text-left p-3 font-medium">Entity</th>
                              <th className="text-left p-3 font-medium">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userActivities.slice(0, 10).map((activity) => (
                              <tr key={activity.id} className="border-t hover:bg-muted/50">
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium">{activity.user?.name || 'Unknown'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {activity.user?.email || 'Unknown'}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline">
                                    {activity.action}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium">{activity.entityType}</div>
                                    {activity.entityName && (
                                      <div className="text-sm text-muted-foreground">
                                        {activity.entityName}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    {new Date(activity.createdAt).toLocaleString()}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {userActivities.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No recent activities found
                        </div>
                      )}
                    </div>

                    {/* Login History */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Recent Login History
                      </h3>
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        <table className="w-full">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium">User</th>
                              <th className="text-left p-3 font-medium">Login Time</th>
                              <th className="text-left p-3 font-medium">Logout Time</th>
                              <th className="text-left p-3 font-medium">Duration</th>
                              <th className="text-left p-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loginHistory.slice(0, 10).map((login) => (
                              <tr key={login.id} className="border-t hover:bg-muted/50">
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium">{login.user?.name || 'Unknown'}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {login.user?.email || 'Unknown'}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    {new Date(login.loginTime).toLocaleString()}
                                  </div>
                                </td>
                                <td className="p-3">
                                  {login.logoutTime ? (
                                    <div className="text-sm">
                                      {new Date(login.logoutTime).toLocaleString()}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Still active</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    {login.sessionDuration ? (
                                      <span>
                                        {Math.floor(login.sessionDuration / 3600)}h {
                                          Math.floor((login.sessionDuration % 3600) / 60)
                                        }m {
                                          login.sessionDuration % 60
                                        }s
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">N/A</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge variant={login.isActive ? 'default' : 'secondary'}>
                                    {login.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {loginHistory.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No login history found
                        </div>
                      )}
                    </div>

                    {/* View Full Monitoring Link */}
                    <div className="flex justify-center pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => window.open('/admin/monitoring', '_blank')}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        View Full Monitoring Dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}