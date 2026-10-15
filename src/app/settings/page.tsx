'use client'
import { LocalizedText } from '@/components/localized-text'

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
import SettingsDashboard from '@/components/settings-dashboard'
import SystemUtilities from '@/components/system-utilities'
import { toast } from '@/lib/localized-toast'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { defaultSettingsPermissions, defaultRolePermissions, normalizeRolePermissions, Permission } from '@/lib/permissions'
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

const rolePermissionSections: { title: string; description: string; permissions: { field: keyof Permission; label: string }[] }[] = [
  { title: 'Dashboard', description: 'Access to the main dashboard', permissions: [{ field: 'canViewDashboard', label: 'View dashboard' }] },
  { title: 'Trucks', description: 'Truck fleet records and actions', permissions: [
    { field: 'canViewTrucks', label: 'View trucks' }, { field: 'canAddTrucks', label: 'Add trucks' },
    { field: 'canEditTrucks', label: 'Edit trucks' }, { field: 'canDeleteTrucks', label: 'Delete trucks' }
  ] },
  { title: 'Job Cards, Oil Changes & Maintenance', description: 'These pages share the maintenance records permission and API access.', permissions: [
    { field: 'canViewMaintenance', label: 'View job cards, oil changes and maintenance' }, { field: 'canAddMaintenance', label: 'Create records' },
    { field: 'canEditMaintenance', label: 'Edit records' }, { field: 'canDeleteMaintenance', label: 'Delete records' }
  ] },
  { title: 'Mechanics', description: 'Mechanic records and assignments', permissions: [
    { field: 'canViewMechanics', label: 'View mechanics' }, { field: 'canAddMechanics', label: 'Add mechanics' },
    { field: 'canEditMechanics', label: 'Edit mechanics' }, { field: 'canDeleteMechanics', label: 'Delete mechanics' }
  ] },
  { title: 'Tire Management', description: 'Tire inventory and management actions', permissions: [
    { field: 'canViewTireManagement', label: 'View tire management' }, { field: 'canAddTireManagement', label: 'Add tire records' },
    { field: 'canEditTireManagement', label: 'Edit tire records' }, { field: 'canDeleteTireManagement', label: 'Delete tire records' }
  ] },
  { title: 'Trailers', description: 'Trailer fleet records and actions', permissions: [
    { field: 'canViewTrailers', label: 'View trailers' }, { field: 'canAddTrailers', label: 'Add trailers' },
    { field: 'canEditTrailers', label: 'Edit trailers' }, { field: 'canDeleteTrailers', label: 'Delete trailers' }
  ] },
  { title: 'Reports', description: 'Maintenance and tire reports', permissions: [{ field: 'canViewReports', label: 'View and generate reports' }] },
  { title: 'Advanced Analytics', description: 'Fleet analytics dashboard', permissions: [{ field: 'canViewAdvancedAnalytics', label: 'View advanced analytics' }] },
  { title: 'Users', description: 'User accounts and access management', permissions: [
    { field: 'canViewUsers', label: 'View users' }, { field: 'canManageUsers', label: 'Create, edit and delete users' }
  ] },
  { title: 'Profile', description: 'Personal account and profile page', permissions: [
    { field: 'canViewProfile', label: 'View profile' }, { field: 'canEditProfile', label: 'Edit profile' }
  ] },
  { title: 'Settings', description: 'System settings page', permissions: [
    { field: 'canViewSettings', label: 'View settings' }, { field: 'canManageSettings', label: 'Change settings' }
  ] },
  { title: 'Admin & Activity', description: 'These pages are restricted to Admin roles.', permissions: [
    { field: 'canViewAdmin', label: 'View admin pages' }, { field: 'canManageAdmin', label: 'Manage admin functions' }
  ] }
]

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const { canAccess, canUpdate, refreshPermissions } = usePermissions()
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

  const updateRolePermission = (role: string, field: keyof Permission, enabled: boolean) => {
    if (!settings) return

    const currentRolePermissions = settings.rolePermissions || defaultSettingsPermissions.rolePermissions
    const rolePermissions = Object.fromEntries(
      Object.entries(currentRolePermissions).map(([roleKey, permissions]) => [
        roleKey,
        normalizeRolePermissions(permissions)
      ])
    ) as Record<string, ReturnType<typeof normalizeRolePermissions>>
    const nextRolePermissions = {
      ...(rolePermissions[role] || normalizeRolePermissions(defaultRolePermissions[role as keyof typeof defaultRolePermissions]))
    }

    const viewFieldByAction: Partial<Record<keyof Permission, keyof Permission>> = {
      canAddTrucks: 'canViewTrucks', canEditTrucks: 'canViewTrucks', canDeleteTrucks: 'canViewTrucks',
      canAddMaintenance: 'canViewMaintenance', canEditMaintenance: 'canViewMaintenance', canDeleteMaintenance: 'canViewMaintenance',
      canAddMechanics: 'canViewMechanics', canEditMechanics: 'canViewMechanics', canDeleteMechanics: 'canViewMechanics',
      canAddTireManagement: 'canViewTireManagement', canEditTireManagement: 'canViewTireManagement', canDeleteTireManagement: 'canViewTireManagement',
      canAddTrailers: 'canViewTrailers', canEditTrailers: 'canViewTrailers', canDeleteTrailers: 'canViewTrailers',
      canEditProfile: 'canViewProfile', canManageSettings: 'canViewSettings', canManageAdmin: 'canViewAdmin'
    }
    const actionsByViewField: Partial<Record<keyof Permission, (keyof Permission)[]>> = {
      canViewTrucks: ['canAddTrucks', 'canEditTrucks', 'canDeleteTrucks'],
      canViewMaintenance: ['canAddMaintenance', 'canEditMaintenance', 'canDeleteMaintenance'],
      canViewMechanics: ['canAddMechanics', 'canEditMechanics', 'canDeleteMechanics'],
      canViewTireManagement: ['canAddTireManagement', 'canEditTireManagement', 'canDeleteTireManagement'],
      canViewTrailers: ['canAddTrailers', 'canEditTrailers', 'canDeleteTrailers'],
      canViewProfile: ['canEditProfile'], canViewSettings: ['canManageSettings'], canViewAdmin: ['canManageAdmin']
    }
    nextRolePermissions[field] = enabled
    const requiredViewField = viewFieldByAction[field]
    if (enabled && requiredViewField) nextRolePermissions[requiredViewField] = true
    if (!enabled && actionsByViewField[field]) {
      for (const actionField of actionsByViewField[field]!) nextRolePermissions[actionField] = false
    }
    // Managing users requires access to the user list so the grant is usable.
    if (field === 'canManageUsers' && enabled) {
      nextRolePermissions.canViewUsers = true
    }
    if (field === 'canViewUsers' && !enabled) {
      nextRolePermissions.canManageUsers = false
    }
    rolePermissions[role] = nextRolePermissions

    updateSettings('rolePermissions', rolePermissions)
  }

  const hasPermission = (role: string, field: keyof Permission): boolean => {
    if (!settings) return false

    const rolePermissions = settings.rolePermissions || defaultSettingsPermissions.rolePermissions
    const permissions = normalizeRolePermissions(
      rolePermissions[role] || defaultRolePermissions[role as keyof typeof defaultRolePermissions]
    )
    return permissions[field] === true
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
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to save settings')
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
          <h2 className="text-xl font-semibold mb-2"><LocalizedText>Access Denied</LocalizedText></h2>
          <p className="text-gray-600"><LocalizedText>You don't have permission to access settings.</LocalizedText></p>
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
          <h2 className="text-xl font-semibold mb-2"><LocalizedText>Settings Not Available</LocalizedText></h2>
          <p className="text-gray-600"><LocalizedText>Unable to load settings. Please try again.</LocalizedText></p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight"><LocalizedText>Settings</LocalizedText></h1>
          <p className="text-muted-foreground text-sm sm:text-base"><LocalizedText>Configure your fleet management system</LocalizedText></p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges} className="flex-1 sm:flex-none">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline"><LocalizedText>Reset</LocalizedText></span>
          </Button>
          <Button onClick={handleSave} disabled={!canUpdate('settings') || !hasChanges || saving} className="flex-1 sm:flex-none">
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Changes'}</span>
            <span className="sm:hidden">{saving ? 'Save...' : 'Save'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 min-w-max">
            <TabsTrigger value="company" className="text-xs sm:text-sm flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span className="hidden sm:inline"><LocalizedText>Company</LocalizedText></span>
            </TabsTrigger>
            <TabsTrigger value="currency" className="text-xs sm:text-sm flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline"><LocalizedText>Currency</LocalizedText></span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs sm:text-sm flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline"><LocalizedText>Maintenance</LocalizedText></span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm flex items-center gap-1">
              <Bell className="h-3 w-3" />
              <span className="hidden sm:inline"><LocalizedText>Notifications</LocalizedText></span>
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs sm:text-sm flex items-center gap-1">
              <Settings className="h-3 w-3" />
              <span className="hidden sm:inline"><LocalizedText>System</LocalizedText></span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="roles" className="text-xs sm:text-sm flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span className="hidden sm:inline"><LocalizedText>Roles</LocalizedText></span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="activity" className="text-xs sm:text-sm flex items-center gap-1">
                <Activity className="h-3 w-3" />
                <span className="hidden sm:inline"><LocalizedText>Activity</LocalizedText></span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                <LocalizedText>Set up your company details that appear on reports and documents</LocalizedText>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName"><LocalizedText>Company Name</LocalizedText></Label>
                  <Input
                    id="companyName"
                    placeholder="Enter company name"
                    value={settings.companyName || ''}
                    onChange={(e) => updateSettings('companyName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyEmail"><LocalizedText>Company Email</LocalizedText></Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder="company@example.com"
                    value={settings.companyEmail || ''}
                    onChange={(e) => updateSettings('companyEmail', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyPhone"><LocalizedText>Company Phone</LocalizedText></Label>
                  <Input
                    id="companyPhone"
                    placeholder="+966 12 345 6789"
                    value={settings.companyPhone || ''}
                    onChange={(e) => updateSettings('companyPhone', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone"><LocalizedText>Timezone</LocalizedText></Label>
                  <Select value={settings.timezone} onValueChange={(value) => updateSettings('timezone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Riyadh"><LocalizedText>Asia/Riyadh (Saudi Arabia)</LocalizedText></SelectItem>
                      <SelectItem value="UTC"><LocalizedText>UTC</LocalizedText></SelectItem>
                      <SelectItem value="America/New_York"><LocalizedText>America/New_York</LocalizedText></SelectItem>
                      <SelectItem value="Europe/London"><LocalizedText>Europe/London</LocalizedText></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companyAddress"><LocalizedText>Company Address</LocalizedText></Label>
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
                <LocalizedText>Configure how currency values are displayed throughout the application</LocalizedText>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currencySymbol"><LocalizedText>Currency Symbol</LocalizedText></Label>
                  <Input
                    id="currencySymbol"
                    placeholder="﷼"
                    value={settings.currencySymbol}
                    onChange={(e) => updateSettings('currencySymbol', e.target.value)}
                    maxLength={3}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Example: ﷼, $, €, £</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currencyCode"><LocalizedText>Currency Code</LocalizedText></Label>
                  <Select value={settings.currencyCode} onValueChange={(value) => updateSettings('currencyCode', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR"><LocalizedText>SAR - Saudi Riyal</LocalizedText></SelectItem>
                      <SelectItem value="USD"><LocalizedText>USD - US Dollar</LocalizedText></SelectItem>
                      <SelectItem value="EUR"><LocalizedText>EUR - Euro</LocalizedText></SelectItem>
                      <SelectItem value="GBP"><LocalizedText>GBP - British Pound</LocalizedText></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currencyName"><LocalizedText>Currency Name</LocalizedText></Label>
                  <Input
                    id="currencyName"
                    placeholder="Saudi Riyal"
                    value={settings.currencyName}
                    onChange={(e) => updateSettings('currencyName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="decimalPlaces"><LocalizedText>Decimal Places</LocalizedText></Label>
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
                  <Label htmlFor="thousandsSeparator"><LocalizedText>Thousands Separator</LocalizedText></Label>
                  <Input
                    id="thousandsSeparator"
                    placeholder=","
                    value={settings.thousandsSeparator}
                    onChange={(e) => updateSettings('thousandsSeparator', e.target.value)}
                    maxLength={1}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Example: , or . or space</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="decimalSeparator"><LocalizedText>Decimal Separator</LocalizedText></Label>
                  <Input
                    id="decimalSeparator"
                    placeholder="."
                    value={settings.decimalSeparator}
                    onChange={(e) => updateSettings('decimalSeparator', e.target.value)}
                    maxLength={1}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Example: . or ,</LocalizedText></p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="symbolPosition"><LocalizedText>Symbol Position</LocalizedText></Label>
                <Select value={settings.symbolPosition} onValueChange={(value) => updateSettings('symbolPosition', value as 'before' | 'after')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before"><LocalizedText>Before amount (﷼ 1,000.00)</LocalizedText></SelectItem>
                    <SelectItem value="after"><LocalizedText>After amount (1,000.00 ﷼)</LocalizedText></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-3 text-blue-800"><LocalizedText>Currency Preview</LocalizedText></h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700"><LocalizedText>Small Amount:</LocalizedText></span>
                    <span className="text-lg font-semibold text-green-700">
                      {settings.symbolPosition === 'before' ? settings.currencySymbol : ''}
                      123{settings.decimalPlaces > 0 ? settings.decimalSeparator + '45' : ''}
                      {settings.symbolPosition === 'after' ? ` ${settings.currencySymbol}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700"><LocalizedText>Large Amount:</LocalizedText></span>
                    <span className="text-xl font-bold text-green-700">
                      {settings.symbolPosition === 'before' ? settings.currencySymbol : ''}
                      1{settings.thousandsSeparator}234{settings.thousandsSeparator}567{settings.decimalPlaces > 0 ? settings.decimalSeparator + '89' : ''}
                      {settings.symbolPosition === 'after' ? ` ${settings.currencySymbol}` : ''}
                    </span>
                  </div>
                </div>
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
                <LocalizedText>Set default maintenance intervals for your fleet (in kilometers)</LocalizedText>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="oilChange"><LocalizedText>Oil Change Interval</LocalizedText></Label>
                  <Input
                    id="oilChange"
                    type="number"
                    placeholder="5000"
                    value={settings.maintenanceIntervals?.oilChange || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'oilChange', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Kilometers</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tireRotation"><LocalizedText>Tire Rotation</LocalizedText></Label>
                  <Input
                    id="tireRotation"
                    type="number"
                    placeholder="10000"
                    value={settings.maintenanceIntervals?.tireRotation || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'tireRotation', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Kilometers</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="brakeInspection"><LocalizedText>Brake Inspection</LocalizedText></Label>
                  <Input
                    id="brakeInspection"
                    type="number"
                    placeholder="15000"
                    value={settings.maintenanceIntervals?.brakeInspection || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'brakeInspection', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Kilometers</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="engineTuneUp"><LocalizedText>Engine Tune-up</LocalizedText></Label>
                  <Input
                    id="engineTuneUp"
                    type="number"
                    placeholder="30000"
                    value={settings.maintenanceIntervals?.engineTuneUp || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'engineTuneUp', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Kilometers</LocalizedText></p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transmissionService"><LocalizedText>Transmission Service</LocalizedText></Label>
                  <Input
                    id="transmissionService"
                    type="number"
                    placeholder="60000"
                    value={settings.maintenanceIntervals?.transmissionService || ''}
                    onChange={(e) => updateNestedSettings('maintenanceIntervals', 'transmissionService', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground"><LocalizedText>Kilometers</LocalizedText></p>
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
                <LocalizedText>Configure which notifications you want to receive</LocalizedText>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications"><LocalizedText>Email Notifications</LocalizedText></Label>
                    <p className="text-sm text-muted-foreground"><LocalizedText>Receive notifications via email</LocalizedText></p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={settings.notifications?.email || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'email', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="upcomingMaintenance"><LocalizedText>Upcoming Maintenance</LocalizedText></Label>
                    <p className="text-sm text-muted-foreground"><LocalizedText>Get notified when maintenance is due</LocalizedText></p>
                  </div>
                  <Switch
                    id="upcomingMaintenance"
                    checked={settings.notifications?.upcomingMaintenance || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'upcomingMaintenance', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="overdueMaintenance"><LocalizedText>Overdue Maintenance</LocalizedText></Label>
                    <p className="text-sm text-muted-foreground"><LocalizedText>Get notified when maintenance is overdue</LocalizedText></p>
                  </div>
                  <Switch
                    id="overdueMaintenance"
                    checked={settings.notifications?.overdueMaintenance || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'overdueMaintenance', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="lowStock"><LocalizedText>Low Stock Alerts</LocalizedText></Label>
                    <p className="text-sm text-muted-foreground"><LocalizedText>Get notified when parts are running low</LocalizedText></p>
                  </div>
                  <Switch
                    id="lowStock"
                    checked={settings.notifications?.lowStock || false}
                    onCheckedChange={(checked) => updateNestedSettings('notifications', 'lowStock', checked)}
                  />
                </div>
              </div>
              
              {/* Notification Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium mb-2 text-green-800"><LocalizedText>Active Notifications</LocalizedText></h4>
                  <div className="space-y-1 text-sm">
                    {settings.notifications?.email && <div className="text-green-700">✓ Email notifications enabled</div>}
                    {settings.notifications?.upcomingMaintenance && <div className="text-green-700">✓ Upcoming maintenance alerts</div>}
                    {settings.notifications?.overdueMaintenance && <div className="text-green-700">✓ Overdue maintenance alerts</div>}
                    {settings.notifications?.lowStock && <div className="text-green-700">✓ Low stock alerts</div>}
                    {!Object.values(settings.notifications || {}).some(Boolean) && (
                      <div className="text-gray-500"><LocalizedText>No notifications enabled</LocalizedText></div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-800"><LocalizedText>Test Notifications</LocalizedText></h4>
                  <p className="text-sm text-blue-700 mb-3">
                    <LocalizedText>Test if your notification settings are working.</LocalizedText>
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('authToken')
                        if (!token) {
                          toast.error('Authentication required')
                          return
                        }
                        
                        const response = await fetch('/api/notifications/check', { 
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          }
                        })
                        
                        if (response.ok) {
                          toast.success('Notification check completed!')
                        } else {
                          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                          toast.error(`Failed: ${errorData.error || 'Unknown error'}`)
                        }
                      } catch (error) {
                        console.error('Notification check error:', error)
                        toast.error('Failed to run notification check')
                      }
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Test Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Permissions - Only for Admin */}
        {isAdmin && (
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Role Permissions
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <LocalizedText>Configure access for every app area. Admin users always have full access.</LocalizedText>
                  </CardDescription>
                </div>
                <Button onClick={handleSave} disabled={!canUpdate('settings') || !hasChanges || saving}>
                  <Save className="h-4 w-4 mr-2" />
                  <LocalizedText>{saving ? 'Saving...' : 'Save Role Permissions'}</LocalizedText>
                </Button>
              </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Role Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(roleDefinitions).map(([roleKey, role]) => {
                    const IconComponent = role.icon
                    return (
                      <Card key={roleKey} className="text-center">
                        <CardHeader className="pb-2">
                          <div className="flex justify-center mb-2">
                            <IconComponent className="h-8 w-8" />
                          </div>
                          <CardTitle className="text-lg"><LocalizedText>{role.name}</LocalizedText></CardTitle>
                          <CardDescription><LocalizedText>{role.description}</LocalizedText></CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Badge variant={role.color as any}><LocalizedText>{role.name}</LocalizedText></Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Permission Matrix */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold"><LocalizedText>Configure Permissions</LocalizedText></h3>
                  {rolePermissionSections.map((section) => (
                    <Card key={section.title}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base"><LocalizedText>{section.title}</LocalizedText></CardTitle>
                        <CardDescription className="text-sm"><LocalizedText>{section.description}</LocalizedText></CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <div className="min-w-[620px]">
                            <div className="grid grid-cols-[minmax(220px,1fr)_repeat(3,minmax(110px,1fr))] items-center gap-3 border-b px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground">
                              <span><LocalizedText>Permission</LocalizedText></span>
                              {Object.entries(roleDefinitions).map(([roleKey, role]) => (
                                <span key={roleKey} className="text-center"><LocalizedText>{role.name}</LocalizedText></span>
                              ))}
                            </div>
                            {section.permissions.map(({ field, label }) => (
                              <div key={field} className="grid grid-cols-[minmax(220px,1fr)_repeat(3,minmax(110px,1fr))] items-center gap-3 border-b last:border-0 px-2 py-3">
                                <span className="text-sm"><LocalizedText>{label}</LocalizedText></span>
                                {Object.keys(roleDefinitions).map((roleKey) => (
                                  <div key={roleKey} className="flex justify-center">
                                    <Switch
                                      aria-label={`${roleKey} ${label}`}
                                      checked={roleKey === 'ADMIN' ? true : (field === 'canViewAdmin' || field === 'canManageAdmin') ? false : hasPermission(roleKey, field)}
                                      onCheckedChange={(enabled) => updateRolePermission(roleKey, field, enabled)}
                                      disabled={roleKey === 'ADMIN' || field === 'canViewAdmin' || field === 'canManageAdmin'}
                                    />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Quick Summary */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-blue-800"><LocalizedText>Quick Summary</LocalizedText></CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">👑 <LocalizedText>Admin</LocalizedText></h4>
                        <p className="text-blue-700"><LocalizedText>Full access to everything. Cannot be changed.</LocalizedText></p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">💼 <LocalizedText>Manager</LocalizedText></h4>
                        <p className="text-blue-700"><LocalizedText>Can manage most operations but cannot delete important data or manage users.</LocalizedText></p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-2">👤 <LocalizedText>User</LocalizedText></h4>
                        <p className="text-blue-700"><LocalizedText>Read-only access. Can view information but cannot make changes.</LocalizedText></p>
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
          <SettingsDashboard />
          {isAdmin && <SystemUtilities />}
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
                  <LocalizedText>Monitor user activities and login history across the system</LocalizedText>
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
                              <th className="text-left p-3 font-medium"><LocalizedText>User</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Action</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Entity</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Time</LocalizedText></th>
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
                                    <LocalizedText>{activity.action}</LocalizedText>
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium"><LocalizedText>{activity.entityType}</LocalizedText></div>
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
                          <LocalizedText>No recent activities found</LocalizedText>
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
                              <th className="text-left p-3 font-medium"><LocalizedText>User</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Login Time</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Logout Time</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Duration</LocalizedText></th>
                              <th className="text-left p-3 font-medium"><LocalizedText>Status</LocalizedText></th>
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
                                    <span className="text-muted-foreground"><LocalizedText>Still active</LocalizedText></span>
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
                                      <span className="text-muted-foreground"><LocalizedText>N/A</LocalizedText></span>
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
                          <LocalizedText>No login history found</LocalizedText>
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
