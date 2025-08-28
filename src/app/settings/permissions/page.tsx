'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Search, Settings, User as UserIcon, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Permission, defaultPermissions, adminPermissions, managerPermissions } from '@/lib/permissions'

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  permissions?: any
  createdAt: string
  updatedAt: string
}

interface PermissionGroup {
  name: string
  permissions: (keyof Permission)[]
  description: string
}

const permissionGroups: PermissionGroup[] = [
  {
    name: 'Dashboard',
    permissions: ['canViewDashboard'],
    description: 'Access to main dashboard'
  },
  {
    name: 'Truck Management',
    permissions: ['canViewTrucks', 'canAddTrucks', 'canEditTrucks', 'canDeleteTrucks'],
    description: 'Manage truck fleet'
  },
  {
    name: 'Maintenance',
    permissions: ['canViewMaintenance', 'canAddMaintenance', 'canEditMaintenance', 'canDeleteMaintenance'],
    description: 'Maintenance records and scheduling'
  },
  {
    name: 'Mechanics',
    permissions: ['canViewMechanics', 'canAddMechanics', 'canEditMechanics', 'canDeleteMechanics'],
    description: 'Manage mechanics and assignments'
  },
  {
    name: 'Reports',
    permissions: ['canViewReports'],
    description: 'Access to reports and analytics'
  },
  {
    name: 'User Management',
    permissions: ['canViewUsers', 'canManageUsers'],
    description: 'View and manage users'
  },
  {
    name: 'Settings',
    permissions: ['canViewSettings', 'canManageSettings'],
    description: 'System configuration'
  },
  {
    name: 'Admin',
    permissions: ['canViewAdmin', 'canManageAdmin'],
    description: 'Administrative functions'
  }
]

export default function PermissionsSettingsPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<Permission>(defaultPermissions)
  const [selectedRole, setSelectedRole] = useState<string>('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else {
        toast.error('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.role.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const handleEditPermissions = (user: User) => {
    setEditingUser(user)
    const permissions = user.permissions ? 
      { ...defaultPermissions, ...user.permissions } : 
      getUserDefaultPermissions(user.role)
    setUserPermissions(permissions)
    setSelectedRole(user.role)
    setIsDialogOpen(true)
  }

  const getUserDefaultPermissions = (role: string): Permission => {
    switch (role) {
      case 'ADMIN':
        return adminPermissions
      case 'MANAGER':
        return managerPermissions
      default:
        return defaultPermissions
    }
  }

  const handleRoleChange = (role: string) => {
    setSelectedRole(role)
    const defaultPerms = getUserDefaultPermissions(role)
    setUserPermissions(defaultPerms)
  }

  const handlePermissionToggle = (permission: keyof Permission, value: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [permission]: value
    }))
  }

  const handleSavePermissions = async () => {
    if (!editingUser) return

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: selectedRole,
          permissions: userPermissions
        })
      })

      if (response.ok) {
        toast.success('User permissions updated successfully')
        setIsDialogOpen(false)
        fetchUsers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to update permissions')
      }
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Failed to update permissions')
    }
  }

  const getPermissionLabel = (permission: keyof Permission): string => {
    return permission
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace('Can ', '')
      .trim()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Permissions</h1>
          <p className="text-muted-foreground">Manage user access and permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Users and Permissions
          </CardTitle>
          <CardDescription>
            Configure access permissions for each user. Admin users have full access by default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' ? 'destructive' : user.role === 'MANAGER' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {user.permissions ? 'Custom' : 'Role Default'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditPermissions(user)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Permissions
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permission Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Permissions - {editingUser?.name}
            </DialogTitle>
            <DialogDescription>
              Configure access permissions for this user
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Role Selection */}
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="MECHANIC">Mechanic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permission Groups */}
            {permissionGroups.map((group) => (
              <Card key={group.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <CardDescription className="text-sm">{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    {group.permissions.map((permission) => (
                      <div key={permission} className="flex items-center space-x-2">
                        <Switch
                          id={permission}
                          checked={userPermissions[permission]}
                          onCheckedChange={(checked) => handlePermissionToggle(permission, checked)}
                        />
                        <Label htmlFor={permission} className="text-sm">
                          {getPermissionLabel(permission)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions}>
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}